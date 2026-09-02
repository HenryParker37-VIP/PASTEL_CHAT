import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useAuth } from './AuthContext';
import { useSocket } from './SocketContext';
import api from '../services/api';
import { useLang } from '../i18n';

const NotificationsContext = createContext(null);

const notificationCopy = (payload, t) => {
  if (payload.type === 'friend_requested') return { title: t('notificationsFriendRequest'), body: t('notificationsFriendRequestBody', payload.from?.name || 'a friend') };
  if (payload.type === 'friend_accepted') return { title: t('notificationsFriendAccepted'), body: t('notificationsFriendAcceptedBody', payload.from?.name || 'a friend') };
  if (payload.type === 'new_message') return { title: t('notificationsNewMessage', payload.from?.name), body: payload.preview || t('notificationsNewMessage', '') };
  if (payload.type === 'group_message') return { title: payload.groupName || t('notificationsGroupMessage'), body: `${payload.from?.name || t('you')}: ${payload.preview || ''}` };
  if (payload.type === 'group_created' || payload.type === 'group_invited') return { title: t('notificationsGroupAdded'), body: payload.body || '' };
  if (payload.type === 'release_published') return { title: t('releaseNotificationTitle'), body: t('releaseNotificationBody', payload.releaseVersion || payload.data?.releaseVersion) };
  return null;
};

const notificationRoute = (payload) => {
  if (payload.data?.route) return payload.data.route;
  if (payload.route) return payload.route;
  if (payload.type === 'new_message' && payload.from?._id) return `/chat/${payload.from._id}`;
  if (payload.type === 'friend_requested' || payload.type === 'friend_accepted' || payload.type === 'friend_request') return '/friends';
  if ((payload.type === 'group_message' || payload.type === 'group_created' || payload.type === 'group_invited') && payload.groupId) return `/group/${payload.groupId}`;
  if (payload.type === 'release_published' && (payload.releaseVersion || payload.data?.releaseVersion)) return `/whats-new/${encodeURIComponent(payload.releaseVersion || payload.data.releaseVersion)}`;
  return null;
};

export const NotificationsProvider = ({ children }) => {
  const { user } = useAuth();
  const { socket } = useSocket();
  const { t } = useLang();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!user) {
      setNotifications([]);
      setLoading(false);
      return;
    }
    try {
      const { data } = await api.get('/notifications');
      setNotifications(data.notifications || []);
    } catch (error) {
      console.error('[Notifications] Failed to load:', error.message);
      setNotifications([]);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => { refresh(); }, [refresh]);

  useEffect(() => {
    if (!socket || !user) return undefined;
    const handleNotification = (payload) => {
      const copy = notificationCopy(payload, t);
      if (!copy) return;
      const notification = {
        _id: payload.notificationId || `live-${Date.now()}`,
        type: payload.type,
        title: copy.title,
        body: copy.body,
        from: payload.from || null,
        data: { ...payload, route: notificationRoute(payload) },
        read: false,
        createdAt: new Date().toISOString()
      };
      setNotifications((current) => [notification, ...current.filter(item => item._id !== notification._id)].slice(0, 60));
    };
    socket.on(`notify:${user._id}`, handleNotification);
    return () => socket.off(`notify:${user._id}`, handleNotification);
  }, [socket, user, t]);

  const markRead = useCallback(async (id) => {
    if (!id || String(id).startsWith('live-')) return;
    setNotifications(current => current.map(item => item._id === id ? { ...item, read: true } : item));
    try { await api.post(`/notifications/${id}/read`); } catch (error) { console.error('[Notifications] Failed to mark read:', error.message); }
  }, []);

  const markAllRead = useCallback(async () => {
    setNotifications(current => current.map(item => ({ ...item, read: true })));
    try { await api.post('/notifications/read-all'); } catch (error) { console.error('[Notifications] Failed to mark all read:', error.message); }
  }, []);

  const unreadCount = notifications.filter(item => !item.read).length;
  const value = useMemo(() => ({
    notifications,
    unreadCount,
    loading,
    refresh,
    markRead,
    markAllRead
  }), [notifications, unreadCount, loading, refresh, markRead, markAllRead]);

  return <NotificationsContext.Provider value={value}>{children}</NotificationsContext.Provider>;
};

export const useNotifications = () => {
  const context = useContext(NotificationsContext);
  if (!context) throw new Error('useNotifications must be used within NotificationsProvider');
  return context;
};
