import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useAuth } from './AuthContext';
import { useSocket } from './SocketContext';
import api from '../services/api';

const NotificationsContext = createContext(null);

const notificationCopy = (payload) => {
  if (payload.type === 'friend_requested') return { title: 'Lời mời kết bạn mới', body: `${payload.from?.name || 'Một người bạn'} muốn kết bạn với bạn.` };
  if (payload.type === 'friend_accepted') return { title: 'Lời mời kết bạn đã được chấp nhận', body: `${payload.from?.name || 'Bạn của bạn'} đã trở thành bạn bè với bạn.` };
  if (payload.type === 'new_message') return { title: `Tin nhắn mới từ ${payload.from?.name || 'bạn bè'}`, body: payload.preview || 'Bạn nhận được một tin nhắn mới.' };
  if (payload.type === 'group_message') return { title: payload.groupName || 'Tin nhắn nhóm', body: `${payload.from?.name || 'Bạn bè'}: ${payload.preview || 'Có tin nhắn mới.'}` };
  if (payload.type === 'group_created' || payload.type === 'group_invited') return { title: 'Bạn được mời vào nhóm', body: `Bạn đã được thêm vào nhóm “${payload.group?.name || 'mới'}”.` };
  return null;
};

export const NotificationsProvider = ({ children }) => {
  const { user } = useAuth();
  const { socket } = useSocket();
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
      const copy = notificationCopy(payload);
      if (!copy) return;
      const notification = {
        _id: payload.notificationId || `live-${Date.now()}`,
        type: payload.type,
        title: copy.title,
        body: copy.body,
        from: payload.from || null,
        data: { ...payload },
        read: false,
        createdAt: new Date().toISOString()
      };
      setNotifications((current) => [notification, ...current.filter(item => item._id !== notification._id)].slice(0, 60));
    };
    socket.on(`notify:${user._id}`, handleNotification);
    return () => socket.off(`notify:${user._id}`, handleNotification);
  }, [socket, user]);

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
