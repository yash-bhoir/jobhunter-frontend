import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '@hooks/useAuth';

export default function GuestRoute() {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (user) return <Navigate to="/dashboard" replace />;
  return <Outlet />;
}