import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { SessionAuthGuard } from '../auth/auth.guard';
import { ModerationService } from './moderation.service';
import { ModeratorGuard } from './moderator.guard';

@Controller('moderation')
@UseGuards(
  SessionAuthGuard,
  ModeratorGuard,
)
export class ModerationController {
  constructor(
    private readonly moderation:
      ModerationService,
  ) {}

  @Get('reports')
  listReports(
    @Query('status') status?: string,
  ) {
    return this.moderation.listReports(
      status,
    );
  }

  @Post('reports/:reportId/resolve')
  resolveReport(
    @Param('reportId')
    reportId: string,
    @Req() request: any,
    @Body()
    body: {
      action?: string;
      reason?: string;
      banDays?: number;
    },
  ) {
    return this.moderation.resolveReport(
      reportId,
      request.user.id,
      body,
    );
  }
}
