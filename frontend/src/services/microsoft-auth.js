import { PublicClientApplication } from '@azure/msal-browser';

const msalConfig = {
  auth: {
    clientId: process.env.REACT_APP_MICROSOFT_CLIENT_ID || '',
    authority: 'https://login.microsoftonline.com/common',
    redirectUri: window.location.origin,
  },
  cache: {
    // sessionStorage isolates auth state per tab, preventing multiple open tabs
    // from each trying to process the same MSAL auth response.
    // storeAuthStateInCookie covers Safari ITP which can clear sessionStorage
    // during cross-origin redirects.
    cacheLocation: 'sessionStorage',
    storeAuthStateInCookie: true,
  },
};

let _pca = null;

export async function getMsalInstance() {
  if (!_pca) {
    _pca = new PublicClientApplication(msalConfig);
    await _pca.initialize();
  }
  return _pca;
}

/**
 * Must be called once on every page load (app startup).
 *
 * Popup flow: MSAL detects window.opener + auth state, sends the token to
 * the parent via postMessage, then closes this popup window automatically.
 * Returns null in the popup.
 *
 * Redirect flow (iPhone/Safari): MSAL reads the token from the URL hash /
 * query params, clears the hash, and returns the access token so the caller
 * can complete the login without any user interaction.
 */
export async function initMsal() {
  try {
    const pca = await getMsalInstance();
    const result = await pca.handleRedirectPromise();
    return result?.accessToken ?? null;
  } catch (err) {
    if (process.env.NODE_ENV === 'development') {
      console.error('[MSAL] initMsal error:', err);
    }
    return null;
  }
}

/** Popups are blocked on iOS Safari and in PWA standalone mode. */
function canUsePopup() {
  const ua = navigator.userAgent;
  const isIOS = /iPad|iPhone|iPod/.test(ua);
  const isStandalone =
    window.navigator.standalone === true ||
    window.matchMedia('(display-mode: standalone)').matches;
  return !isIOS && !isStandalone;
}

/**
 * Starts the Microsoft sign-in flow.
 *
 * Desktop: opens a popup via MSAL v5's loginPopup().
 *   The popup window renders MsalPopupHandler which calls
 *   broadcastResponseToMainFrame() — this sends the raw auth response back to
 *   the parent via BroadcastChannel (no window.opener needed) and closes itself.
 *   loginPopup() resolves once it receives that broadcast.
 *
 * iPhone Safari / PWA: redirect flow — page navigates away, AuthContext
 *   handles the token on the next load via the ms_login_pending flag.
 */
export async function signInWithMicrosoft() {
  const pca = await getMsalInstance();

  if (canUsePopup()) {
    const response = await pca.loginPopup({ scopes: ['user.read'] });
    return response.accessToken;
  }

  // Mobile / standalone: redirect flow.
  localStorage.setItem('ms_login_pending', '1');
  await pca.loginRedirect({ scopes: ['user.read'] });
  return null; // unreachable — browser navigates away
}
