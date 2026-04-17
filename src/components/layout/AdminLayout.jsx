import { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, Users, BarChart2, Key, CreditCard,
  Flag, Bell, Megaphone, Shield, LogOut, Briefcase,
  ChevronRight, Activity, Menu, X, AlertTriangle
} from 'lucide-react';
import { useAuth }  from '@hooks/useAuth';
import { useToast } from '@hooks/useToast';
import { cn }       from '@utils/helpers';

const NAV = [
  { to: '/admin',           label: 'Overview',    icon: LayoutDashboard, exact: true },
  { to: '/admin/users',     label: 'Users',       icon: Users },
  { to: '/admin/analytics', label: 'Analytics',   icon: BarChart2 },
  { to: '/admin/api-keys',  label: 'API Keys',    icon: Key },
  { to: '/admin/plans',     label: 'Plans',       icon: CreditCard },
  { to: '/admin/features',  label: 'Features',    icon: Flag },
  { to: '/admin/alerts',    label: 'Alerts',      icon: Bell },
  { to: '/admin/comms',     label: 'Comms',       icon: Megaphone },
  { to: '/admin/audit',       label: 'Audit Log',   icon: Shield },
  { to: '/admin/error-logs',  label: 'Error Logs',  icon: AlertTriangle },
];

export default function AdminLayout({ children }) {
  const { user, logout } = useAuth();
  const toast    = useToast();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const handleLogout = async () => {
    await logout();
    toast.success('Logged out');
    navigate('/login');
  };

  const SidebarContent = () => (
    <>
      {/* Logo */}
      <div className="flex items-center gap-3 px-4 h-16 border-b border-gray-800 flex-shrink-0">
        <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center flex-shrink-0">
          <Briefcase className="w-4 h-4 text-white" />
        </div>
        <div className="flex-1">
          <p className="font-bold text-white text-sm">JobHunter</p>
          <p className="text-xs text-gray-400">Admin Panel</p>
        </div>
        <button onClick={() => setSidebarOpen(false)} className="lg:hidden p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-gray-800 transition-colors">
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Nav */}
      <nav className="flex-1 py-4 overflow-y-auto">
        {NAV.map(({ to, label, icon: Icon, exact }) => (
          <NavLink
            key={to}
            to={to}
            end={exact}
            onClick={() => setSidebarOpen(false)}
            className={({ isActive }) => cn(
              'flex items-center gap-3 mx-2 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors mb-0.5',
              isActive
                ? 'bg-blue-600 text-white'
                : 'text-gray-400 hover:bg-gray-800 hover:text-white'
            )}
          >
            <Icon className="w-4 h-4 flex-shrink-0" />
            <span className="flex-1">{label}</span>
          </NavLink>
        ))}
      </nav>

      {/* User */}
      <div className="border-t border-gray-800 p-3 flex-shrink-0">
        <div className="flex items-center gap-2 mb-2">
          <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-xs font-bold flex-shrink-0">
            {user?.profile?.firstName?.[0] || 'A'}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium text-white truncate">
              {user?.profile?.firstName} {user?.profile?.lastName}
            </p>
            <p className="text-xs text-gray-400 truncate">{user?.role}</p>
          </div>
        </div>
        <button
          onClick={handleLogout}
          className="flex items-center gap-2 w-full px-3 py-2 rounded-lg text-sm text-gray-400 hover:bg-gray-800 hover:text-red-400 transition-colors"
        >
          <LogOut className="w-4 h-4" />
          Logout
        </button>
      </div>
    </>
  );

  return (
    <div className="flex h-screen bg-gray-950 text-white overflow-hidden">

      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-20 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar — fixed drawer on mobile, static on desktop */}
      <aside className={cn(
        'fixed lg:static inset-y-0 left-0 z-30 w-60 bg-gray-900 border-r border-gray-800 flex flex-col transition-transform duration-300 ease-in-out',
        sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
      )}>
        <SidebarContent />
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden bg-gray-50 text-gray-900">
        {/* Top bar */}
        <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-4 sm:px-6 flex-shrink-0">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden p-2 rounded-lg text-gray-500 hover:bg-gray-100 transition-colors"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <span className="hidden sm:inline">Admin</span>
              <ChevronRight className="hidden sm:block w-4 h-4" />
              <span className="text-gray-900 font-medium">Dashboard</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-green-500" />
            <span className="text-xs text-green-600 font-medium hidden sm:inline">System Online</span>
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6">
          {children}
        </main>
      </div>
    </div>
  );
}