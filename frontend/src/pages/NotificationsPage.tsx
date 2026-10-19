import { useEffect, useMemo, useState } from 'react';
import { io } from 'socket.io-client';
import { api } from '../api';
import { useAuth } from '../auth';
import type { Notification } from '../types';

function formatDate(value?: string | null) {
  if (!value) return '—';
  return new Date(value).toLocaleString();
}

export default function NotificationsPage() {
  const { token, user } = useAuth();
  const [items, setItems] = useState<Notification[]>([]);
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

  async function markRead(notification: Notification) {
    if (!token || notification.readAt) return;

    try {
      const updated = await api.markNotificationRead(notification.id, token);
      setItems((current) =>
        current.map((item) => (item.id === updated.id ? updated : item)),
      );
    } catch {
      // Keep the page usable if acknowledgement fails.
    }
  }

  if (!user) {
    return (
      <main className="mx-auto max-w-4xl px-4 py-12 sm:px-6">
        <div className="border border-[#263753] bg-[#11192b] p-6">
          <h1 className="text-2xl font-semibold">Notifications</h1>
          <p className="mt-3 text-sm text-slate-400">Sign in to view your notifications.</p>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
      <div className="flex items-end justify-between border-b border-[#263753] pb-4">
        <div>
          <h1 className="text-2xl font-semibold">Notifications</h1>
          <p className="mt-1 text-sm text-slate-500">Scan, reply, moderation and system events.</p>
        </div>
        <span className="text-sm text-cyan-400">{unread} unread</span>
      </div>

      {error && (
        <div className="mt-4 border border-red-500/30 bg-red-950/20 p-4 text-sm text-red-300">
          {error}
        </div>
      )}

      <div className="mt-4">
        {items.length ? (
          items.map((notification) => (
            <button
              key={notification.id}
              className={
                'block w-full border-b border-[#263753] px-2 py-4 text-left ' +
                (notification.readAt ? 'opacity-60' : '')
              }
              onClick={() => void markRead(notification)}
            >
              <div className="flex flex-wrap justify-between gap-2">
                <span className="text-xs font-semibold uppercase tracking-wide text-cyan-400">
                  {notification.type.replace(/_/g, ' ')}
                </span>
                <span className="text-xs text-slate-600">{formatDate(notification.createdAt)}</span>
              </div>
              <p className="mt-2 text-sm text-slate-300">
                {notification.message ?? 'New notification'}
              </p>
            </button>
          ))
        ) : (
          <p className="py-8 text-sm text-slate-500">No notifications yet.</p>
        )}
      </div>
    </main>
  );
}
