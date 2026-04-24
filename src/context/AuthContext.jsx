import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import toast from 'react-hot-toast';
import { api, cancelPendingRefresh } from '@utils/axios';
import { setAccessToken, clearAccessToken, clearAuthRefreshCircuit } from '@utils/accessToken';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user,    setUser]    = useState(null);
  const [loading, setLoading] = useState(true);
  const meAbortRef   = useRef(null);
  /** Bumps on login / OAuth hydrate so a late `/auth/me` from before auth cannot clear `user`. */
  const authGenRef   = useRef(0);

  const fetchMe = useCallback(async () => {
    const gen = ++authGenRef.current;
    meAbortRef.current?.abort();
    const ctrl = new AbortController();
    meAbortRef.current = ctrl;
    try {
      const { data } = await api.get('/auth/me', { signal: ctrl.signal });
      if (gen !== authGenRef.current) return;
      setUser(data.data);
    } catch (err) {
      if (err?.code === 'ERR_CANCELED' || err?.name === 'CanceledError') return;
      if (gen !== authGenRef.current) return;
      // Do not clear session on rate limit — token may still be valid; avoids login ↔ dashboard loops.
      if (err?.response?.status === 429) {
        toast.error('Too many requests. Wait a few seconds, then refresh the page.');
        return;
      }
      setUser(null);
    } finally {
      if (gen === authGenRef.current) setLoading(false);
    }
  }, []);

  // Abort in-flight /auth/me on unmount (incl. React StrictMode remount) so we do not stack parallel session calls.
  useEffect(() => {
    fetchMe();
    return () => { meAbortRef.current?.abort(); };
  }, [fetchMe]);

  const login = async (credentials) => {
    cancelPendingRefresh(); // abort any stale token-refresh so it can't redirect back to /login
    authGenRef.current += 1;
    meAbortRef.current?.abort();
    try {
      const { data } = await api.post('/auth/login', credentials);
      // Admin 2-FA: backend returns { otpRequired: true, userId } — no token yet
      if (data.data?.otpRequired) return data.data;
      clearAuthRefreshCircuit();
      setUser(data.data.user);
      return data.data;
    } finally {
      setLoading(false);
    }
  };

  // After admin OTP or OAuth: optional accessToken (Google may set token in URL before this)
  const loginWithToken = (userData, accessToken = null) => {
    authGenRef.current += 1;
    meAbortRef.current?.abort();
    if (accessToken) setAccessToken(accessToken);
    clearAuthRefreshCircuit();
    setUser(userData);
    setLoading(false);
  };

  const register = async (payload) => {
    const { data } = await api.post('/auth/register', payload);
    return data;
  };

  const logout = async () => {
    try { await api.post('/auth/logout'); } catch {}
    authGenRef.current += 1;
    meAbortRef.current?.abort();
    clearAccessToken();
    clearAuthRefreshCircuit();
    setUser(null);
  };

  const updateUser  = (updates) => setUser(prev => prev ? { ...prev, ...updates } : prev);
  const isAdmin     = user?.role === 'admin' || user?.role === 'super_admin';
  const isSuperAdmin = user?.role === 'super_admin';

  return (
    <AuthContext.Provider value={{ user, loading, login, loginWithToken, register, logout, updateUser, isAdmin, isSuperAdmin, refetch: fetchMe }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuthContext = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuthContext must be used inside AuthProvider');
  return ctx;
};