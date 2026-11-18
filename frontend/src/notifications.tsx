import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { io } from 'socket.io-client';
import { api } from './api';
import { useAuth } from './auth';
import type { Notification } from './types';

const MAX_ITEMS = 200;

type NotificationsValue = {
  items: Notification[];
  unread: number;
  error: string | null;
  refresh: () => Promise<void>;
  markRead: (notification: Notification) => Promise<void>;
  markAllRead: () => Promise<void>;
};

const NotificationsContext = createContext<NotificationsValue | null>(null);

function upsert(current: Notification[], incoming: Notification) {
  return [incoming, ...current.filter((item) => item.id !== incoming.id)].slice(0, MAX_ITEMS);
}

export function NotificationsProvider({ children }: { children: ReactNode }) {
  const { token, user } = useAuth();
  const [items, setItems] = useState<Notification[]>([]);
  const [error, setError] = useState<string | null>(null);
  const tokenRef = useRef(token);
  tokenRef.current = token;

  const refresh = useCallback(async () => {
    const current = tokenRef.current;
    if (!current) return;
    try {
      const list = await api.notifications(current);
      if (tokenRef.current === current) {
        setItems(list);
        setError(null);
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not load notifications');
    }
  }, []);

  useEffect(() => {
    if (!token || !user) {
      setItems([]);
      setError(null);
      return;
    }

    void refresh();

    const socket = io(window.location.origin, {
      path: '/socket.io',
      auth: { token },
      transports: ['websocket', 'polling'],
    });

    let connectedBefore = false;
    socket.on('connect', () => {
      if (connectedBefore) void refresh();
      connectedBefore = true;
    });
    socket.on('notification', (notification: Notification) => {
      setItems((current) => upsert(current, notification));
    });

    return () => {
      socket.disconnect();
    };
  }, [token, user, refresh]);

  const markRead = useCallback(async (notification: Notification) => {
    const current = tokenRef.current;
    if (!current || notification.readAt) return;

    const stamp = new Date().toISOString();
    setItems((list) =>
      list.map((item) => (item.id === notification.id ? { ...item, readAt: stamp } : item)),
    );

    try {
      const updated = await api.markNotificationRead(notification.id, current);
      setItems((list) => list.map((item) => (item.id === updated.id ? updated : item)));
    } catch {
      setItems((list) =>
        list.map((item) => (item.id === notification.id ? { ...item, readAt: null } : item)),
      );
    }
  }, []);

  const markAllRead = useCallback(async () => {
    const current = tokenRef.current;
    if (!current) return;

    const stamp = new Date().toISOString();
    setItems((list) => list.map((item) => (item.readAt ? item : { ...item, readAt: stamp })));

    try {
      await api.markAllNotificationsRead(current);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not mark notifications as read');
      void refresh();
    }
  }, [refresh]);

  const value = useMemo<NotificationsValue>(
    () => ({
      items,
      unread: items.filter((item) => !item.readAt).length,
      error,
      refresh,
      markRead,
      markAllRead,
    }),
    [items, error, refresh, markRead, markAllRead],
  );

  return <NotificationsContext.Provider value={value}>{children}</NotificationsContext.Provider>;
}

export function useNotifications() {
  const value = useContext(NotificationsContext);
  if (!value) throw new Error('useNotifications must be used inside NotificationsProvider');
  return value;
}
