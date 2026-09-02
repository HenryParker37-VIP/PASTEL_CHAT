import React, { useEffect, useState } from 'react';
import { useLang } from '../i18n';
import PastelIcon from './PastelIcon';
import api from '../services/api';
import { CURRENT_APP_VERSION, RUNNING_BUILD_ID, compareVersions } from '../releaseVersion';
import { getRegistration } from '../serviceWorkerRegistration';

// The build marker is intentionally checked independently of release notes.

const AppUpdateNotice = () => {
  const { t, lang } = useLang();
  const [registration, setRegistration] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [latestRelease, setLatestRelease] = useState(null);
  const [buildUpdateAvailable, setBuildUpdateAvailable] = useState(false);

  useEffect(() => {
    let checking = false;
    const logCheck = (event, details = {}) => {
      const debug = { event, ...details, checkedAt: new Date().toISOString() };
      window.__PASTELCHAT_UPDATE_DEBUG__ = debug;
      console.info('[PastelChat update]', event, details);
    };
    const checkForUpdate = async (trigger = 'startup') => {
      if (checking) return;
      checking = true;
      logCheck('check-started', { trigger, clientBuildId: RUNNING_BUILD_ID });
      try {
        const registration = getRegistration();
        if (registration?.update) {
          await registration.update();
          logCheck('service-worker-update-complete', { clientBuildId: RUNNING_BUILD_ID });
        } else {
          logCheck('service-worker-update-skipped', { reason: 'registration-unavailable' });
        }
      } catch (error) {
        logCheck('service-worker-update-failed', { message: error.message });
      }
      try {
        const versionUrl = `${String(api.defaults.baseURL || '').replace(/\/$/, '')}/api/version?ts=${Date.now()}`;
        const response = await fetch(versionUrl, {
          cache: 'no-store',
          headers: { Accept: 'application/json', 'Cache-Control': 'no-cache, no-store' }
        });
        if (!response.ok) throw new Error(`Version endpoint returned ${response.status}`);
        const versionData = await response.json();
        const mismatch = Boolean(versionData.buildId && versionData.buildId !== RUNNING_BUILD_ID);
        setBuildUpdateAvailable(mismatch);
        logCheck('version-compared', {
          clientBuildId: RUNNING_BUILD_ID,
          serverBuildId: versionData.buildId || null,
          mismatch,
          updateAvailable: mismatch
        });
      } catch (error) {
        logCheck('version-check-failed', { message: error.message, clientBuildId: RUNNING_BUILD_ID });
      }
      try {
        const { data } = await api.get('/releases/latest');
        setLatestRelease(data.release || null);
      } catch { /* release notes are optional; build detection must still work */ }
      checking = false;
    };
    const onFocus = () => checkForUpdate('focus');
    const onVisible = () => { if (document.visibilityState === 'visible') checkForUpdate('visibilitychange'); };
    const onOnline = () => checkForUpdate('online');
    checkForUpdate();
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('online', onOnline);
    const interval = window.setInterval(() => checkForUpdate('interval'), 120000);
    return () => {
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('online', onOnline);
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
