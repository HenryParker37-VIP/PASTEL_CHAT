import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useLang } from '../i18n';
import PastelIcon from './PastelIcon';

const STATIC_PROBE_URL = '/images/home-icons/chat-friends.png';
const PROBE_TIMEOUT_MS = 3500;
const CHECK_INTERVAL_MS = 30000;

const NetworkStatusBanner = () => {
  const { t } = useLang();
  const [status, setStatus] = useState(null);
  const slowSamplesRef = useRef(0);

  const checkConnection = useCallback(async () => {
    // 1. Definite offline check
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      setStatus('offline');
      return;
    }

    // 2. Hardware / NetworkInformation API check (Chrome/Android/Edge)
    const conn = typeof navigator !== 'undefined' && (navigator.connection || navigator.mozConnection || navigator.webkitConnection);
    if (conn) {
      if (conn.effectiveType === 'slow-2g' || conn.effectiveType === '2g') {
        setStatus('weak');
        return;
      }
    }

    // 3. Client network edge probe:
    // Pings a static edge asset from Vercel CDN cache (bypassing serverless functions and MongoDB).
    // This isolates true client network quality from backend/database latency.
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS);
    const startedAt = performance.now();

    try {
      const probeUrl = `${STATIC_PROBE_URL}?_probe=${Date.now()}`;
      const response = await fetch(probeUrl, {
        method: 'HEAD',
        cache: 'no-store',
        signal: controller.signal
      });
      window.clearTimeout(timeoutId);

      const latency = performance.now() - startedAt;

      if (!response.ok) {
        // If static asset returns an HTTP error, don't blame client network unless connection aborted
        slowSamplesRef.current = 0;
        setStatus(null);
        return;
      }

      if (latency > 2500) {
        slowSamplesRef.current += 1;
      } else {
        slowSamplesRef.current = 0;
      }

      setStatus(slowSamplesRef.current >= 2 ? 'weak' : null);
    } catch (err) {
      window.clearTimeout(timeoutId);

      // Aborted probe or network failure
      if (err.name === 'AbortError' || (typeof navigator !== 'undefined' && !navigator.onLine)) {
        slowSamplesRef.current += 1;
        setStatus(navigator.onLine ? (slowSamplesRef.current >= 2 ? 'weak' : null) : 'offline');
      } else {
        // Other non-network errors don't falsely blame network quality
        slowSamplesRef.current = 0;
        setStatus(null);
      }
    }
  }, []);

  useEffect(() => {
    const handleOffline = () => setStatus('offline');
    const handleOnline = () => {
      slowSamplesRef.current = 0;
      setStatus(null);
      checkConnection();
    };

    window.addEventListener('offline', handleOffline);
    window.addEventListener('online', handleOnline);

    const conn = typeof navigator !== 'undefined' && (navigator.connection || navigator.mozConnection || navigator.webkitConnection);
    const handleConnectionChange = () => {
      if (conn?.effectiveType === 'slow-2g' || conn?.effectiveType === '2g') {
        setStatus('weak');
      } else {
        checkConnection();
      }
    };
    conn?.addEventListener?.('change', handleConnectionChange);

    checkConnection();
    const intervalId = window.setInterval(checkConnection, CHECK_INTERVAL_MS);

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('online', handleOnline);
      conn?.removeEventListener?.('change', handleConnectionChange);
    };
  }, [checkConnection]);

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
