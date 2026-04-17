import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import api from '../services/api';

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
    setLoading(false);
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
      return { success: true, user: data.user };
    } catch (err) {
      return { success: false, error: err.response?.data?.message || 'Register failed' };
    }
  };

  // Login with a previously issued login code
  const loginWithCode = async (loginCode) => {
    try {
      const { data } = await api.post('/auth/login', { loginCode });
      persist(data.token, data.user);
      return { success: true, user: data.user };
    } catch (err) {
      return { success: false, error: err.response?.data?.message || 'Login failed' };
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
