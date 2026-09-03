import React, { useEffect, useRef, useState } from 'react';
import { useSocket } from '../contexts/SocketContext';
import { useLang } from '../i18n';
import api from '../services/api';
import PastelIcon from './PastelIcon';

const NetworkStatusBanner = () => {
  const { connected } = useSocket();
  const { t } = useLang();
  const [status, setStatus] = useState(null);
  const slowSamplesRef = useRef(0);

  useEffect(() => {
    let active = true;

    const checkConnection = async () => {
      if (!navigator.onLine) {
        if (active) setStatus('offline');
        return;
      }
      if (!connected) {
        if (active) setStatus('weak');
        return;
      }

      const startedAt = performance.now();
      try {
        await api.get('/health', { timeout: 5000, headers: { 'Cache-Control': 'no-cache' } });
        const latency = performance.now() - startedAt;
        if (latency > 1200) slowSamplesRef.current += 1;
        else slowSamplesRef.current = 0;
        if (active) setStatus(slowSamplesRef.current >= 2 ? 'weak' : null);
      } catch {
        slowSamplesRef.current += 1;
        if (active) setStatus('weak');
      }
    };

    const handleOffline = () => setStatus('offline');
    const handleOnline = () => { slowSamplesRef.current = 0; checkConnection(); };
    window.addEventListener('offline', handleOffline);
    window.addEventListener('online', handleOnline);
    checkConnection();
    const intervalId = window.setInterval(checkConnection, 30000);

    return () => {
      active = false;
      window.clearInterval(intervalId);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('online', handleOnline);
    };
  }, [connected]);

  if (!status) return null;
  const offline = status === 'offline';
  return (
    <div className={`network-status-banner network-status-banner--${status}`} role="status" aria-live="polite">
      <PastelIcon name={offline ? 'offline' : 'alert'} size={14} />
      <span>{offline ? t('networkOffline') : t('networkWeak')}</span>
    </div>
  );
};

export default NetworkStatusBanner;
