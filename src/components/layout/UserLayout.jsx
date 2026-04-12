import { useState, useEffect } from 'react';
import { Outlet, NavLink, useLocation } from 'react-router-dom';
import { LayoutDashboard, Search, Briefcase, Mail, User } from 'lucide-react';
import Sidebar from './Sidebar';
import Header  from './Header';
import { cn }  from '@utils/helpers';

// Bottom nav shown on mobile only — 5 most important routes
const MOBILE_NAV = [
  { to: '/dashboard',  label: 'Home',     icon: LayoutDashboard },
  { to: '/search',     label: 'Search',   icon: Search          },
  { to: '/results',    label: 'Jobs',     icon: Briefcase       },
  { to: '/outreach',   label: 'Outreach', icon: Mail            },
  { to: '/profile',    label: 'Profile',  icon: User            },
];

export default function UserLayout() {
  const location = useLocation();
  // Default open on desktop, closed on mobile
  const [sidebarOpen, setSidebarOpen] = useState(() => window.innerWidth >= 1024);

  // Close sidebar on mobile when route changes
  useEffect(() => {
    if (window.innerWidth < 1024) setSidebarOpen(false);
  }, [location.pathname]);

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <Header onMenuClick={() => setSidebarOpen(v => !v)} />

        {/* Main content — extra bottom padding on mobile for bottom nav */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 pb-24 lg:pb-6">
          <Outlet />
        </main>
      </div>

      {/* Mobile bottom navigation */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 lg:hidden bg-white/95 backdrop-blur-sm border-t border-gray-100 safe-area-inset-bottom">
        <div className="flex items-center justify-around px-2 py-1">
          {MOBILE_NAV.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) => cn(
                'flex flex-col items-center gap-0.5 px-3 py-2 rounded-xl min-w-0 transition-all duration-150',
                isActive ? 'text-blue-600' : 'text-gray-400'
              )}
            >
              {({ isActive }) => (
                <>
                  <span className={cn(
                    'flex items-center justify-center w-8 h-8 rounded-xl transition-all duration-150',
                    isActive ? 'bg-blue-50' : ''
                  )}>
                    <Icon className="w-5 h-5" />
                  </span>
                  <span className={cn(
                    'text-[10px] font-medium leading-none',
                    isActive ? 'text-blue-600' : 'text-gray-400'
                  )}>
                    {label}
                  </span>
                </>
              )}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  );
}
