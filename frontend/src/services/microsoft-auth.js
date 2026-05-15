import { PublicClientApplication } from '@azure/msal-browser';

const msalConfig = {
  auth: {
    clientId: process.env.REACT_APP_MICROSOFT_CLIENT_ID || '',
    authority: 'https://login.microsoftonline.com/common',
    redirectUri: window.location.origin,
  },
  cache: {
    cacheLocation: 'sessionStorage',
    storeAuthStateInCookie: false,
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

export async function signInWithMicrosoft() {
  const pca = await getMsalInstance();
  const response = await pca.loginPopup({ scopes: ['user.read'] });
  return response.accessToken;
}
