import React, { useEffect, useState } from 'react';
import { useLang } from '../i18n';
import PastelIcon from './PastelIcon';
import api from '../services/api';
import { CURRENT_APP_VERSION, RUNNING_BUILD_ID, compareVersions } from '../releaseVersion';
import { getRegistration } from '../serviceWorkerRegistration';

const AppUpdateNotice = () => {
  const { t, lang } = useLang();
  const [registration, setRegistration] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [latestRelease, setLatestRelease] = useState(null);
  const [buildUpdateAvailable, setBuildUpdateAvailable] = useState(false);

  useEffect(() => {
    let checking = false;
    const checkForUpdate = async () => {
      if (checking) return;
      checking = true;
      try {
        const registration = getRegistration();
        if (registration?.update) await registration.update();
      } catch { /* service worker checks are best effort */ }
      try {
        const [{ data: releaseData }, { data: versionData }] = await Promise.all([
          api.get('/releases/latest'),
          api.get('/api/version', { headers: { 'Cache-Control': 'no-cache', Pragma: 'no-cache' }, params: { _: Date.now() } })
        ]);
        setLatestRelease(releaseData.release || null);
        setBuildUpdateAvailable(Boolean(versionData.buildId && versionData.buildId !== RUNNING_BUILD_ID));
      } catch { /* network errors should not interrupt the app */ }
      checking = false;
    };
    const onVisible = () => { if (document.visibilityState === 'visible') checkForUpdate(); };
    checkForUpdate();
    window.addEventListener('focus', checkForUpdate);
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('online', checkForUpdate);
    const interval = window.setInterval(checkForUpdate, 120000);
    return () => {
      window.removeEventListener('focus', checkForUpdate);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('online', checkForUpdate);
      window.clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    const handleUpdate = (event) => setRegistration(event.detail?.registration || null);
    window.addEventListener('pastelchat:update-available', handleUpdate);
    return () => window.removeEventListener('pastelchat:update-available', handleUpdate);
  }, []);

  if (!registration && !buildUpdateAvailable) return null;

  const hasReleaseUpdate = latestRelease && compareVersions(latestRelease.version, CURRENT_APP_VERSION) > 0;
  const summaryItems = latestRelease ? [...(lang === 'vi' ? (latestRelease.featuresVi || latestRelease.features || []) : (latestRelease.features || [])), ...(lang === 'vi' ? (latestRelease.fixesVi || latestRelease.fixes || []) : (latestRelease.fixes || []))].slice(0, 3) : [];

  const refreshApp = () => {
    if (refreshing) return;
    setRefreshing(true);
    const waiting = registration?.waiting;
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
        <strong>{hasReleaseUpdate ? t('releaseAppUpdateTitle', latestRelease.version) : t('appUpdateTitle')}</strong>
        <span>{hasReleaseUpdate ? t('releaseAppUpdateMessage') : t('appUpdateMessage')}</span>
        {hasReleaseUpdate && summaryItems.length > 0 && <ul>{summaryItems.map(item => <li key={item}>• {item}</li>)}</ul>}
      </div>
      {hasReleaseUpdate && <button type="button" className="app-update-details" onClick={() => { window.location.href = `/whats-new/${encodeURIComponent(latestRelease.version)}`; }}>{t('releaseViewDetails')}</button>}
      <button type="button" className="app-update-button" onClick={refreshApp} disabled={refreshing}>
        {refreshing ? t('appUpdateRefreshing') : t('appUpdateRefresh')}
      </button>
    </aside>
  );
};

export default AppUpdateNotice;
