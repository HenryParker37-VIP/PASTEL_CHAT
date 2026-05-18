import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import api from '../services/api';
import { subscribeToPush } from '../services/push';
import { initializeCapacitorPush } from '../services/capacitor-push';
import { initMsal } from '../services/microsoft-auth';

async function trySubscribePush() {
  try {
    // Try Capacitor push first (native mobile app)
    try {
      const capacitorReady = await initializeCapacitorPush();
      if (capacitorReady) return;
    } catch (err) {
      console.warn('[Push] Capacitor push failed (expected on web):', err.message);
    }

    // Fall back to web push
    if (!('serviceWorker' in navigator)) return;
    const reg = await navigator.serviceWorker.ready;
    await subscribeToPush(reg);
  } catch (e) {
    console.warn('[Push] post-login subscribe failed:', e.message);
  }
}

const AuthContext = createContext(null);

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Restore existing session immediately
    const token = localStorage.getItem('token');
    const stored = localStorage.getItem('user');
    if (token && stored) {
      try {
        setUser(JSON.parse(stored));
      } catch {
        localStorage.removeItem('user');
        localStorage.removeItem('token');
      }
    }

    // Initialize MSAL on every page load.
    //
    // Popup flow (desktop): if this window was opened as an OAuth popup,
    // MSAL detects window.opener + auth state, sends the token to the parent
    // via postMessage, and closes this window. initMsal() returns null here.
    //
    // Redirect flow (iPhone/Safari/PWA): if we're returning from a Microsoft
    // loginRedirect, initMsal() returns the access token so we can finish
    // logging in without any user interaction.
    let cancelled = false;
    initMsal()
      .then(async (msAccessToken) => {
        if (cancelled) return;
        if (msAccessToken && localStorage.getItem('ms_login_pending')) {
          localStorage.removeItem('ms_login_pending');
          try {
            const { data } = await api.post('/auth/microsoft', { token: msAccessToken });
            if (cancelled) return;
            localStorage.setItem('token', data.token);
            localStorage.setItem('user', JSON.stringify(data.user));
            setUser(data.user);
            trySubscribePush();
            window.location.replace('/home');
            return; // setLoading not needed — page is navigating
          } catch (err) {
            console.error('[Auth] MS redirect login failed:', err);
          }
        }
        if (!cancelled) setLoading(false);
      })
      .catch(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, []);

  const persist = (token, u) => {
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(u));
    setUser(u);
  };

  // Register a brand new user (returns a login code)
  const register = async (name, avatar) => {
    try {
      const { data } = await api.post('/auth/register', { name, avatar });
      persist(data.token, data.user);
      trySubscribePush();
      return { success: true, user: data.user };
    } catch (err) {
      if (!err.response) {
        return { success: false, error: 'Cannot reach the server. Make sure you\'re connected and the app is properly configured.' };
      }
      return { success: false, error: err.response?.data?.message || 'Registration failed. Please try again.' };
    }
  };

  // Login with a previously issued login code
  const loginWithCode = async (loginCode) => {
    try {
      const { data } = await api.post('/auth/login', { loginCode });
      persist(data.token, data.user);
      trySubscribePush();
      return { success: true, user: data.user };
    } catch (err) {
      if (!err.response) {
        return { success: false, error: 'Cannot reach the server. Check your connection.' };
      }
      return { success: false, error: err.response?.data?.message || 'Login failed. Check your code and try again.' };
    }
  };

  const checkName = async (name) => {
    try {
      const { data } = await api.get('/auth/check-name', { params: { name } });
      return data;
    } catch {
      return { available: false, reason: 'Check failed' };
    }
  };

  const updateName = async (name) => {
    try {
      const { data } = await api.post('/auth/update-name', { name });
      persist(localStorage.getItem('token'), data.user);
      return { success: true, user: data.user };
    } catch (err) {
      return { success: false, error: err.response?.data?.message || 'Rename failed' };
    }
  };

  const updateProfile = async (patch) => {
    try {
      const { data } = await api.put('/users/me', patch);
      persist(localStorage.getItem('token'), data);
      return { success: true, user: data };
    } catch (err) {
      return { success: false, error: err.response?.data?.message || 'Update failed' };
    }
  };

  const refreshMe = useCallback(async () => {
    try {
      const { data } = await api.get('/auth/me');
      persist(localStorage.getItem('token'), data);
      return data;
    } catch {
      return null;
    }
  }, []);

  const loginWithGoogle = async (credentialResponse) => {
    try {
      const { data } = await api.post('/auth/google', { token: credentialResponse.credential });
      persist(data.token, data.user);
      trySubscribePush();
      return { success: true, user: data.user, isNewUser: data.isNewUser };
    } catch (err) {
      if (!err.response) {
        return { success: false, error: 'Cannot reach the server. Check your connection.' };
      }
      const msg = err.response?.data?.message || 'Google sign-in failed. Please try again.';
      const detail = err.response?.data?.detail;
      console.error('[Auth] Google error:', msg, detail || '');
      return { success: false, error: detail ? `${msg}: ${detail}` : msg };
    }
  };

  const loginWithMicrosoft = async (accessToken) => {
    try {
      const { data } = await api.post('/auth/microsoft', { token: accessToken });
      persist(data.token, data.user);
      trySubscribePush();
      return { success: true, user: data.user };
    } catch (err) {
      if (!err.response) {
        return { success: false, error: 'Cannot reach the server. Check your connection.' };
      }
      const msg = err.response?.data?.message || 'Microsoft sign-in failed. Please try again.';
      const detail = err.response?.data?.detail;
      console.error('[Auth] Microsoft error:', msg, detail || '');
      return { success: false, error: detail ? `${msg}: ${detail}` : msg };
    }
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
  };

  const getToken = () => localStorage.getItem('token');

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        register,
        loginWithCode,
        loginWithGoogle,
        loginWithMicrosoft,
        checkName,
        updateName,
        updateProfile,
        refreshMe,
        logout,
        getToken
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
