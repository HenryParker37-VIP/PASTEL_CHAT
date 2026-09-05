import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from './AuthContext';

const SocketContext = createContext(null);

export const useSocket = () => {
  const ctx = useContext(SocketContext);
  if (!ctx) throw new Error('useSocket must be used within SocketProvider');
  return ctx;
};

export const SocketProvider = ({ children }) => {
  const [socket, setSocket] = useState(null);
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [connected, setConnected] = useState(false);
  const { getToken, user } = useAuth();
  const socketRef = useRef(null);

  useEffect(() => {
    const token = getToken();
    if (!token || !user) return;

    // Connect to dedicated signaling server if configured, or current origin
    const SIGNALING_URL = process.env.REACT_APP_SIGNALING_URL || process.env.REACT_APP_BACKEND_URL || (typeof window !== 'undefined' ? window.location.origin : '');
    console.log('[Socket] Connecting to:', SIGNALING_URL || '(current origin)');

    const newSocket = io(
      SIGNALING_URL,
      {
        auth: { token },
        transports: ['websocket', 'polling'],
        reconnectionAttempts: Infinity,
        reconnectionDelay: 1000
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
    newSocket.on('connect_error', (err) => {
      console.error('[Socket] Connection error:', err);
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
    <SocketContext.Provider value={{ socket, onlineUsers, connected }}>
      {children}
    </SocketContext.Provider>
  );
};
