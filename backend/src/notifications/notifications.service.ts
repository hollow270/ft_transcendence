import { Injectable, NotFoundException } from '@nestjs/common';
import {
  NotificationType,
  Prisma,
} from '@prisma/client';
import { PrismaService } from '../prisma.service';
import { recordNotification } from './notification-events';

@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  async createScanCompleted(
    userId: string,
    artifactId: string,
    scanId: string,
  ) {
    return recordNotification(this.prisma, {
      userId,
      type: NotificationType.SCAN_COMPLETED,
      artifactId,
      entityType: 'scan',
      entityId: scanId,
      message: 'Your file scan is complete.',
    });
  }

  async createResourceEvent(input: {
    userId: string;
    type: NotificationType;
    entityType: string;
    entityId: string;
    message: string;
    artifactId?: string | null;
    commentId?: string | null;
    actorUserId?: string | null;
    metadata?: Prisma.InputJsonValue;
  }) {
    return recordNotification(this.prisma, {
      userId: input.userId,
      actorUserId: input.actorUserId ?? null,
      type: input.type,
      artifactId: input.artifactId ?? null,
      commentId: input.commentId ?? null,
      entityType: input.entityType,
      entityId: input.entityId,
      message: input.message,
      metadata: input.metadata ?? undefined,
    });
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

    return recordNotification(this.prisma, {
      userId: input.recipientUserId,
      actorUserId: input.actorUserId,
      type: NotificationType.COMMENT_REPLY,
      artifactId: input.artifactId,
      commentId: input.commentId,
      entityType: 'comment',
      entityId: input.commentId,
      message: 'Someone replied to your comment.',
    });
  }

  async createCommentReceived(input: {
    recipientUserIds: string[];
    actorUserId: string;
    artifactId: string;
    commentId: string;
  }) {
    const recipients = [
      ...new Set(input.recipientUserIds),
    ].filter((id) => id !== input.actorUserId);

    for (const recipientUserId of recipients) {
      await recordNotification(this.prisma, {
        userId: recipientUserId,
        actorUserId: input.actorUserId,
        type: NotificationType.COMMENT_RECEIVED,
        artifactId: input.artifactId,
        commentId: input.commentId,
        entityType: 'comment',
        entityId: input.commentId,
        message: 'Someone commented on your submission.',
      });
    }
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

  async markAllRead(userId: string) {
    const result = await this.prisma.notification.updateMany({
      where: { userId, readAt: null },
      data: { readAt: new Date() },
    });

    return { updated: result.count };
  }
}
