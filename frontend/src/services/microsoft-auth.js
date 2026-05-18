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
 * Desktop: opens a popup.  Two communication paths are used in parallel so
 * the parent always receives the token even when window.opener is null (which
 * happens when the browser nulls it after the cross-origin Microsoft redirect):
 *
 *   Path A — MSAL internal (window.opener.postMessage / BroadcastChannel):
 *     Works when window.opener survives.  loginPopup() resolves normally.
 *
 *   Path B — localStorage storage event:
 *     MsalPopupHandler writes the token to localStorage after initMsal()
 *     returns it.  We listen for that key here and resolve from it.
 *     loginPopup() is still running but we ignore its eventual timeout error.
 *
 * iPhone Safari / PWA: redirect flow — page navigates away, AuthContext
 * handles the token on the next load via the ms_login_pending flag.
 */
export async function signInWithMicrosoft() {
  const pca = await getMsalInstance();

  if (canUsePopup()) {
    // Clear any stale value from a previous attempt.
    localStorage.removeItem('ms_popup_token');

    return new Promise((resolve, reject) => {
      let settled = false;

      const settle = (resolveFn, value) => {
        if (settled) return;
        settled = true;
        localStorage.removeItem('ms_popup_token');
        window.removeEventListener('storage', onStorage);
        resolveFn(value);
      };

      // Path B: popup wrote the token to localStorage because window.opener
      // was null and MSAL fell back to redirect handling inside the popup.
      const onStorage = (e) => {
        if (e.key !== 'ms_popup_token' || !e.newValue) return;
        try {
          const { accessToken, ts } = JSON.parse(e.newValue);
          if (accessToken && Date.now() - ts < 300_000) {
            settle(resolve, accessToken);
          }
        } catch { /* ignore malformed values */ }
      };
      window.addEventListener('storage', onStorage);

      // Path A: standard MSAL popup mechanism.
      pca.loginPopup({ scopes: ['user.read'] })
        .then((res) => settle(resolve, res.accessToken))
        .catch((err) => {
          // If Path B already settled the promise, swallow the timeout error.
          if (!settled) settle(reject, err);
        });
    });
  }

  // Mobile / standalone: redirect flow.
  localStorage.setItem('ms_login_pending', '1');
  await pca.loginRedirect({ scopes: ['user.read'] });
  return null; // unreachable — browser navigates away
}
