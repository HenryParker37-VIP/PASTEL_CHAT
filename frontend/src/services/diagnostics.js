// Diagnostics to help debug standalone app connection issues
export async function runDiagnostics() {
  const results = {
    backendUrl: process.env.REACT_APP_BACKEND_URL || 'https://pastel-chat.onrender.com',
    isStandalone: window.navigator.standalone === true || window.matchMedia('(display-mode: standalone)').matches,
    isOnline: navigator.onLine,
    hasServiceWorker: 'serviceWorker' in navigator,
    timestamp: new Date().toISOString(),
  };

  console.log('[Diagnostics] App Status:', results);

  // Test backend connectivity
  try {
    console.log('[Diagnostics] Testing backend health...');
    const response = await fetch(`${results.backendUrl}/health`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });
    results.backendHealthy = response.ok;
    results.backendStatus = response.status;
    console.log('[Diagnostics] Backend health:', response.ok ? '✓' : '✗', `(${response.status})`);
  } catch (err) {
    results.backendHealthy = false;
    results.backendError = err.message;
    console.error('[Diagnostics] Backend health check failed:', err.message);
  }

  // Test CORS
  try {
    console.log('[Diagnostics] Testing CORS...');
    const response = await fetch(`${results.backendUrl}/health`, {
      method: 'OPTIONS',
      headers: {
        'Access-Control-Request-Method': 'POST',
        'Access-Control-Request-Headers': 'content-type',
      },
    });
    results.corsWorking = response.ok;
    console.log('[Diagnostics] CORS test:', response.ok ? '✓' : '✗');
  } catch (err) {
    results.corsWorking = false;
    results.corsError = err.message;
    console.error('[Diagnostics] CORS check failed:', err.message);
  }

  return results;
}
