import { NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, Search, Briefcase, Users, Mail,
  User, CreditCard, Wallet, LogOut, Briefcase as Logo, X,
  ChevronLeft, Map,
} from 'lucide-react';
import { useAuth } from '@hooks/useAuth';
import { useToast } from '@hooks/useToast';
import { cn } from '@utils/helpers';
import { Linkedin } from 'lucide-react';

const NAV_ITEMS = [
  { to: '/dashboard',  label: 'Dashboard',    icon: LayoutDashboard },
  { to: '/search',     label: 'Job Search',   icon: Search },
  { to: '/map-search', label: 'Map Search',   icon: Map },
  { to: '/results',    label: 'Results',      icon: Briefcase },
  { to: '/recruiters', label: 'Recruiters',   icon: Users },
  { to: '/outreach',   label: 'Outreach',     icon: Mail },
  { to: '/profile',    label: 'Profile',      icon: User },
  { to: '/credits',    label: 'Credits',      icon: Wallet },
  { to: '/linkedin',   label: 'LinkedIn Jobs', icon: Linkedin },
  { to: '/billing',    label: 'Billing',      icon: CreditCard },
];

export default function Sidebar({ open, onClose }) {
  const { user, logout, isAdmin } = useAuth();
  const toast    = useToast();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    toast.success('Logged out');
    navigate('/login');
  };

  return (
    <>
      {/* Overlay for mobile */}
      {open && (
        <div
          className="fixed inset-0 bg-black/20 z-20 lg:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar */}
      <aside className={cn(
        'fixed lg:static inset-y-0 left-0 z-30 flex flex-col bg-white border-r border-gray-200 transition-all duration-300',
        open ? 'w-60' : 'w-0 lg:w-16 overflow-hidden'
      )}>

        {/* Logo */}
        <div className="flex items-center gap-3 px-4 h-16 border-b border-gray-100 flex-shrink-0">
          <div className="flex items-center justify-center w-8 h-8 bg-blue-600 rounded-lg flex-shrink-0">
            <Logo className="w-4 h-4 text-white" />
          </div>
          {open && <span className="font-bold text-gray-900 text-lg">JobHunter</span>}
        </div>

        {/* Navigation */}
        <nav className="flex-1 py-4 overflow-y-auto">
          {NAV_ITEMS.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) => cn(
                'flex items-center gap-3 mx-2 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors mb-0.5',
                isActive
                  ? 'bg-blue-50 text-blue-700'
                  : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
              )}
            >
              <Icon className="w-4 h-4 flex-shrink-0" />
              {open && <span>{label}</span>}
            </NavLink>
          ))}

          {/* Admin link */}
          {isAdmin && (
            <NavLink
              to="/admin"
              className={({ isActive }) => cn(
                'flex items-center gap-3 mx-2 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors mt-2 border-t border-gray-100 pt-4',
                isActive ? 'bg-purple-50 text-purple-700' : 'text-gray-600 hover:bg-gray-100'
              )}
            >
              <LayoutDashboard className="w-4 h-4 flex-shrink-0" />
              {open && <span>Admin Panel</span>}
            </NavLink>
          )}
        </nav>

        {/* User section */}
        <div className="border-t border-gray-100 p-3 flex-shrink-0">
          <div className={cn('flex items-center gap-3 mb-2', !open && 'justify-center')}>
            <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
              {user?.profile?.firstName?.[0]?.toUpperCase() || 'U'}
            </div>
            {open && (
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-gray-900 truncate">
                  {user?.profile?.firstName} {user?.profile?.lastName}
                </p>
                <p className="text-xs text-gray-500 truncate">{user?.email}</p>
              </div>
            )}
          </div>
          <button
            onClick={handleLogout}
            className={cn(
              'flex items-center gap-2 w-full px-3 py-2 rounded-lg text-sm text-gray-600 hover:bg-red-50 hover:text-red-600 transition-colors',
              !open && 'justify-center'
            )}
          >
            <LogOut className="w-4 h-4 flex-shrink-0" />
            {open && <span>Logout</span>}
          </button>
        </div>
      </aside>
    </>
  );
}