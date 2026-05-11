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

    // Determine backend URL: env var → current domain → localhost fallback
    function getBackendUrl() {
      // 1. Try environment variable (Vercel, production builds)
      if (typeof process !== 'undefined' && process.env?.REACT_APP_BACKEND_URL) {
        return process.env.REACT_APP_BACKEND_URL;
      }

      // 2. On deployed site (Vercel), use same origin as frontend
      if (typeof window !== 'undefined') {
        const host = window.location.host;
        const protocol = window.location.protocol;

        // If on Vercel or custom domain, assume backend is at same domain
        if (host.includes('vercel.app') || host.includes('pastel-chat.com')) {
          return `${protocol}//${host}`;
        }
      }

      // 3. Development fallback
      return 'http://localhost:5001';
    }

    const BACKEND_URL = getBackendUrl();

    const newSocket = io(
      BACKEND_URL,
      {
        auth: { token },
        transports: ['websocket', 'polling'],
        reconnectionAttempts: 5,
        reconnectionDelay: 1000
      }
    );

    newSocket.on('connect', () => setConnected(true));
    newSocket.on('disconnect', () => setConnected(false));
    newSocket.on('online_users', (users) => setOnlineUsers(users));

    socketRef.current = newSocket;
    setSocket(newSocket);

    return () => {
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
