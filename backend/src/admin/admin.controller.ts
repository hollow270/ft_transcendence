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
@UseGuards(SessionAuthGuard, AdminGuard)
export class AdminController {
  constructor(private readonly admin: AdminService) {}

  @Get('overview')
  overview() {
    return this.admin.overview();
  }

  @Get('activity')
  activity(@Query('days') days?: string) {
    return this.admin.activity(days);
  }

  @Get('export.csv')
  async exportCsv(@Res() response: Response) {
    const csv = await this.admin.exportCsv();

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
}
