import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLang } from '../i18n';
import { useNotifications } from '../contexts/NotificationsContext';
import PastelIcon from '../components/PastelIcon';
import { getPastelIdentity } from '../utils/pastelIdentity';

const iconForType = (type) => {
  if (type === 'new_message' || type === 'group_message') return 'chat-friends';
  if (type === 'friend_requested' || type === 'friend_accepted') return 'users';
  return 'bell';
};

const Notifications = () => {
  const navigate = useNavigate();
  const { t } = useLang();
  const { notifications, loading, markRead, markAllRead } = useNotifications();

  useEffect(() => {
    if (notifications.some(item => !item.read)) markAllRead();
  }, [notifications, markAllRead]);

  const openNotification = async (item) => {
    await markRead(item._id);
    const route = item.data?.route;
    if (route) navigate(route);
  };

  return (
    <div className="container">
      <button className="btn btn-ghost" onClick={() => navigate('/home')} style={{ marginBottom: 18 }}>
        {t('back')}
      </button>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, marginBottom: 20 }}>
        <div>
          <h2 style={{ margin: '4px 0 6px' }}>Thông báo</h2>
          <p style={{ color: '#888', fontSize: 14, margin: 0 }}>Cập nhật về tin nhắn, bạn bè và hoạt động trong Pastel Chat.</p>
        </div>
        {notifications.some(item => !item.read) && (
          <button type="button" className="btn btn-ghost" onClick={markAllRead} style={{ whiteSpace: 'nowrap', fontSize: 12 }}>
            Đánh dấu đã đọc
          </button>
        )}
      </div>

      {loading ? (
        <div className="card" style={{ textAlign: 'center', color: '#888' }}>Đang tải thông báo...</div>
      ) : notifications.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '42px 24px' }}>
          <PastelIcon name="bell" size={42} style={{ color: '#DDA0DD', marginBottom: 10 }} />
          <h3 style={{ margin: '0 0 6px', fontSize: 17 }}>Chưa có thông báo</h3>
          <p style={{ margin: 0, color: '#888', fontSize: 13 }}>Các hoạt động mới của bạn bè sẽ xuất hiện tại đây.</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 10 }}>
          {notifications.map(item => {
            const identity = getPastelIdentity(item.from?._id || item.type);
            return (
              <button
                type="button"
                key={item._id}
                onClick={() => openNotification(item)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 12, width: '100%', padding: '14px 16px',
                  border: 'none', borderRadius: 14,
                  background: item.read ? 'var(--card-bg)' : identity.soft,
                  boxShadow: `inset 3px 0 0 ${identity.accent}, 0 3px 12px rgba(180, 150, 180, 0.08)`, textAlign: 'left', cursor: item.data?.route ? 'pointer' : 'default',
                  color: 'var(--text)'
                }}
              >
                <span style={{ width: 38, height: 38, borderRadius: '50%', background: identity.soft, color: identity.accent, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <PastelIcon name={iconForType(item.type)} size={19} />
                </span>
                <span style={{ minWidth: 0, flex: 1 }}>
                  <span style={{ display: 'block', fontWeight: item.read ? 600 : 700, fontSize: 14, marginBottom: 3 }}>{item.title}</span>
                  <span style={{ display: 'block', color: '#888', fontSize: 13, lineHeight: 1.35 }}>{item.body}</span>
                </span>
                {!item.read && <span aria-label="Chưa đọc" style={{ width: 8, height: 8, borderRadius: '50%', background: '#E57373', flexShrink: 0 }} />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default Notifications;
