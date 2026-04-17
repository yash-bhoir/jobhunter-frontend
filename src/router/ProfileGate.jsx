import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '@hooks/useAuth';
import { isProfileComplete } from '@utils/profileComplete';

/**
 * Guards /setup-profile:
 * - Not logged in → /login
 * - Logged in + profile already complete → /dashboard (no need to set up again)
 * - Logged in + profile incomplete → render the setup wizard
 */
export default function ProfileGate() {
  const { user, loading } = useAuth();

  if (loading) return (
    <div className="h-screen flex items-center justify-center bg-gray-50">
      <div className="animate-spin h-8 w-8 rounded-full border-4 border-blue-600 border-t-transparent" />
    </div>
  );

  if (!user) return <Navigate to="/login" replace />;
  if (isProfileComplete(user)) return <Navigate to="/dashboard" replace />;

  return <Outlet />;
}
