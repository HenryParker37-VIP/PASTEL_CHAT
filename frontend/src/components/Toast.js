import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import PastelIcon from './PastelIcon';
import { useLang } from '../i18n';

const ToastContext = createContext(null);
const ConfirmContext = createContext(null);

export const useToast = () => {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
};

export const useConfirm = () => {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error('useConfirm must be used within ConfirmProvider');
  return ctx;
};

export const ToastProvider = ({ children }) => {
  const [toasts, setToasts] = useState([]);

  const push = useCallback((toast) => {
    const id = Math.random().toString(36).slice(2);
    setToasts((t) => [...t, { id, tone: 'info', ...toast }]);
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
    <div className={`toast toast--${toast.tone || 'info'} toast-in ${leaving ? 'toast-out' : ''}`} role="status">
      {toast.icon && <PastelIcon name={toast.icon} size={22} title={toast.title} />}
      <div>
        <p className="toast-title">{toast.title}</p>
        {toast.body && <p className="toast-body">{toast.body}</p>}
      </div>
    </div>
  );
};

export const ConfirmProvider = ({ children }) => {
  const { t } = useLang();
  const [request, setRequest] = useState(null);
  const [closing, setClosing] = useState(false);
  const dialogRef = useRef(null);
  const lastFocusedRef = useRef(null);

  const confirm = useCallback((options = {}) => new Promise((resolve) => {
    lastFocusedRef.current = document.activeElement;
    setClosing(false);
    setRequest({
      title: options.title || t('feedbackConfirmTitle'),
      message: options.message || '',
      confirmLabel: options.confirmLabel || t('confirm'),
      cancelLabel: options.cancelLabel || t('cancel'),
      tone: options.tone || 'default',
      icon: options.icon || (options.tone === 'danger' ? 'alert' : 'check'),
      resolve,
    });
  }), [t]);

  const settle = useCallback((accepted) => {
    if (!request || closing) return;
    setClosing(true);
    window.setTimeout(() => {
      const activeRequest = request;
      setRequest(null);
      setClosing(false);
      activeRequest.resolve(accepted);
      lastFocusedRef.current?.focus?.();
    }, 180);
  }, [closing, request]);

  useEffect(() => {
    if (!request) return undefined;
    const focusTimer = window.setTimeout(() => {
      dialogRef.current?.querySelector('[data-confirm-cancel]')?.focus();
    }, 0);
    const onKeyDown = (event) => {
      if (event.key === 'Escape') { event.preventDefault(); settle(false); return; }
      if (event.key !== 'Tab' || !dialogRef.current) return;
      const focusable = [...dialogRef.current.querySelectorAll('button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled])')];
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => { window.clearTimeout(focusTimer); document.removeEventListener('keydown', onKeyDown); };
  }, [request, settle]);

  return (
    <ConfirmContext.Provider value={{ confirm }}>
      {children}
      {request && (
        <div className={`feedback-backdrop ${closing ? 'feedback-backdrop--out' : ''}`} role="presentation" onMouseDown={() => settle(false)}>
          <section
            ref={dialogRef}
            className={`feedback-modal feedback-modal--${request.tone} ${closing ? 'feedback-modal--out' : ''}`}
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="feedback-confirm-title"
            aria-describedby="feedback-confirm-message"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="feedback-modal__icon"><PastelIcon name={request.icon} size={23} /></div>
            <div className="feedback-modal__content">
              <h2 id="feedback-confirm-title">{request.title}</h2>
              {request.message && <p id="feedback-confirm-message">{request.message}</p>}
            </div>
            <div className="feedback-modal__actions">
              <button type="button" className="btn btn-ghost" data-confirm-cancel onClick={() => settle(false)}>{request.cancelLabel}</button>
              <button type="button" className={`btn feedback-modal__confirm feedback-modal__confirm--${request.tone}`} onClick={() => settle(true)}>{request.confirmLabel}</button>
            </div>
          </section>
        </div>
      )}
    </ConfirmContext.Provider>
  );
};

export default ToastProvider;
