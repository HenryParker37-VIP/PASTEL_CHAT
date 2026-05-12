import axios from 'axios';

// Initialize with default URL, will be updated at app startup
const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'https://pastel-chat.onrender.com';

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

// ── Sticker API helpers ───────────────────────────────────────────────────────
export const stickerApi = {
  getAllPacks: () => api.get('/stickers/packs'),
  getPack: (packId) => api.get(`/stickers/packs/${packId}`),
  addPack: (packId) => api.post(`/stickers/packs/${packId}/add`),
  removePack: (packId) => api.delete(`/stickers/packs/${packId}/remove`),
  getMyPacks: () => api.get('/stickers/my-packs'),
};

export default api;
