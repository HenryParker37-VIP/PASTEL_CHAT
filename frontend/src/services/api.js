import axios from 'axios';

// Determine backend URL: env var → current domain → localhost fallback
function getBackendUrl() {
  // 1. Try environment variable (Vercel, production builds)
  if (typeof process !== 'undefined' && process.env?.REACT_APP_BACKEND_URL) {
    return process.env.REACT_APP_BACKEND_URL;
  }

  // 2. On deployed site (Vercel), use same origin as frontend
  if (typeof window !== 'undefined') {
    const host = window.location.host;
    const protocol = window.location.protocol;

    // If on Vercel (pastel-chat.vercel.app), assume backend is at same domain
    // or use a production backend URL you set
    if (host.includes('vercel.app') || host.includes('pastel-chat.com')) {
      // TODO: Set your actual production backend URL
      // For now, assume same origin
      return `${protocol}//${host}`;
    }
  }

  // 3. Development fallback
  return 'http://localhost:5001';
}

let BACKEND_URL = getBackendUrl();

const api = axios.create({
  baseURL: BACKEND_URL,
  headers: { 'Content-Type': 'application/json' }
});

// Attach JWT from localStorage on every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Redirect to login on 401
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(err);
  }
);

export default api;
