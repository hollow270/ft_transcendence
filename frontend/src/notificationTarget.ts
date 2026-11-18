import type { Notification } from './types';

export type NotificationTarget = {
  to: string;
  label: string;
};

export function notificationTarget(notification: Notification): NotificationTarget | null {
  const { artifactId } = notification;
  if (!artifactId) return null;

  const base = '/app/artifact/' + encodeURIComponent(artifactId);

  if (notification.type === 'SCAN_COMPLETED' || notification.entityType === 'scan') {
    const scan =
      notification.entityType === 'scan' && notification.entityId
        ? '&scan=' + encodeURIComponent(notification.entityId)
        : '';
    return {
      to: base + '?tab=detection' + scan,
      label: notification.type === 'SCAN_COMPLETED' ? 'View scan report' : 'View scan',
    };
  }

  if (notification.entityType === 'community_vote') {
    return { to: base + '?tab=community', label: 'View community verdict' };
  }

  if (notification.commentId || notification.entityType === 'comment') {
    if (notification.type === 'RESOURCE_DELETED' || !notification.commentId) {
      return { to: base + '?tab=community', label: 'Open discussion' };
    }

    return {
      to: base + '?tab=community&comment=' + encodeURIComponent(notification.commentId),
      label: notification.type === 'COMMENT_REPLY' ? 'View reply' : 'View comment',
    };
  }

  if (notification.entityType === 'submission' && notification.type !== 'RESOURCE_DELETED') {
    return { to: base + '?tab=detection', label: 'View report' };
  }

  return null;
}
