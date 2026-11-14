import {
  Body,
  Controller,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { Observable } from 'rxjs';
import { SessionAuthGuard } from '../auth/auth.guard';
import { AiService } from './ai.service';
import { AskPromptDto } from './dto/ask-prompt.dto';
import { ExplainScanDto } from './dto/explain-scan.dto';
import { AiStreamEvent } from './types/ai-stream-event';

type AuthenticatedRequest = Request & {
  user: {
    id: string;
  };
};

@UseGuards(SessionAuthGuard)
@Controller('ai')
export class AiController {
  constructor(private readonly aiService: AiService) {}

  @Post('ask')
  ask(
    @Body() dto: AskPromptDto,
    @Req() req: AuthenticatedRequest,
    @Res() res: Response,
  ): void {
    this.pipeSse(
      this.aiService.streamGeneralChat(req.user.id, dto.prompt),
      req,
      res,
    );
  }

  @Post('scans/explain')
  explainScan(
    @Body() dto: ExplainScanDto,
    @Req() req: AuthenticatedRequest,
    @Res() res: Response,
  ): void {
    this.pipeSse(
      this.aiService.streamScanExplanation(req.user.id, dto.scanId),
      req,
      res,
    );
  }

  private pipeSse(
    stream$: Observable<AiStreamEvent>,
    req: Request,
    res: Response,
  ): void {
    res.status(200).set({
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    });
    res.flushHeaders();

    const subscription = stream$.subscribe({
      next: (event) => res.write(`data: ${event.data}\n\n`),
      error: () => res.end(),
      complete: () => res.end(),
    });

    req.on('close', () => subscription.unsubscribe());
  }
}
