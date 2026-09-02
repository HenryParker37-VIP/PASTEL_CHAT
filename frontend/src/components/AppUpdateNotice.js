import React, { useEffect, useState } from 'react';
import { useLang } from '../i18n';
import PastelIcon from './PastelIcon';

const AppUpdateNotice = () => {
  const { t } = useLang();
  const [registration, setRegistration] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    const handleUpdate = (event) => setRegistration(event.detail?.registration || null);
    window.addEventListener('pastelchat:update-available', handleUpdate);
    return () => window.removeEventListener('pastelchat:update-available', handleUpdate);
  }, []);

  if (!registration) return null;

  const refreshApp = () => {
    if (refreshing) return;
    setRefreshing(true);
    const waiting = registration.waiting;
    if (!waiting) {
      window.location.reload();
      return;
    }
    const handleControllerChange = () => {
      navigator.serviceWorker.removeEventListener('controllerchange', handleControllerChange);
      window.location.reload();
    };
    navigator.serviceWorker.addEventListener('controllerchange', handleControllerChange);
    waiting.postMessage({ type: 'SKIP_WAITING' });
  };

  return (
    <aside className="app-update-notice" role="status" aria-live="polite">
      <div className="app-update-icon" aria-hidden="true">
        <PastelIcon name="chat-friends" size={19} />
        <span className="app-update-dot app-update-dot--one" />
        <span className="app-update-dot app-update-dot--two" />
        <span className="app-update-dot app-update-dot--three" />
      </div>
      <div className="app-update-copy">
        <strong>{t('appUpdateTitle')}</strong>
        <span>{t('appUpdateMessage')}</span>
      </div>
      <button type="button" className="app-update-button" onClick={refreshApp} disabled={refreshing}>
        {refreshing ? t('appUpdateRefreshing') : t('appUpdateRefresh')}
      </button>
    </aside>
  );
};

export default AppUpdateNotice;
