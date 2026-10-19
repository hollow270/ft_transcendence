import { useEffect, useMemo, useState } from 'react';
import { io } from 'socket.io-client';
import { api } from '../api';
import { useAuth } from '../auth';
import { PageHeader, StatusNotice } from '../components';
import type { Notification } from '../types';

function formatDate(value?: string | null) {
  if (!value) return '—';
  return new Date(value).toLocaleString();
}

export default function NotificationsPage() {
  const { token, user } = useAuth();
  const [items, setItems] = useState<Notification[]>([]);
  const [filter, setFilter] = useState<'all' | 'unread'>('all');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token || !user) {
      setItems([]);
      return;
    }

    api.notifications(token).then(setItems).catch((caught) => {
      setError(caught instanceof Error ? caught.message : 'Could not load notifications');
    });

    const socket = io(window.location.origin, {
      path: '/socket.io',
      auth: { token },
      transports: ['websocket', 'polling'],
    });

    socket.on('notification', (notification: Notification) => {
      setItems((current) => [
        notification,
        ...current.filter((item) => item.id !== notification.id),
      ]);
    });

    return () => {
      socket.disconnect();
    };
  }, [token, user]);

  const unread = useMemo(
    () => items.filter((notification) => !notification.readAt).length,
    [items],
  );

  const visibleItems = filter === 'unread'
    ? items.filter((notification) => !notification.readAt)
    : items;

  async function markRead(notification: Notification) {
    if (!token || notification.readAt) return;

    try {
      const updated = await api.markNotificationRead(notification.id, token);
      setItems((current) =>
        current.map((item) => (item.id === updated.id ? updated : item)),
      );
    } catch {
      // Notification acknowledgement should not block the page.
    }
  }

  if (!user) {
    return (
      <main className="app-page">
        <PageHeader title="Notifications" description="Scan, reply, moderation and system events." />
        <StatusNotice title="Sign in required">
          Notifications belong to a registered account.
        </StatusNotice>
      </main>
    );
  }

  return (
    <main className="app-page">
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
        </div>

        {error && (
          <div className="border-b border-red-900 bg-red-950/30 px-5 py-3 text-sm text-red-300">
            {error}
          </div>
        )}

        {visibleItems.length ? (
          <div>
            {visibleItems.map((notification) => (
              <button
                key={notification.id}
                className={
                  'flex w-full gap-4 border-b border-slate-800 px-5 py-4 text-left last:border-b-0 hover:bg-slate-800/30 ' +
                  (notification.readAt ? 'opacity-65' : '')
                }
                onClick={() => void markRead(notification)}
              >
                <span
                  className={
                    'mt-1 h-2 w-2 shrink-0 rounded-full ' +
                    (notification.readAt ? 'bg-slate-700' : 'bg-blue-500')
                  }
                />
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      {notification.type.replace(/_/g, ' ')}
                    </span>
                    <span className="text-xs text-slate-600">{formatDate(notification.createdAt)}</span>
                  </span>
                  <span className="mt-1.5 block text-sm text-slate-300">
                    {notification.message ?? 'New notification'}
                  </span>
                </span>
              </button>
            ))}
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
    </main>
  );
}
