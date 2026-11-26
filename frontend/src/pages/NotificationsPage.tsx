import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../auth';
import { PageHeader, StatusNotice } from '../components';
import { notificationTarget } from '../notificationTarget';
import { useNotifications } from '../notifications';
import type { Notification } from '../types';

function formatDate(value?: string | null) {
  if (!value) return '—';
  return new Date(value).toLocaleString();
}

const rowClass = (notification: Notification) =>
  'flex w-full gap-4 border-b border-slate-800 px-5 py-4 text-left last:border-b-0 hover:bg-slate-800/30 ' +
  (notification.readAt ? 'opacity-65' : '');

function NotificationBody({
  notification,
  actionLabel,
}: {
  notification: Notification;
  actionLabel?: string;
}) {
  return (
    <>
      <span
        className={
          'mt-1 h-2 w-2 shrink-0 rounded-full ' +
          (notification.readAt ? 'bg-slate-700' : 'bg-blue-500')
        }
      />
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-xs font-semibold text-slate-500">
            {notification.type.replace(/_/g, ' ')}
          </span>
          <span className="text-xs text-slate-600">{formatDate(notification.createdAt)}</span>
        </span>
        <span className="mt-1.5 block text-sm text-slate-300">
          {notification.message ?? 'New notification'}
        </span>
        {actionLabel && (
          <span className="mt-1.5 block text-xs font-medium text-blue-400">{actionLabel} →</span>
        )}
      </span>
    </>
  );
}

export default function NotificationsPage() {
  const { user } = useAuth();
  const { items, unread, error, markRead, markAllRead } = useNotifications();
  const [filter, setFilter] = useState<'all' | 'unread'>('all');

  const visibleItems = useMemo(
    () => (filter === 'unread' ? items.filter((notification) => !notification.readAt) : items),
    [items, filter],
  );

  if (!user) {
    return (
      <div className="app-page">
        <PageHeader title="Notifications" description="Scan, reply, moderation and system events." />
        <StatusNotice title="Sign in required">
          Notifications belong to a registered account.
        </StatusNotice>
      </div>
    );
  }

  return (
    <div className="app-page">
      <PageHeader
        title="Notifications"
        description="Scan, reply, moderation and system events."
        actions={<span className="text-sm text-slate-500">{unread} unread</span>}
      />

      <section className="surface overflow-hidden">
        <div className="surface-header flex items-center justify-between gap-4">
          <div className="flex gap-1 rounded-md bg-slate-950 p-1">
            <button
              className={'rounded px-3 py-1.5 text-sm ' + (filter === 'all' ? 'bg-slate-800 text-white' : 'text-slate-500')}
              onClick={() => setFilter('all')}
            >
              All
            </button>
            <button
              className={'rounded px-3 py-1.5 text-sm ' + (filter === 'unread' ? 'bg-slate-800 text-white' : 'text-slate-500')}
              onClick={() => setFilter('unread')}
            >
              Unread
            </button>
          </div>
          <button
            className="secondary-button"
            disabled={unread === 0}
            onClick={() => void markAllRead()}
          >
            Mark all as read
          </button>
        </div>

        {error && (
          <div role="alert" className="border-b border-red-900 bg-red-950/30 px-5 py-3 text-sm text-red-300">
            {error}
          </div>
        )}

        {visibleItems.length ? (
          <div>
            {visibleItems.map((notification) => {
              const target = notificationTarget(notification);

              return target ? (
                <Link
                  key={notification.id}
                  to={target.to}
                  className={rowClass(notification)}
                  onClick={() => void markRead(notification)}
                >
                  <NotificationBody notification={notification} actionLabel={target.label} />
                </Link>
              ) : (
                <button
                  key={notification.id}
                  className={rowClass(notification)}
                  onClick={() => void markRead(notification)}
                >
                  <NotificationBody notification={notification} />
                </button>
              );
            })}
          </div>
        ) : (
          <div className="empty-state">
            <p className="text-sm font-semibold text-slate-300">
              {filter === 'unread' ? 'No unread notifications' : 'No notifications yet'}
            </p>
            <p className="mt-1 text-sm text-slate-500">
              New scan and account events will appear here.
            </p>
          </div>
        )}
      </section>
    </div>
  );
}
