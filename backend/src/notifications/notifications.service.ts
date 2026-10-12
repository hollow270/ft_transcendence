import { Injectable, NotFoundException } from '@nestjs/common';
import { NotificationType } from '@prisma/client';
import { PrismaService } from '../prisma.service';
import { NotificationsGateway } from './notifications.gateway';

@Injectable()
export class NotificationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly gateway: NotificationsGateway,
  ) {}

  async createScanCompleted(
    userId: string,
    artifactId: string,
    scanId: string,
  ) {
    const notification = await this.prisma.notification.create({
      data: {
        userId,
        type: NotificationType.SCAN_COMPLETED,
        artifactId,
        entityType: 'scan',
        entityId: scanId,
        message: 'Your file scan is complete.',
      },
    });

    this.gateway.emitToUser(userId, 'notification', notification);
    return notification;
  }

  listForUser(userId: string) {
    return this.prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  async markRead(userId: string, notificationId: string) {
    const notification = await this.prisma.notification.findFirst({
      where: {
        id: notificationId,
        userId,
      },
    });

    if (!notification) {
      throw new NotFoundException('notification not found');
    }

    return this.prisma.notification.update({
      where: { id: notificationId },
      data: { readAt: new Date() },
    });
  }
}
