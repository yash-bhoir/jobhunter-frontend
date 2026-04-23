import axios from 'axios';
import toast from 'react-hot-toast';

export const api = axios.create({
  baseURL:         import.meta.env.VITE_API_URL || '/api/v1',
  withCredentials: true,
  timeout:         30000,
});

// Handle responses
let isRefreshing  = false;
let failedQueue   = [];

const processQueue = (error) => {
  failedQueue.forEach(p => error ? p.reject(error) : p.resolve());
  failedQueue = [];
};

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config;

    // Skip JWT refresh for Gmail-specific auth errors — those use 400 now but guard
    // against any future status changes by also checking the error code.
    const isGmailAuthError = error.response?.data?.code === 'GMAIL_TOKEN_EXPIRED' ||
                             error.response?.data?.code === 'GMAIL_NOT_CONNECTED';

    if (
      error.response?.status === 401 &&
      !original._retry &&
      !original._skipAuthRefresh &&
      !original.url?.includes('/auth/') &&
      !isGmailAuthError
    ) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        }).then(() => api(original));
      }

      original._retry = true;
      isRefreshing    = true;

      try {
        await api.post('/auth/refresh', {}, { _skipAuthRefresh: true });
        processQueue(null);
        return api(original);
      } catch (refreshErr) {
        processQueue(refreshErr);
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