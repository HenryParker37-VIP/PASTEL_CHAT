function cleanConfiguredUrl(value) {
  const raw = String(value || '').trim();
  if (!raw || raw.includes('onrender.com')) return '';
  return raw.replace(/\/+$/, '');
}

function originOf(value, pageOrigin) {
  if (!value) return pageOrigin ? new URL(pageOrigin).origin : '';
  const url = new URL(value);
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash || url.pathname !== '/') {
    throw new Error('Backend endpoints must be absolute HTTP(S) origins without paths, credentials, query, or fragment');
  }
  return url.origin;
}

function resolveBackendEndpoints({ backendUrl = '', signalingUrl = '', pageOrigin = '' } = {}) {
  const backend = cleanConfiguredUrl(backendUrl);
  const signaling = cleanConfiguredUrl(signalingUrl);
  const restTarget = backend || pageOrigin;
  const socketTarget = signaling || backend || pageOrigin;
  try {
    const restOrigin = originOf(restTarget, pageOrigin);
    const socketOrigin = originOf(socketTarget, pageOrigin);
    if (restOrigin && socketOrigin && restOrigin !== socketOrigin) {
      return { valid: false, error: 'REST and Socket.IO endpoints must use the same backend origin', restBaseURL: '', socketURL: '' };
    }
    return {
      valid: true,
      error: null,
      restBaseURL: backend,
      socketURL: socketTarget || ''
    };
  } catch (error) {
    return { valid: false, error: error.message, restBaseURL: '', socketURL: '' };
  }
}

const frontendOrigin = typeof window !== 'undefined' ? window.location.origin : '';
const backendEndpoints = resolveBackendEndpoints({
  backendUrl: process.env.REACT_APP_BACKEND_URL,
  signalingUrl: process.env.REACT_APP_SIGNALING_URL,
  pageOrigin: frontendOrigin
});

module.exports = { resolveBackendEndpoints, backendEndpoints };
