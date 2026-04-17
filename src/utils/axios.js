import axios from 'axios';
import toast from 'react-hot-toast';

export const api = axios.create({
  baseURL:         import.meta.env.VITE_API_URL || 'http://localhost:5000/api/v1',
  withCredentials: true,
  timeout:         30000,
});

// Attach token to every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('accessToken');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Handle responses
let isRefreshing  = false;
let failedQueue   = [];

const processQueue = (error, token = null) => {
  failedQueue.forEach(p => error ? p.reject(error) : p.resolve(token));
  failedQueue = [];
};

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config;

    if (error.response?.status === 401 && !original._retry && !original.url?.includes('/auth/')) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        }).then(token => {
          original.headers.Authorization = `Bearer ${token}`;
          return api(original);
        });
      }

      original._retry = true;
      isRefreshing    = true;

      try {
        const { data } = await axios.post(
          `${import.meta.env.VITE_API_URL}/auth/refresh`,
          {},
          { withCredentials: true }
        );
        const newToken = data.data.accessToken;
        localStorage.setItem('accessToken', newToken);
        processQueue(null, newToken);
        original.headers.Authorization = `Bearer ${newToken}`;
        return api(original);
      } catch (refreshErr) {
        processQueue(refreshErr, null);
        localStorage.removeItem('accessToken');
        window.location.href = '/login';
        return Promise.reject(refreshErr);
      } finally {
        isRefreshing = false;
      }
    }

    if (error.response?.status === 402) {
      toast.error('Insufficient credits. Please top up or upgrade your plan.');
    }

    // ── Auto-report errors to admin error log ─────────────────────
    // Skip: auth errors (401), not found (404), cancelled requests, health checks
    const status = error.response?.status;
    const url    = error.config?.url || '';
    const skipReport =
      status === 401 || status === 404 || status === 402 ||
      !status ||  // network/timeout — no response
      url.includes('/errors/report') ||
      url.includes('/auth/') ||
      url.includes('/health');

    if (!skipReport) {
      try {
        api.post('/errors/report', {
          message:    error.response?.data?.message || error.message,
          code:       error.response?.data?.code    || null,
          endpoint:   url,
          statusCode: status,
          metadata: {
            method:   error.config?.method?.toUpperCase(),
            page:     window.location.pathname,
          },
        }).catch(() => {}); // silent — never block the original error
      } catch { /* silent */ }
    }

    return Promise.reject(error);
  }
);