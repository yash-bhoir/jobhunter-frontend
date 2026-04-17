import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '@hooks/useAuth';
import UserLayout  from '@components/layout/UserLayout';
import { isProfileComplete } from '@utils/profileComplete';

// Pages the user may visit even before completing their profile.
// Profile itself is always accessible so they can edit from there too.
const PROFILE_EXEMPT = ['/profile'];

export default function ProtectedRoute() {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) return (
    <div className="h-screen flex items-center justify-center bg-gray-50">
      <div className="animate-spin h-8 w-8 rounded-full border-4 border-blue-600 border-t-transparent" />
    </div>
  );

  if (!user) return <Navigate to="/login" replace />;
  if (!user.emailVerified) return <Navigate to="/verify-email" replace />;

  // Profile gate — block all pages except exempt ones
  const exempt = PROFILE_EXEMPT.some(p => location.pathname.startsWith(p));
  if (!exempt && !isProfileComplete(user)) {
    return <Navigate to="/setup-profile" replace />;
  }

  return (
    <UserLayout>
      <Outlet />
    </UserLayout>
  );
}
