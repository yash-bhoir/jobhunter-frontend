import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { api } from '@utils/axios';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user,    setUser]    = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchMe = useCallback(async () => {
    try {
      const { data } = await api.get('/auth/me');
      setUser(data.data);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchMe(); }, [fetchMe]);

  const login = async (credentials) => {
    const { data } = await api.post('/auth/login', credentials);
    // Admin 2-FA: backend returns { otpRequired: true, userId } — no token yet
    if (data.data?.otpRequired) return data.data;
    setUser(data.data.user);
    return data.data;
  };

  // Called after admin OTP is verified to hydrate auth state
  const loginWithToken = (userData) => {
    setUser(userData);
  };

  const register = async (payload) => {
    const { data } = await api.post('/auth/register', payload);
    return data;
  };

  const logout = async () => {
    try { await api.post('/auth/logout'); } catch {}
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