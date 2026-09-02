import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useNotifications } from '../contexts/NotificationsContext';
import { useLang } from '../i18n';
import PastelIcon from './PastelIcon';

const NotificationButton = ({ compact = false }) => {
  const navigate = useNavigate();
  const { unreadCount } = useNotifications();
  const { t } = useLang();
  const label = t('notificationsTitle');
  return (
    <button
      type="button"
      aria-label={unreadCount ? `${label}, ${unreadCount} ${t('notificationsUnread').toLowerCase()}` : label}
      onClick={() => navigate('/notifications')}
      style={compact ? {
        width: '100%', padding: '12px 16px', background: 'none', border: 'none',
        textAlign: 'left', cursor: 'pointer', fontSize: 13, color: '#B08ABD',
        fontWeight: 600, transition: 'background 0.15s', display: 'flex', alignItems: 'center', gap: 8
      } : {
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
        minHeight: 38, padding: '7px 16px', borderRadius: 20,
        background: 'linear-gradient(135deg, #B5A2D8 0%, #DDA0DD 100%)',
        cursor: 'pointer', border: 'none', fontWeight: 600, color: 'white', fontSize: 12,
        position: 'relative'
      }}
    >
      <span style={{ display: 'inline-flex', alignItems: 'center' }}><PastelIcon name="bell" size={compact ? 16 : 15} /></span>
      <span>{label}</span>
      {unreadCount > 0 && (
        <span aria-hidden="true" style={{
          minWidth: 18, height: 18, padding: '0 5px', borderRadius: 10,
          background: '#E57373', color: 'white', fontSize: 10, fontWeight: 700,
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          marginLeft: compact ? 'auto' : 1
        }}>
          {unreadCount > 99 ? '99+' : unreadCount}
        </span>
      )}
    </button>
  );
};

export default NotificationButton;
