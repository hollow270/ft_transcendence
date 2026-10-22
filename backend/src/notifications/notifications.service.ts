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

  async createResourceEvent(input: {
    userId: string;
    type:
      | NotificationType.RESOURCE_CREATED
      | NotificationType.RESOURCE_UPDATED
      | NotificationType.RESOURCE_DELETED;
    entityType: string;
    entityId: string;
    message: string;
    artifactId?: string | null;
    commentId?: string | null;
    actorUserId?: string | null;
    metadata?: Record<string, unknown>;
  }) {
    const notification =
      await this.prisma.notification.create({
        data: {
          userId: input.userId,
          actorUserId:
            input.actorUserId ?? null,
          type: input.type,
          artifactId:
            input.artifactId ?? null,
          commentId:
            input.commentId ?? null,
          entityType: input.entityType,
          entityId: input.entityId,
          message: input.message,
          metadata:
            input.metadata ?? undefined,
        },
      });

    this.gateway.emitToUser(
      input.userId,
      'notification',
      notification,
    );

    return notification;
  }

  async createCommentReply(input: {
    recipientUserId: string;
    actorUserId: string;
    artifactId: string;
    commentId: string;
  }) {
    if (
      input.recipientUserId ===
      input.actorUserId
    ) {
      return null;
    }

    const notification =
      await this.prisma.notification.create({
        data: {
          userId:
            input.recipientUserId,
          actorUserId:
            input.actorUserId,
          type:
            NotificationType.COMMENT_REPLY,
          artifactId:
            input.artifactId,
          commentId:
            input.commentId,
          entityType: 'comment',
          entityId:
            input.commentId,
          message:
            'Someone replied to your comment.',
        },
      });

    this.gateway.emitToUser(
      input.recipientUserId,
      'notification',
      notification,
    );

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
