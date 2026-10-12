import {
  Controller,
  Get,
  Param,
  Patch,
  Req,
  UseGuards,
} from '@nestjs/common';
import { SessionAuthGuard } from '../auth/auth.guard';
import { NotificationsService } from './notifications.service';

@UseGuards(SessionAuthGuard)
@Controller('notifications')
export class NotificationsController {
  constructor(
    private readonly notifications: NotificationsService,
  ) {}

  @Get()
  list(@Req() request: any) {
    return this.notifications.listForUser(request.user.id);
  }

  @Patch(':notificationId/read')
  markRead(
    @Param('notificationId') notificationId: string,
    @Req() request: any,
  ) {
    return this.notifications.markRead(
      request.user.id,
      notificationId,
    );
  }
}
