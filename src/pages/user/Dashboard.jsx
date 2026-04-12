import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Search, Briefcase, Mail, Users, TrendingUp,
  ArrowRight, Star, Target, Plus,
  ChevronRight, Sparkles,
} from 'lucide-react';
import { useAuth }    from '@hooks/useAuth';
import { useCredits } from '@hooks/useCredits';
import { api }        from '@utils/axios';
import { fAgo }       from '@utils/formatters';
import { cn }         from '@utils/helpers';

function getTimeOfDay() {
  const h = new Date().getHours();
  if (h < 12) return 'morning';
  if (h < 17) return 'afternoon';
  return 'evening';
}

const STAT_CONFIG = [
  { key: 'totalSearches', label: 'Searches',  icon: Search,    bg: 'bg-blue-50',    text: 'text-blue-600'   },
  { key: 'totalJobs',     label: 'Jobs Found', icon: Briefcase, bg: 'bg-violet-50',  text: 'text-violet-600' },
  { key: 'appliedJobs',   label: 'Applied',    icon: Target,    bg: 'bg-emerald-50', text: 'text-emerald-600'},
  { key: 'interviewJobs', label: 'Interviews', icon: Star,      bg: 'bg-amber-50',   text: 'text-amber-600'  },
];

const QUICK_ACTIONS = [
  { to: '/search',     label: 'Search Jobs',       sub: 'Find matching positions',  icon: Search,     color: 'blue'    },
  { to: '/recruiters', label: 'Find HR Contacts',  sub: 'Discover decision makers', icon: Users,      color: 'cyan'    },
  { to: '/outreach',   label: 'Send Outreach',     sub: 'Email recruiters directly', icon: Mail,      color: 'emerald' },
  { to: '/profile',    label: 'Update Profile',    sub: 'Keep your data fresh',     icon: TrendingUp, color: 'violet'  },
];

const ACTION_COLORS = {
  blue:    { bg: 'bg-blue-50',    icon: 'text-blue-600',    hover: 'hover:bg-blue-50'    },
  cyan:    { bg: 'bg-cyan-50',    icon: 'text-cyan-600',    hover: 'hover:bg-cyan-50'    },
  emerald: { bg: 'bg-emerald-50', icon: 'text-emerald-600', hover: 'hover:bg-emerald-50' },
  violet:  { bg: 'bg-violet-50',  icon: 'text-violet-600',  hover: 'hover:bg-violet-50'  },
};

export default function Dashboard() {
  const { user }                = useAuth();
  const { remaining, usagePct } = useCredits();
  const [stats,      setStats]  = useState(null);
  const [recentJobs, setJobs]   = useState([]);
  const [loading,    setLoad]   = useState(true);

  useEffect(() => {
    Promise.all([
      api.get('/user/stats').catch(() => ({ data: { data: null } })),
      api.get('/jobs?limit=6&sort=matchScore').catch(() => ({ data: { data: [] } })),
    ]).then(([s, j]) => {
      setStats(s.data.data);
      setJobs(j.data.data || []);
    }).finally(() => setLoad(false));
  }, []);

  const firstName  = user?.profile?.firstName || 'there';
  const creditColor = usagePct >= 80 ? 'text-red-500' : usagePct >= 50 ? 'text-amber-500' : 'text-emerald-500';
  const barColor    = usagePct >= 80 ? 'bg-red-500'   : usagePct >= 50 ? 'bg-amber-500'   : 'bg-emerald-500';

  return (
    <div className="max-w-6xl mx-auto space-y-5 animate-fade-in-up">

      {/* ── Welcome banner ─────────────────────────────────────── */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-blue-600 via-blue-600 to-indigo-700 p-6 text-white shadow-elevated">
        {/* Background decoration */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-8 -right-8 w-40 h-40 rounded-full bg-white/5" />
          <div className="absolute -bottom-10 -left-6 w-52 h-52 rounded-full bg-white/5" />
          <div className="absolute top-4 right-20 w-20 h-20 rounded-full bg-white/5" />
        </div>
        <div className="relative flex items-center justify-between gap-4">
          <div>
            <p className="text-blue-200 text-sm font-medium mb-1">Good {getTimeOfDay()}!</p>
            <h1 className="text-2xl font-bold tracking-tight">
              Welcome back, {firstName} 👋
            </h1>
            <p className="text-blue-100 text-sm mt-1.5 max-w-xs">
              Your AI-powered job search is ready. Let's find your next opportunity.
            </p>
          </div>
          <Link
            to="/search"
            className="flex-shrink-0 flex items-center gap-2 bg-white text-blue-700 font-semibold text-sm px-4 py-2.5 rounded-xl hover:bg-blue-50 transition-colors shadow-sm"
          >
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">New Search</span>
            <span className="sm:hidden">Search</span>
          </Link>
        </div>
      </div>

      {/* ── Stats row ──────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {STAT_CONFIG.map(({ key, label, icon: Icon, bg, text }) => {
          const value = stats?.[key] ?? 0;
          return (
            <div key={key} className="card card-body group hover:shadow-md hover:-translate-y-0.5 transition-all duration-200">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs font-medium text-gray-500">{label}</p>
                  <p className="text-2xl font-bold text-gray-900 mt-1 tabular-nums">
                    {loading ? <span className="skeleton inline-block w-8 h-7 rounded" /> : value}
                  </p>
                </div>
                <div className={cn('w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0', bg)}>
                  <Icon className={cn('w-4.5 h-4.5', text)} style={{width:'18px',height:'18px'}} />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="grid lg:grid-cols-3 gap-5">

        {/* ── Recent jobs ────────────────────────────────────── */}
        <div className="lg:col-span-2 card overflow-hidden">
          <div className="card-header flex items-center justify-between">
            <div>
              <h2 className="font-semibold text-gray-900">Recent Matches</h2>
              <p className="text-xs text-gray-400 mt-0.5">Sorted by match score</p>
            </div>
            <Link to="/results" className="flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-700 transition-colors">
              View all <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {loading ? (
            <div className="divide-y divide-gray-100">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="p-4 flex items-center gap-3">
                  <div className="skeleton w-9 h-9 rounded-xl flex-shrink-0" />
                  <div className="flex-1 space-y-2">
                    <div className="skeleton h-3 w-3/4 rounded" />
                    <div className="skeleton h-2.5 w-1/2 rounded" />
                  </div>
                  <div className="skeleton h-5 w-10 rounded-full" />
                </div>
              ))}
            </div>
          ) : recentJobs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-14 px-6 text-center">
              <div className="w-14 h-14 rounded-2xl bg-blue-50 flex items-center justify-center mb-4">
                <Search className="w-7 h-7 text-blue-400" />
              </div>
              <p className="font-semibold text-gray-900 mb-1">No jobs yet</p>
              <p className="text-sm text-gray-400 mb-4">Run your first AI-powered job search</p>
              <Link to="/search" className="btn btn-primary btn-sm">
                <Search className="w-3.5 h-3.5" /> Start Searching
              </Link>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {recentJobs.map(job => (
                <div key={job._id} className="flex items-center gap-3 px-4 py-3.5 hover:bg-slate-50 transition-colors group">
                  {/* Company avatar */}
                  <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center text-gray-600 font-bold text-xs flex-shrink-0">
                    {job.company?.[0]?.toUpperCase() || '?'}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-gray-900 text-sm truncate">{job.title}</p>
                    <p className="text-xs text-gray-400 mt-0.5 truncate">{job.company} · {job.location}</p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className={cn(
                      'badge text-xs',
                      job.matchScore >= 75 ? 'badge-green' :
                      job.matchScore >= 50 ? 'badge-amber' : 'badge-gray'
                    )}>
                      {job.matchScore}%
                    </span>
                    {job.postedAt && (
                      <span className="hidden sm:block text-xs text-gray-400">{fAgo(job.postedAt)}</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── Right column ───────────────────────────────────── */}
        <div className="space-y-4">

          {/* Credits card */}
          <div className="card card-body">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-gray-900 text-sm">Credits</h3>
              <Link to="/credits" className="text-xs text-blue-600 hover:text-blue-700 font-medium">Top up →</Link>
            </div>
            <div className="flex items-end gap-1.5 mb-3">
              <span className={cn('text-3xl font-bold tabular-nums', creditColor)}>{remaining}</span>
              <span className="text-gray-400 text-sm mb-0.5">remaining</span>
            </div>
            <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
              <div
                className={cn('h-full rounded-full transition-all duration-500', barColor)}
                style={{ width: `${Math.min(usagePct, 100)}%` }}
              />
            </div>
            <div className="flex justify-between text-xs text-gray-400 mt-1.5">
              <span>{usagePct}% used</span>
              <span className={cn('font-medium capitalize badge', user?.plan === 'pro' ? 'badge-blue' : user?.plan === 'team' ? 'badge-purple' : 'badge-gray')}>
                {user?.plan || 'free'}
              </span>
            </div>
            {usagePct >= 80 && (
              <div className="mt-3 p-2.5 bg-red-50 rounded-xl">
                <p className="text-xs text-red-700 font-medium">Running low on credits</p>
                <Link to="/billing" className="text-xs text-red-600 hover:text-red-700 underline mt-0.5 block">Upgrade plan</Link>
              </div>
            )}
          </div>

          {/* Quick actions */}
          <div className="card overflow-hidden">
            <div className="card-header">
              <h3 className="font-semibold text-gray-900 text-sm">Quick Actions</h3>
            </div>
            <div className="divide-y divide-gray-100">
              {QUICK_ACTIONS.map(({ to, label, sub, icon: Icon, color }) => {
                const c = ACTION_COLORS[color];
                return (
                  <Link
                    key={to}
                    to={to}
                    className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50 transition-colors group"
                  >
                    <div className={cn('w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0', c.bg)}>
                      <Icon className={cn('w-4 h-4', c.icon)} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-gray-900 leading-none">{label}</p>
                      <p className="text-xs text-gray-400 mt-0.5 truncate">{sub}</p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-gray-400 flex-shrink-0 transition-colors" />
                  </Link>
                );
              })}
            </div>
          </div>

          {/* AI tip card */}
          <div className="card card-body bg-gradient-to-br from-violet-50 to-indigo-50 border-violet-100">
            <div className="flex items-center gap-2 mb-2">
              <Sparkles className="w-4 h-4 text-violet-600" />
              <p className="text-xs font-semibold text-violet-700 uppercase tracking-wide">AI Tip</p>
            </div>
            <p className="text-sm text-violet-900 leading-relaxed">
              Upload your resume to get personalised job recommendations and ATS-optimised outreach emails.
            </p>
            <Link to="/profile" className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-violet-700 hover:text-violet-800">
              Update Resume <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
