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

    // Use explicit backend URL instead of detection logic
    const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'https://pastel-chat.onrender.com';
    console.log('[Socket] Connecting to:', BACKEND_URL);

    const newSocket = io(
      BACKEND_URL,
      {
        auth: { token },
        transports: ['websocket', 'polling'],
        reconnectionAttempts: 5,
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
