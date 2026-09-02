import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLang } from '../i18n';
import { useNotifications } from '../contexts/NotificationsContext';
import PastelIcon from '../components/PastelIcon';
import { getPastelIdentity } from '../utils/pastelIdentity';
import {
  getExistingSubscription,
  getNotificationPermission,
  isIOS,
  isPushSupported,
  isStandalonePWA,
  subscribeToPush,
  unsubscribeFromPush
} from '../services/push';

const iconForType = (type) => {
  if (type === 'new_message' || type === 'group_message') return 'chat-friends';
  if (type === 'friend_requested' || type === 'friend_accepted') return 'users';
  return 'bell';
};

const getNotificationCopy = (item, t) => {
  const name = item.from?.name || 'friend';
  if (item.type === 'new_message') return { title: t('notificationsNewMessage', name), body: item.body };
  if (item.type === 'friend_requested') return { title: t('notificationsFriendRequest'), body: t('notificationsFriendRequestBody', name) };
  if (item.type === 'friend_accepted') return { title: t('notificationsFriendAccepted'), body: t('notificationsFriendAcceptedBody', name) };
  if (item.type === 'group_message') return { title: item.groupName || t('notificationsGroupMessage'), body: item.body };
  if (item.type === 'group_created' || item.type === 'group_invited') return { title: t('notificationsGroupAdded'), body: item.body };
  return { title: item.title, body: item.body };
};

const Notifications = () => {
  const navigate = useNavigate();
  const { t } = useLang();
  const { notifications, loading, markRead, markAllRead } = useNotifications();
  const [pushSupported, setPushSupported] = useState(false);
  const [pushPermission, setPushPermission] = useState('default');
  const [pushSubscribed, setPushSubscribed] = useState(false);
  const [pushBusy, setPushBusy] = useState(false);
  const [pushError, setPushError] = useState('');
  const [iosNonStandalone, setIosNonStandalone] = useState(false);

  const checkPushState = useCallback(async () => {
    const supported = isPushSupported();
    setPushSupported(supported);
    setPushPermission(getNotificationPermission());
    setIosNonStandalone(isIOS() && !isStandalonePWA());
    if (supported && getNotificationPermission() === 'granted') {
      setPushSubscribed(Boolean(await getExistingSubscription()));
    } else setPushSubscribed(false);
  }, []);

  useEffect(() => { checkPushState(); }, [checkPushState]);

  const enablePush = async () => {
    setPushBusy(true); setPushError('');
    const result = await subscribeToPush();
    if (result.success) {
      setPushPermission('granted'); setPushSubscribed(true);
    } else {
      setPushPermission(result.permission || getNotificationPermission());
      setPushError(result.error || t('notificationsPushEnableError'));
    }
    setPushBusy(false); checkPushState();
  };

  const disablePush = async () => {
    setPushBusy(true); setPushError('');
    await unsubscribeFromPush();
    setPushSubscribed(false); setPushBusy(false); checkPushState();
  };

  useEffect(() => {
    if (notifications.some(item => !item.read)) markAllRead();
  }, [notifications, markAllRead]);

  const openNotification = async (item) => {
    await markRead(item._id);
    const route = item.data?.route
      || (item.type === 'new_message' && item.from?._id ? `/chat/${item.from._id}` : null)
      || (['friend_requested', 'friend_accepted', 'friend_request'].includes(item.type) ? '/friends' : null)
      || ((['group_message', 'group_created', 'group_invited'].includes(item.type) && (item.data?.groupId || item.groupId)) ? `/group/${item.data?.groupId || item.groupId}` : null);
    if (route) navigate(route);
  };

  return (
    <div className="container">
      <button className="btn btn-ghost" onClick={() => navigate('/home')} style={{ marginBottom: 18 }}>
        {t('back')}
      </button>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, marginBottom: 20 }}>
        <div>
          <h2 style={{ margin: '4px 0 6px' }}>{t('notificationsTitle')}</h2>
          <p style={{ color: '#888', fontSize: 14, margin: 0 }}>{t('notificationsDesc')}</p>
        </div>
        {notifications.some(item => !item.read) && (
          <button type="button" className="btn btn-ghost" onClick={markAllRead} style={{ whiteSpace: 'nowrap', fontSize: 12 }}>
            {t('notificationsMarkAllRead')}
          </button>
        )}
      </div>

      <div className="card" style={{ marginBottom: 20, padding: '14px 16px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
          <span style={{ width: 36, height: 36, borderRadius: 12, background: '#F5F0FB', color: '#9B7AC2', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <PastelIcon name="bell" size={19} />
          </span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h3 style={{ margin: '0 0 4px', fontSize: 15 }}>{t('notificationsPushTitle')}</h3>
            <p style={{ margin: '0 0 10px', fontSize: 12, color: '#888', lineHeight: 1.4 }}>{t('notificationsPushDesc')}</p>
            {!pushSupported ? <p style={{ margin: 0, color: '#888', fontSize: 12 }}>{t('notificationsPushUnsupported')}</p> : pushPermission === 'denied' ? (
              <p style={{ margin: 0, color: '#C87575', fontSize: 12 }}>{t('notificationsPushBlocked')}</p>
            ) : pushSubscribed ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                <span style={{ color: '#4A9860', fontSize: 12, fontWeight: 600 }}><PastelIcon name="check" size={14} /> {t('notificationsPushEnabled')}</span>
                <button type="button" className="btn btn-ghost" onClick={disablePush} disabled={pushBusy} style={{ fontSize: 12, padding: '5px 10px' }}>{t('notificationsPushDisable')}</button>
              </div>
            ) : (
              <button type="button" className="btn" onClick={enablePush} disabled={pushBusy} style={{ fontSize: 12, padding: '7px 12px' }}>
                <PastelIcon name="bell" size={14} /> {t('notificationsPushEnable')}
              </button>
            )}
            {iosNonStandalone && pushPermission !== 'denied' && <p style={{ margin: '9px 0 0', fontSize: 11, color: '#9B59B6' }}>{t('notificationsPushIosHint')} <button type="button" onClick={() => navigate('/install')} style={{ border: 0, background: 'none', padding: 0, color: '#8A62A8', textDecoration: 'underline', cursor: 'pointer' }}>{t('notificationsPushInstall')}</button></p>}
            {pushError && <p style={{ margin: '8px 0 0', color: '#C87575', fontSize: 12 }}>{pushError}</p>}
          </div>
        </div>
      </div>

      {loading ? (
        <div className="card" style={{ textAlign: 'center', color: '#888' }}>{t('notificationsLoading')}</div>
      ) : notifications.length === 0 ? (
          <div className="card" style={{ textAlign: 'center', padding: '42px 24px' }}>
          <PastelIcon name="bell" size={42} style={{ color: '#DDA0DD', marginBottom: 10 }} />
          <h3 style={{ margin: '0 0 6px', fontSize: 17 }}>{t('notificationsEmptyTitle')}</h3>
          <p style={{ margin: 0, color: '#888', fontSize: 13 }}>{t('notificationsEmptyDesc')}</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 10 }}>
          {notifications.map(item => {
            const identity = getPastelIdentity(item.from?._id || item.type);
            const copy = getNotificationCopy(item, t);
            return (
              <button
                type="button"
                key={item._id}
                onClick={() => openNotification(item)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 12, width: '100%', padding: '14px 16px',
                  border: 'none', borderRadius: 14,
                  background: item.read ? 'var(--card-bg)' : identity.soft,
                  boxShadow: `inset 3px 0 0 ${identity.accent}, 0 3px 12px rgba(180, 150, 180, 0.08)`, textAlign: 'left', cursor: 'pointer',
                  color: 'var(--text)'
                }}
              >
                <span style={{ width: 38, height: 38, borderRadius: '50%', background: identity.soft, color: identity.accent, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <PastelIcon name={iconForType(item.type)} size={19} />
                </span>
                <span style={{ minWidth: 0, flex: 1 }}>
                  <span style={{ display: 'block', fontWeight: item.read ? 600 : 700, fontSize: 14, marginBottom: 3 }}>{copy.title}</span>
                  <span style={{ display: 'block', color: '#888', fontSize: 13, lineHeight: 1.35 }}>{copy.body}</span>
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
