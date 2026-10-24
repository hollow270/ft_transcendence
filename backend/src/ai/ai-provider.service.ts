import {
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import OpenAI from 'openai';
import {
  AiChatMessage,
  AiProviderStreamChunk,
} from './types/ai-stream-event';

@Injectable()
export class AiProviderService {
  private readonly logger = new Logger(AiProviderService.name);
  private readonly openai: OpenAI;

  constructor() {
    if (!process.env.OPENAI_API_KEY) {
      this.logger.warn(
        'OPENAI_API_KEY is not set; AI requests will return an unavailable error.',
      );
    }

    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY || 'missing-key',
      baseURL: process.env.OPENAI_BASE_URL || undefined,
    });
  }

  get modelName() {
    return process.env.OPENAI_MODEL || 'gpt-4o-mini';
  }

  get providerName() {
    return process.env.OPENAI_BASE_URL ? 'openai-compatible' : 'openai';
  }

  async *streamCompletion(
    messages: AiChatMessage[],
    signal?: AbortSignal,
  ): AsyncIterable<AiProviderStreamChunk> {
    if (!process.env.OPENAI_API_KEY) {
      throw new InternalServerErrorException(
        'The AI service is not configured yet.',
      );
    }

    try {
      const stream = await this.openai.chat.completions.create(
        {
          model: this.modelName,
          messages,
          stream: true,
          max_completion_tokens: 1500,
          stream_options: {
            include_usage: true,
          },
        },
        { signal },
      );

      for await (const chunk of stream) {
        const content = chunk.choices[0]?.delta?.content;

        if (content) {
          yield {
            type: 'delta',
            text: content,
          };
        }

        if (chunk.usage) {
          yield {
            type: 'usage',
            inputTokens: chunk.usage.prompt_tokens ?? 0,
            outputTokens: chunk.usage.completion_tokens ?? 0,
          };
        }
      }
    } catch (error: any) {
      if (signal?.aborted) {
        this.logger.log('Client aborted AI stream');
        return;
      }

      if (error instanceof InternalServerErrorException) {
        throw error;
      }

      this.logger.error(`AI provider error: ${error?.message ?? 'unknown'}`);
      throw new InternalServerErrorException(
        'The AI service is temporarily unavailable.',
      );
    }
  }
}
