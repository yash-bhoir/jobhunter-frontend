import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Menu, Bell, Sun, Moon, Zap, ChevronDown, User, LogOut, CreditCard } from 'lucide-react';
import { useAuth }    from '@hooks/useAuth';
import { useCredits } from '@hooks/useCredits';
import { useTheme }   from '@context/ThemeContext';
import { useToast }   from '@hooks/useToast';
import { useNavigate } from 'react-router-dom';
import { cn }         from '@utils/helpers';
import { Badge }      from '@components/ui';

const PAGE_TITLES = {
  '/dashboard':      'Dashboard',
  '/search':         'Job Search',
  '/results':        'Results',
  '/recruiters':     'Recruiters',
  '/outreach':       'Outreach',
  '/outreach-manager': 'Outreach Manager',
  '/profile':        'Profile',
  '/credits':        'Credits',
  '/billing':        'Billing',
  '/linkedin':       'LinkedIn Jobs',
  '/career-scanner': 'Career Pages',
  '/map-search':     'Map Search',
  '/insights':       'Insights',
};

export default function Header({ onMenuClick }) {
  const { user, logout }        = useAuth();
  const { remaining, usagePct } = useCredits();
  const { isDark, toggle }      = useTheme();
  const toast                   = useToast();
  const navigate                = useNavigate();
  const location                = useLocation();
  const [dropOpen, setDropOpen] = useState(false);

  const pageTitle  = PAGE_TITLES[location.pathname] || 'JobHunter';
  const creditColor = usagePct >= 80 ? 'text-red-500' : usagePct >= 50 ? 'text-amber-500' : 'text-emerald-500';
  const barColor    = usagePct >= 80 ? 'bg-red-500'   : usagePct >= 50 ? 'bg-amber-500'   : 'bg-emerald-500';

  const planVariant = {
    pro:  'blue',
    team: 'purple',
    free: 'gray',
  };

  const initials = [user?.profile?.firstName?.[0], user?.profile?.lastName?.[0]]
    .filter(Boolean).join('').toUpperCase() || 'U';

  const handleLogout = async () => {
    setDropOpen(false);
    await logout();
    toast.success('Logged out');
    navigate('/login');
  };

  return (
    <header className="h-14 bg-white/95 backdrop-blur-sm border-b border-gray-100 flex items-center justify-between px-4 flex-shrink-0 sticky top-0 z-10">

      {/* Left — menu + breadcrumb */}
      <div className="flex items-center gap-3">
        <button
          onClick={onMenuClick}
          className="p-2 rounded-xl text-gray-500 hover:bg-gray-100 hover:text-gray-700 transition-colors"
          aria-label="Toggle sidebar"
        >
          <Menu className="w-5 h-5" />
        </button>
        <div className="hidden sm:block">
          <h1 className="text-sm font-semibold text-gray-900 leading-none">{pageTitle}</h1>
        </div>
      </div>

      {/* Right */}
      <div className="flex items-center gap-1.5">

        {/* Credits pill */}
        <Link
          to="/credits"
          className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-xl transition-colors group"
        >
          <Zap className={cn('w-3.5 h-3.5 flex-shrink-0', creditColor)} />
          <span className={cn('text-xs font-semibold', creditColor)}>{remaining}</span>
          <div className="w-14 h-1.5 bg-gray-200 rounded-full overflow-hidden">
            <div
              className={cn('h-full rounded-full transition-all', barColor)}
              style={{ width: `${Math.min(usagePct, 100)}%` }}
            />
          </div>
        </Link>

        {/* Plan badge */}
        <Badge
          variant={planVariant[user?.plan] || 'gray'}
          className="hidden capitalize md:inline-flex"
        >
          {user?.plan || 'free'}
        </Badge>

        {/* Dark mode */}
        <button
          onClick={toggle}
          className="p-2 rounded-xl text-gray-500 hover:bg-gray-100 hover:text-gray-700 transition-colors"
          aria-label="Toggle dark mode"
        >
          {isDark ? <Sun className="w-[18px] h-[18px]" />
                  : <Moon className="w-[18px] h-[18px]" />}
        </button>

        {/* Notifications */}
        <button className="relative p-2 rounded-xl text-gray-500 hover:bg-gray-100 hover:text-gray-700 transition-colors">
          <Bell className="w-[18px] h-[18px]" />
        </button>

        {/* Avatar + dropdown */}
        <div className="relative">
          <button
            onClick={() => setDropOpen(v => !v)}
            className="flex items-center gap-2 pl-1 pr-2 py-1 rounded-xl hover:bg-gray-100 transition-colors"
          >
            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-white text-xs font-bold shadow-sm">
              {initials}
            </div>
            <ChevronDown className={cn('w-3.5 h-3.5 text-gray-400 transition-transform duration-200', dropOpen && 'rotate-180')} />
          </button>

          {dropOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setDropOpen(false)} />
              <div className="absolute right-0 top-full mt-1.5 w-52 bg-white rounded-2xl border border-gray-100 shadow-elevated z-20 animate-scale-in overflow-hidden">
                {/* User info */}
                <div className="px-4 py-3 border-b border-gray-100">
                  <p className="text-sm font-semibold text-gray-900 truncate">
                    {user?.profile?.firstName} {user?.profile?.lastName}
                  </p>
                  <p className="text-xs text-gray-400 truncate mt-0.5">{user?.email}</p>
                </div>
                {/* Menu items */}
                <div className="py-1.5">
                  {[
                    { to: '/profile',  icon: User,       label: 'Profile'     },
                    { to: '/credits',  icon: Zap,        label: 'Credits'     },
                    { to: '/billing',  icon: CreditCard, label: 'Billing'     },
                  ].map(({ to, icon: Icon, label }) => (
                    <Link
                      key={to}
                      to={to}
                      onClick={() => setDropOpen(false)}
                      className="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-600 hover:bg-gray-50 hover:text-gray-900 transition-colors"
                    >
                      <Icon className="w-4 h-4 text-gray-400" />
                      {label}
                    </Link>
                  ))}
                </div>
                <div className="border-t border-gray-100 py-1.5">
                  <button
                    onClick={handleLogout}
                    className="flex items-center gap-3 w-full px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors"
                  >
                    <LogOut className="w-4 h-4" />
                    Sign out
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
