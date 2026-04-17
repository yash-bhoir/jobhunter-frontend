import { Routes, Route, Navigate } from 'react-router-dom';
import ProtectedRoute from './ProtectedRoute';
import AdminRoute     from './AdminRoute';
import GuestRoute     from './GuestRoute';

// Auth pages
import Login          from '@pages/auth/Login';
import Register       from '@pages/auth/Register';
import ForgotPassword from '@pages/auth/ForgotPassword';
import ResetPassword  from '@pages/auth/ResetPassword';
import VerifyEmail    from '@pages/auth/VerifyEmail';
import OAuthCallback  from '@pages/auth/OAuthCallback';

// User pages
import Dashboard      from '@pages/user/Dashboard';
import Search         from '@pages/user/Search';
import Results        from '@pages/user/Results';
import Recruiters     from '@pages/user/Recruiters';
import Outreach       from '@pages/user/Outreach';
import OutreachManager from '@pages/user/OutreachManager';
import Profile        from '@pages/user/Profile';
import Credits        from '@pages/user/Credits';
import Billing        from '@pages/user/Billing';
import LinkedIn       from '@pages/user/LinkedIn';
import MapSearch      from '@pages/user/MapSearch';

// Admin pages
import AdminOverview  from '@pages/admin/Overview';
import AdminUsers     from '@pages/admin/Users';
import AdminAnalytics from '@pages/admin/Analytics';
import AdminApiKeys   from '@pages/admin/ApiKeys';
import AdminPlans     from '@pages/admin/Plans';
import AdminFeatures  from '@pages/admin/Features';
import AdminAlerts    from '@pages/admin/Alerts';
import AdminComms     from '@pages/admin/Comms';
import AdminAuditLog  from '@pages/admin/AuditLog';

// Error pages
import NotFound      from '@pages/errors/NotFound';
import Maintenance   from '@pages/errors/Maintenance';
import Unauthorized  from '@pages/errors/Unauthorized';

export default function AppRouter() {
  return (
    <Routes>
      {/* Public — always accessible */}
      <Route path="/maintenance"   element={<Maintenance />} />
      <Route path="/auth/callback" element={<OAuthCallback />} />
      <Route path="/unauthorized"  element={<Unauthorized />} />

      {/* Guest only — redirect to dashboard if logged in */}
      <Route element={<GuestRoute />}>
        <Route path="/login"           element={<Login />} />
        <Route path="/register"        element={<Register />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password"  element={<ResetPassword />} />
        <Route path="/verify-email"    element={<VerifyEmail />} />
      </Route>

      {/* Protected user routes */}
      <Route element={<ProtectedRoute />}>
        <Route path="/dashboard"        element={<Dashboard />} />
        <Route path="/search"           element={<Search />} />
        <Route path="/results"          element={<Results />} />
        <Route path="/recruiters"       element={<Recruiters />} />
        <Route path="/outreach"         element={<Outreach />} />
        <Route path="/outreach-manager" element={<OutreachManager />} />
        <Route path="/profile"          element={<Profile />} />
        <Route path="/credits"          element={<Credits />} />
        <Route path="/billing"          element={<Billing />} />
        <Route path="/linkedin"          element={<LinkedIn />} />
        <Route path="/map-search"        element={<MapSearch />} />
      </Route>

      {/* Admin routes */}
      <Route element={<AdminRoute />}>
        <Route path="/admin"           element={<AdminOverview />} />
        <Route path="/admin/users"     element={<AdminUsers />} />
        <Route path="/admin/analytics" element={<AdminAnalytics />} />
        <Route path="/admin/api-keys"  element={<AdminApiKeys />} />
        <Route path="/admin/plans"     element={<AdminPlans />} />
        <Route path="/admin/features"  element={<AdminFeatures />} />
        <Route path="/admin/alerts"    element={<AdminAlerts />} />
        <Route path="/admin/comms"     element={<AdminComms />} />
        <Route path="/admin/audit"     element={<AdminAuditLog />} />
      </Route>

      <Route path="/"  element={<Navigate to="/dashboard" replace />} />
      <Route path="*"  element={<NotFound />} />
    </Routes>
  );
}
