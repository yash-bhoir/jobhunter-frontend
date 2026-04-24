import axios from 'axios';
import toast from 'react-hot-toast';
import {
  getAccessToken,
  setAccessToken,
  clearAccessToken,
  isAuthRefreshCircuitOpen,
  openAuthRefreshCircuit,
  clearAuthRefreshCircuit,
} from './accessToken';

export const api = axios.create({
  baseURL:         import.meta.env.VITE_API_URL || '/api/v1',
  withCredentials: true,
  timeout:         30000,
});

function isAuthPathNoBearer(url = '') {
  return (
    url.includes('/auth/login')
    || url.includes('/auth/register')
    || url.includes('/auth/refresh')
    || url.includes('/auth/oauth-exchange')
    || url.includes('/auth/forgot-password')
    || url.includes('/auth/reset-password')
    || url.includes('/auth/google')
    || url.includes('/auth/admin/verify-otp')
  );
}

/** 401 on these URLs must NOT trigger refresh (avoids loops). `/auth/me` is NOT listed. */
function isAuthPathSkipRefreshOn401(url = '') {
  if (!url) return false;
  const paths = [
    '/auth/login',
    '/auth/register',
    '/auth/refresh',
    '/auth/oauth-exchange',
    '/auth/forgot-password',
    '/auth/reset-password',
    '/auth/google',
    '/auth/admin/verify-otp',
  ];
  return paths.some((p) => url.includes(p));
}

api.interceptors.request.use((config) => {
  const url = config.url || '';
  if (!isAuthPathNoBearer(url)) {
    const t = getAccessToken();
    if (t) config.headers.Authorization = `Bearer ${t}`;
  }
  return config;
});

// Handle responses
let isRefreshing             = false;
let failedQueue              = [];
let pendingRefreshController = null; // AbortController for the in-flight refresh

const processQueue = (error) => {
  failedQueue.forEach(p => error ? p.reject(error) : p.resolve());
  failedQueue = [];
};

/**
 * Cancel any in-flight token-refresh so it cannot redirect the user back to /login
 * after a concurrent explicit login has already succeeded.
 * Queued requests are resolved (not rejected) so they retry with the fresh cookies.
 */
export const cancelPendingRefresh = () => {
  if (!pendingRefreshController) return;
  pendingRefreshController.abort();
  processQueue(null); // let queued requests retry with new cookies
  pendingRefreshController = null;
  isRefreshing = false;
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
      !isAuthPathSkipRefreshOn401(original.url || '')
      && !isGmailAuthError
    ) {
      if (isAuthRefreshCircuitOpen()) {
        if (!window.location.pathname.startsWith('/login')) {
          window.location.replace('/login');
        }
        return Promise.reject(error);
      }
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        }).then(() => api(original));
      }

      original._retry      = true;
      isRefreshing         = true;
      pendingRefreshController = new AbortController();

      try {
        const refreshRes = await api.post('/auth/refresh', {}, {
          _skipAuthRefresh: true,
          signal: pendingRefreshController.signal,
        });
        const next = refreshRes.data?.data?.accessToken;
        if (next) setAccessToken(next);
        else clearAccessToken(); // drop stale sessionStorage token so cookie takes over
        clearAuthRefreshCircuit();
        processQueue(null);
        return api(original);
      } catch (refreshErr) {
        // Aborted by cancelPendingRefresh() — a concurrent login succeeded.
        // Queued requests were already resolved; just exit silently.
        if (refreshErr?.code === 'ERR_CANCELED' || refreshErr?.name === 'CanceledError') {
          return Promise.reject(refreshErr);
        }
        processQueue(refreshErr);
        openAuthRefreshCircuit();
        clearAccessToken();
        window.location.replace('/login');
        return Promise.reject(refreshErr);
      } finally {
        pendingRefreshController = null;
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
      status === 401 || status === 404 || status === 402 || status === 429 ||
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