import { EventEmitter } from 'node:events';
import { Notification, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma.service';

export const NOTIFICATION_CREATED = 'notification.created';

export const notificationEvents = new EventEmitter();

export function publishNotification(notification: Notification) {
  notificationEvents.emit(NOTIFICATION_CREATED, notification);
}

export async function recordNotification(
  prisma: PrismaService,
  data: Prisma.NotificationUncheckedCreateInput,
) {
  const notification = await prisma.notification.create({ data });
  publishNotification(notification);
  return notification;
}
