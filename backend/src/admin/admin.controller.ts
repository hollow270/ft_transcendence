import {
  Controller,
  Get,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import { Response } from 'express';
import { SessionAuthGuard } from '../auth/auth.guard';
import { AdminGuard } from './admin.guard';
import { AdminService } from './admin.service';

@Controller('admin')
@UseGuards(
  SessionAuthGuard,
  AdminGuard,
)
export class AdminController {
  constructor(
    private readonly admin:
      AdminService,
  ) {}

  @Get('overview')
  overview() {
    return this.admin.overview();
  }

  @Get('activity')
  activity(
    @Query('days') days?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.admin.activity(
      days,
      from,
      to,
    );
  }

  @Get('export.csv')
  async exportCsv(
    @Res() response: Response,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    const csv =
      await this.admin.exportCsv(
        from,
        to,
      );

    response.setHeader(
      'Content-Type',
      'text/csv; charset=utf-8',
    );
    response.setHeader(
      'Content-Disposition',
      'attachment; filename="go-virus-admin-metrics.csv"',
    );
    response.send(csv);
  }

  @Get('export.pdf')
  async exportPdf(
    @Res() response: Response,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    const pdf =
      await this.admin.exportPdf(
        from,
        to,
      );

    response.setHeader(
      'Content-Type',
      'application/pdf',
    );
    response.setHeader(
      'Content-Disposition',
      'attachment; filename="go-virus-admin-analytics.pdf"',
    );
    response.send(pdf);
  }
}
