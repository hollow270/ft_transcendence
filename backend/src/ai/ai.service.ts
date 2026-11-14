import { Injectable, Logger } from '@nestjs/common';
import { Observable, Subscriber } from 'rxjs';
import { PrismaService } from '../prisma.service';
import { AiContextService } from './ai-context.service';
import { AiProviderService } from './ai-provider.service';
import { ASSISTANT_SYSTEM_PROMPT } from './prompts/assistant.prompt';
import { SCAN_EXPLANATION_SYSTEM_PROMPT } from './prompts/scan-explanation.prompt';
import {
  AiChatMessage,
  AiStreamEvent,
  AiStreamPayload,
} from './types/ai-stream-event';

type UsageContext = {
  userId: string;
  artifactId?: string;
  scanId?: string;
};

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);

  constructor(
    private readonly provider: AiProviderService,
    private readonly context: AiContextService,
    private readonly prisma: PrismaService,
  ) {}

  streamGeneralChat(userId: string, prompt: string): Observable<AiStreamEvent> {
    return new Observable<AiStreamEvent>((subscriber) => {
      const controller = new AbortController();
      const messages: AiChatMessage[] = [
        { role: 'system', content: ASSISTANT_SYSTEM_PROMPT },
        { role: 'user', content: prompt },
      ];

      void this.executeStream(
        messages,
        subscriber,
        controller.signal,
        { userId },
      );

      return () => controller.abort();
    });
  }

  streamScanExplanation(
    userId: string,
    scanId: string,
  ): Observable<AiStreamEvent> {
    return new Observable<AiStreamEvent>((subscriber) => {
      const controller = new AbortController();

      void (async () => {
        try {
          const scanData =
            await this.context.getAuthorizedCompletedScan(userId, scanId);
          const prompt = this.context.formatScanContextPrompt(scanData);

          const messages: AiChatMessage[] = [
            { role: 'system', content: SCAN_EXPLANATION_SYSTEM_PROMPT },
            { role: 'user', content: prompt },
          ];

          await this.executeStream(
            messages,
            subscriber,
            controller.signal,
            {
              userId,
              artifactId: scanData.artifactId,
              scanId: scanData.scanId,
            },
          );
        } catch (error: any) {
          this.emit(subscriber, {
            event: 'error',
            message: error?.message ?? 'Unable to explain this scan.',
          });
          subscriber.complete();
        }
      })();

      return () => controller.abort();
    });
  }

  private async executeStream(
    messages: AiChatMessage[],
    subscriber: Subscriber<AiStreamEvent>,
    signal: AbortSignal,
    context: UsageContext,
  ): Promise<void> {
    const startedAt = Date.now();
    let inputTokens = 0;
    let outputTokens = 0;
    let successful = false;

    try {
      this.emit(subscriber, { event: 'start' });

      for await (const chunk of this.provider.streamCompletion(
        messages,
        signal,
      )) {
        if (signal.aborted) return;

        if (chunk.type === 'usage') {
          inputTokens = chunk.inputTokens;
          outputTokens = chunk.outputTokens;
          continue;
        }

        this.emit(subscriber, {
          event: 'delta',
          text: chunk.text,
        });
      }

      if (signal.aborted) return;

      successful = true;
      this.emit(subscriber, {
        event: 'complete',
        status: 'COMPLETE',
      });
      subscriber.complete();
    } catch (error: any) {
      this.logger.error(`AI stream failure: ${error?.message ?? 'unknown'}`);

      this.emit(subscriber, {
        event: 'error',
        message: error?.message ?? 'AI stream failed.',
      });
      subscriber.complete();
    } finally {
      if (!signal.aborted) {
        await this.logUsage({
          ...context,
          inputTokens,
          outputTokens,
          latencyMs: Date.now() - startedAt,
          successful,
        });
      }
    }
  }

  private async logUsage(input: UsageContext & {
    inputTokens: number;
    outputTokens: number;
    latencyMs: number;
    successful: boolean;
  }) {
    try {
      await this.prisma.llmUsageLog.create({
        data: {
          userId: input.userId,
          artifactId: input.artifactId ?? null,
          scanId: input.scanId ?? null,
          provider: this.provider.providerName,
          model: this.provider.modelName,
          inputTokens: input.inputTokens,
          outputTokens: input.outputTokens,
          latencyMs: input.latencyMs,
          successful: input.successful,
        },
      });
    } catch (error: any) {
      this.logger.warn(
        `Could not write LLM usage log: ${error?.message ?? 'unknown'}`,
      );
    }
  }

  private emit(
    subscriber: Subscriber<AiStreamEvent>,
    payload: AiStreamPayload,
  ) {
    if (subscriber.closed) return;
    subscriber.next({
      data: JSON.stringify(payload),
    });
  }
}
