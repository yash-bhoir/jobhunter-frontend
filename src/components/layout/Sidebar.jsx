import { NavLink, useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import {
  LayoutDashboard, Search, Briefcase, Users, Mail,
  User, CreditCard, Wallet, LogOut, X, Linkedin,
  ChevronRight, Sparkles, BarChart2, Map,
} from 'lucide-react';
import { useAuth }  from '@hooks/useAuth';
import { useToast } from '@hooks/useToast';
import { cn }       from '@utils/helpers';
import { api }      from '@utils/axios';

const NAV_ITEMS = [
  { to: '/dashboard',  label: 'Dashboard',    icon: LayoutDashboard, color: 'blue'   },
  { to: '/search',     label: 'Job Search',   icon: Search,          color: 'violet' },
  { to: '/map-search', label: 'Map Search',   icon: Map,             color: 'cyan'   },
  { to: '/results',    label: 'Results',      icon: Briefcase,       color: 'indigo' },
  { to: '/recruiters', label: 'Recruiters',   icon: Users,           color: 'cyan'   },
  { to: '/outreach',   label: 'Outreach',     icon: Mail,            color: 'emerald'},
  { to: '/linkedin',   label: 'LinkedIn',     icon: Linkedin,        color: 'blue'   },
  { to: '/insights',   label: 'Insights',     icon: BarChart2,       color: 'violet' },
];

const BOTTOM_ITEMS = [
  { to: '/profile',    label: 'Profile',      icon: User,            color: 'slate'  },
  { to: '/credits',    label: 'Credits',      icon: Wallet,          color: 'amber'  },
  { to: '/billing',    label: 'Billing',      icon: CreditCard,      color: 'rose'   },
];

const ICON_COLORS = {
  blue:    { bg: 'bg-blue-50',    icon: 'text-blue-600'    },
  violet:  { bg: 'bg-violet-50',  icon: 'text-violet-600'  },
  indigo:  { bg: 'bg-indigo-50',  icon: 'text-indigo-600'  },
  cyan:    { bg: 'bg-cyan-50',    icon: 'text-cyan-600'    },
  emerald: { bg: 'bg-emerald-50', icon: 'text-emerald-600' },
  amber:   { bg: 'bg-amber-50',   icon: 'text-amber-600'   },
  rose:    { bg: 'bg-rose-50',    icon: 'text-rose-600'    },
  slate:   { bg: 'bg-slate-100',  icon: 'text-slate-600'   },
};

function NavItem({ to, label, icon: Icon, color, expanded, badge }) {
  const c = ICON_COLORS[color] || ICON_COLORS.blue;
  return (
    <NavLink
      to={to}
      title={!expanded ? label : undefined}
      className={({ isActive }) => cn(
        'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 group relative',
        expanded ? '' : 'justify-center',
        isActive
          ? 'bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400'
          : 'text-gray-500 hover:bg-gray-100 hover:text-gray-800 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200'
      )}
    >
      {({ isActive }) => (
        <>
          <span className={cn(
            'flex items-center justify-center w-7 h-7 rounded-lg flex-shrink-0 transition-all duration-150 relative',
            isActive ? `${c.bg} ${c.icon}` : 'text-gray-400 group-hover:text-gray-600'
          )}>
            <Icon className="w-4 h-4" />
            {badge > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center leading-none">
                {badge > 99 ? '99+' : badge}
              </span>
            )}
          </span>
          {expanded && (
            <span className="flex-1 truncate">{label}</span>
          )}
          {expanded && badge > 0 && (
            <span className="ml-auto px-1.5 py-0.5 bg-red-500 text-white text-[10px] font-bold rounded-full leading-none">
              {badge > 99 ? '99+' : badge}
            </span>
          )}
          {expanded && isActive && !badge && (
            <ChevronRight className="w-3.5 h-3.5 opacity-40 flex-shrink-0" />
          )}
          {/* Tooltip for collapsed state */}
          {!expanded && (
            <span className="absolute left-full ml-2 px-2 py-1 bg-gray-900 text-white text-xs rounded-lg
                             opacity-0 invisible group-hover:opacity-100 group-hover:visible
                             transition-all duration-150 whitespace-nowrap z-50 pointer-events-none">
              {label}
            </span>
          )}
        </>
      )}
    </NavLink>
  );
}

export default function Sidebar({ open, onClose }) {
  const { user, logout, isAdmin } = useAuth();
  const toast    = useToast();
  const navigate = useNavigate();
  const [linkedinUnread, setLinkedinUnread] = useState(0);

  // Poll for unread LinkedIn jobs every 5 minutes
  useEffect(() => {
    let cancelled = false;
    const fetch = async () => {
      try {
        const { data } = await api.get('/linkedin/unread-count');
        if (!cancelled) setLinkedinUnread(data.data?.count || 0);
      } catch { /* silent */ }
    };
    fetch();
    const interval = setInterval(fetch, 5 * 60 * 1000);
    return () => { cancelled = true; clearInterval(interval); };
  }, []);

  const handleLogout = async () => {
    await logout();
    toast.success('Logged out');
    navigate('/login');
  };

  const initials = [user?.profile?.firstName?.[0], user?.profile?.lastName?.[0]]
    .filter(Boolean).join('').toUpperCase() || 'U';

  return (
    <>
      {/* Mobile overlay */}
      {open && (
        <div
          className="fixed inset-0 bg-black/40 backdrop-blur-sm z-20 lg:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar */}
      <aside className={cn(
        'fixed lg:static inset-y-0 left-0 z-30 flex flex-col border-r border-gray-100 bg-white transition-all duration-300 ease-in-out',
        open ? 'w-60' : 'w-0 lg:w-[68px] overflow-hidden'
      )}>

        {/* Logo */}
        <div className={cn(
          'flex items-center h-16 border-b border-gray-100 flex-shrink-0 transition-all duration-300',
          open ? 'px-4 gap-3' : 'justify-center px-2'
        )}>
          <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-gradient-to-br from-blue-600 to-blue-500 shadow-sm shadow-blue-200 flex-shrink-0">
            <Sparkles className="w-4.5 h-4.5 text-white" style={{width:'18px',height:'18px'}} />
          </div>
          {open && (
            <div className="min-w-0">
              <span className="font-bold text-gray-900 text-base tracking-tight">JobHunter</span>
              <span className="block text-[10px] text-blue-600 font-medium -mt-0.5">AI-Powered</span>
            </div>
          )}
          {open && (
            <button onClick={onClose} className="ml-auto p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 lg:hidden transition-colors">
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Main nav */}
        <nav className="flex-1 py-3 px-2 space-y-0.5 overflow-y-auto overflow-x-hidden">
          {open && (
            <p className={cn('text-[10px] font-semibold text-gray-400 uppercase tracking-widest mb-2 px-1 transition-opacity', open ? 'opacity-100' : 'opacity-0')}>
              Main
            </p>
          )}
          {NAV_ITEMS.map(item => (
            <NavItem
              key={item.to}
              {...item}
              expanded={open}
              badge={item.to === '/linkedin' ? linkedinUnread : 0}
            />
          ))}

          {open && <div className="pt-3 pb-2"><div className="h-px bg-gray-100" /></div>}
          {!open && <div className="py-2"><div className="h-px bg-gray-100 mx-1" /></div>}

          {open && (
            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest mb-2 px-1">
              Account
            </p>
          )}
          {BOTTOM_ITEMS.map(item => (
            <NavItem key={item.to} {...item} expanded={open} />
          ))}

          {/* Admin link */}
          {isAdmin && (
            <>
              {open && <div className="pt-3 pb-2"><div className="h-px bg-gray-100" /></div>}
              {!open && <div className="py-2"><div className="h-px bg-gray-100 mx-1" /></div>}
              <NavLink
                to="/admin"
                title={!open ? 'Admin Panel' : undefined}
                className={({ isActive }) => cn(
                  'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 group relative',
                  open ? '' : 'justify-center',
                  isActive
                    ? 'bg-purple-50 text-purple-700'
                    : 'text-gray-500 hover:bg-purple-50 hover:text-purple-700'
                )}
              >
                <span className="flex items-center justify-center w-7 h-7 rounded-lg bg-purple-50 text-purple-600 flex-shrink-0">
                  <LayoutDashboard className="w-4 h-4" />
                </span>
                {open && <span className="flex-1">Admin Panel</span>}
                {!open && (
                  <span className="absolute left-full ml-2 px-2 py-1 bg-gray-900 text-white text-xs rounded-lg
                                   opacity-0 invisible group-hover:opacity-100 group-hover:visible
                                   transition-all duration-150 whitespace-nowrap z-50 pointer-events-none">
                    Admin Panel
                  </span>
                )}
              </NavLink>
            </>
          )}
        </nav>

        {/* User section */}
        <div className="border-t border-gray-100 p-2 flex-shrink-0">
          {open ? (
            <div className="flex items-center gap-3 p-2 rounded-xl hover:bg-gray-50 transition-colors cursor-default">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-white text-xs font-bold flex-shrink-0 shadow-sm">
                {initials}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-gray-900 truncate leading-tight">
                  {user?.profile?.firstName || 'User'} {user?.profile?.lastName || ''}
                </p>
                <p className="text-xs text-gray-400 truncate">{user?.email}</p>
              </div>
            </div>
          ) : (
            <div className="flex justify-center mb-1">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-white text-xs font-bold shadow-sm">
                {initials}
              </div>
            </div>
          )}
          <button
            onClick={handleLogout}
            title={!open ? 'Logout' : undefined}
            className={cn(
              'flex items-center gap-2 w-full px-3 py-2 rounded-xl text-sm text-gray-500 hover:bg-red-50 hover:text-red-600 transition-all duration-150 mt-1 group relative',
              !open && 'justify-center'
            )}
          >
            <LogOut className="w-4 h-4 flex-shrink-0" />
            {open && <span>Sign out</span>}
            {!open && (
              <span className="absolute left-full ml-2 px-2 py-1 bg-gray-900 text-white text-xs rounded-lg
                               opacity-0 invisible group-hover:opacity-100 group-hover:visible
                               transition-all duration-150 whitespace-nowrap z-50 pointer-events-none">
                Sign out
              </span>
            )}
          </button>
        </div>
      </aside>
    </>
  );
}
