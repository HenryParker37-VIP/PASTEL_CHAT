import React, { useEffect, useRef } from 'react';
import PastelIcon from './PastelIcon';
import { useLang } from '../i18n';

const RefreshChatModal = ({ open, onClose, onClear, onKeep, loading = false }) => {
  const { t } = useLang();
  const dialogRef = useRef(null);
  const lastFocusedRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    lastFocusedRef.current = document.activeElement;
    const focusTimer = window.setTimeout(() => {
      dialogRef.current?.querySelector('[data-initial-focus]')?.focus();
    }, 50);

    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        if (!loading) {
          event.preventDefault();
          onClose();
        }
        return;
      }
      if (event.key !== 'Tab' || !dialogRef.current) return;
      const focusable = [
        ...dialogRef.current.querySelectorAll(
          'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled])'
        )
      ];
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      }
      if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', onKeyDown);
    return () => {
      window.clearTimeout(focusTimer);
      document.removeEventListener('keydown', onKeyDown);
      lastFocusedRef.current?.focus?.();
    };
  }, [open, onClose, loading]);

  if (!open) return null;

  return (
    <div
      className="feedback-backdrop"
      role="presentation"
      onMouseDown={() => {
        if (!loading) onClose();
      }}
    >
      <section
        ref={dialogRef}
        className="feedback-modal refresh-chat-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="refresh-chat-title"
        aria-describedby="refresh-chat-message"
        onMouseDown={(event) => event.stopPropagation()}
        style={{
          width: 'min(420px, 92vw)',
          borderRadius: 24,
          padding: '24px 22px 20px',
          background: 'var(--card-bg, #FFFDF9)',
          boxShadow: '0 20px 50px rgba(64, 40, 76, 0.25)',
          border: '1px solid rgba(221, 160, 221, 0.35)'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 14 }}>
          <div
            className="feedback-modal__icon"
            style={{
              width: 44,
              height: 44,
              borderRadius: 15,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: '#F4EAFE',
              color: '#8A62A8',
              flexShrink: 0,
              margin: 0
            }}
          >
            <PastelIcon name="refresh" size={22} />
          </div>
          <h2
            id="refresh-chat-title"
            style={{
              margin: 0,
              color: 'var(--text, #332643)',
              fontSize: 18,
              fontWeight: 700,
              lineHeight: 1.25
            }}
          >
            {t('refreshChatModalTitle') || 'Refresh Chat'}
          </h2>
        </div>

        <div className="feedback-modal__content" style={{ marginBottom: 22 }}>
          <p
            id="refresh-chat-message"
            style={{
              margin: 0,
              color: 'var(--subtext, #7A6E8A)',
              fontSize: 14,
              lineHeight: 1.55,
              overflowWrap: 'anywhere'
            }}
          >
            {t('refreshChatModalMessage') || 'Wanna clear this chat and start a new one, or keep this current chat?'}
          </p>
        </div>

        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 10
          }}
        >
          {/* Button 1: Clear & Start New */}
          <button
            type="button"
            data-initial-focus
            disabled={loading}
            onClick={onClear}
            style={{
              width: '100%',
              minHeight: 44,
              padding: '10px 18px',
              borderRadius: 14,
              border: 'none',
              background: 'linear-gradient(135deg, #FF9EAA, #FF8FA3)',
              color: '#FFFFFF',
              fontWeight: 600,
              fontSize: 14,
              cursor: loading ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              boxShadow: '0 3px 10px rgba(255, 143, 163, 0.35)',
              transition: 'transform 0.15s, opacity 0.15s',
              opacity: loading ? 0.7 : 1
            }}
            onMouseEnter={(e) => !loading && (e.currentTarget.style.transform = 'scale(1.01)')}
            onMouseLeave={(e) => (e.currentTarget.style.transform = 'scale(1)')}
          >
            <PastelIcon name="trash" size={16} />
            <span>{t('refreshChatBtnClear') || 'Clear & Start New'}</span>
          </button>

          {/* Button 2: Keep & Start New */}
          <button
            type="button"
            disabled={loading}
            onClick={onKeep}
            style={{
              width: '100%',
              minHeight: 44,
              padding: '10px 18px',
              borderRadius: 14,
              border: '1px solid rgba(221, 160, 221, 0.45)',
              background: 'rgba(244, 234, 254, 0.65)',
              color: '#6B4C85',
              fontWeight: 600,
              fontSize: 14,
              cursor: loading ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              transition: 'background 0.15s, transform 0.15s',
              opacity: loading ? 0.7 : 1
            }}
            onMouseEnter={(e) => !loading && (e.currentTarget.style.background = 'rgba(244, 234, 254, 0.95)')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'rgba(244, 234, 254, 0.65)')}
          >
            <PastelIcon name="notebook" size={16} />
            <span>{t('refreshChatBtnKeep') || 'Keep & Start New'}</span>
          </button>

          {/* Button 3: Cancel */}
          <button
            type="button"
            disabled={loading}
            onClick={onClose}
            style={{
              width: '100%',
              minHeight: 42,
              padding: '8px 18px',
              borderRadius: 14,
              border: 'none',
              background: 'transparent',
              color: 'var(--subtext, #888)',
              fontWeight: 500,
              fontSize: 13,
              cursor: loading ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'background 0.15s'
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(0, 0, 0, 0.04)')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
          >
            <span>{t('refreshChatBtnCancel') || t('cancel') || 'Cancel'}</span>
          </button>
        </div>
      </section>
    </div>
  );
};

export default RefreshChatModal;
