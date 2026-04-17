import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';

const ToastContext = createContext(null);

export const useToast = () => {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
};

export const ToastProvider = ({ children }) => {
  const [toasts, setToasts] = useState([]);

  const push = useCallback((toast) => {
    const id = Math.random().toString(36).slice(2);
    setToasts((t) => [...t, { id, ...toast }]);
    setTimeout(() => {
      setToasts((t) => t.filter((x) => x.id !== id));
    }, toast.duration || 3800);
  }, []);

  return (
    <ToastContext.Provider value={{ push }}>
      {children}
      <div className="toast-stack">
        {toasts.map((t) => (
          <ToastCard key={t.id} toast={t} />
        ))}
      </div>
    </ToastContext.Provider>
  );
};

const ToastCard = ({ toast }) => {
  const [leaving, setLeaving] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setLeaving(true), (toast.duration || 3800) - 400);
    return () => clearTimeout(timer);
  }, [toast]);
  return (
    <div className={`toast toast-in ${leaving ? 'slide-out-right' : ''}`}>
      {toast.emoji && <span style={{ fontSize: 22 }}>{toast.emoji}</span>}
      <div>
        <p className="toast-title">{toast.title}</p>
        {toast.body && <p className="toast-body">{toast.body}</p>}
      </div>
    </div>
  );
};

export default ToastProvider;
