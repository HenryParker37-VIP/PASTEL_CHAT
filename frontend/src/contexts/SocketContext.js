import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from './AuthContext';
import { realtimeEndpoint } from '../utils/realtimePolicy';

const SocketContext = createContext(null);

export const useSocket = () => {
  const ctx = useContext(SocketContext);
  if (!ctx) throw new Error('useSocket must be used within SocketProvider');
  return ctx;
};

export const SocketProvider = ({ children }) => {
  const [socket, setSocket] = useState(null);
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [lyraAvatar, setLyraAvatar] = useState(null);
  const [connected, setConnected] = useState(false);
  const { getToken, user } = useAuth();
  const socketRef = useRef(null);

  useEffect(() => {
    setLyraAvatar(null);
    const token = getToken();
    if (!token || !user) return;

    // An explicit relay URL enables the hybrid architecture. REST always stays
    // on the Vercel origin; no automatic Render fallback changes API routing.
    const relayUrl = (process.env.REACT_APP_REALTIME_RELAY_URL || '').trim();
    const SIGNALING_URL = realtimeEndpoint({
      relayUrl,
      signalingUrl: process.env.REACT_APP_SIGNALING_URL || '',
      backendUrl: process.env.REACT_APP_BACKEND_URL || '',
      origin: typeof window !== 'undefined' ? window.location.origin : ''
    });
    console.log('[Socket] Connecting to:', SIGNALING_URL || '(current origin)');

    const newSocket = io(
      SIGNALING_URL,
      {
        auth: { token },
        transports: ['websocket', 'polling'],
        reconnectionDelay: 2000,
        reconnectionDelayMax: 30000,
        timeout: 8000
      }
    );

    newSocket.on('connect', () => {
      console.log('[Socket] Connected to backend');
      setConnected(true);
    });
    newSocket.on('disconnect', () => {
      console.log('[Socket] Disconnected from backend');
      setConnected(false);
    });
    newSocket.on('online_users', (users) => setOnlineUsers(users));
    newSocket.on('user_updated', (data) => {
      if (data?.userId === 'user_ai_lyra' && typeof data.avatar === 'string') {
        setLyraAvatar(data.avatar);
      }
    });
    newSocket.on('connect_error', (err) => {
      console.info('[Socket] Optional realtime relay unavailable; REST sync remains active:', err?.message || err);
    });

    socketRef.current = newSocket;
    setSocket(newSocket);

    const reconnectOnResume = () => {
      if (!newSocket.connected) newSocket.connect();
    };
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') reconnectOnResume();
    };
    document.addEventListener('visibilitychange', onVisibilityChange);
    window.addEventListener('online', reconnectOnResume);
    let capacitorAppListener;
    import('@capacitor/app')
      .then(({ App }) => App.addListener('appStateChange', ({ isActive }) => {
        if (isActive) reconnectOnResume();
      }))
      .then((listener) => { capacitorAppListener = listener; })
      .catch(() => {});

    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange);
      window.removeEventListener('online', reconnectOnResume);
      capacitorAppListener?.remove?.();
      newSocket.close();
      socketRef.current = null;
    };
    // eslint-disable-next-line
  }, [user?._id]);

  return (
    <SocketContext.Provider value={{ socket, onlineUsers, connected, relayMode: Boolean(process.env.REACT_APP_REALTIME_RELAY_URL), lyraAvatar, setLyraAvatar }}>
      {children}
    </SocketContext.Provider>
  );
};
