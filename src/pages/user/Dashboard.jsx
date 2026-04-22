import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Search, Briefcase, Mail, Users, TrendingUp,
  ArrowRight, Star, Target, Plus, ChevronRight, Sparkles,
  Zap, MapPin, Building, Bell, Check, Clock, Send,
} from 'lucide-react';
import { useAuth }    from '@hooks/useAuth';
import { useCredits } from '@hooks/useCredits';
import { api }        from '@utils/axios';
import { fAgo }       from '@utils/formatters';
import { cn }         from '@utils/helpers';
import { Badge }      from '@components/ui';

function getTimeOfDay() {
  const h = new Date().getHours();
  return h < 12 ? 'morning' : h < 17 ? 'afternoon' : 'evening';
}

const STAT_CONFIG = [
  { key: 'totalJobs',       label: 'All Jobs',      icon: Briefcase, from: '#8b5cf6', to: '#7c3aed', glow: 'rgba(139,92,246,0.3)', sub: (s) => s ? `${s.jobSearchCount||0} search · ${s.linkedinJobCount||0} email/LI` : null },
  { key: 'appliedJobs',     label: 'Applied',       icon: Target,    from: '#10b981', to: '#059669', glow: 'rgba(16,185,129,0.3)', sub: null },
  { key: 'totalRecruiters', label: 'Recruiters',    icon: Users,     from: '#06b6d4', to: '#0891b2', glow: 'rgba(6,182,212,0.3)',  sub: null },
  { key: 'emailsSent',      label: 'Emails Sent',   icon: Send,      from: '#3b82f6', to: '#2563eb', glow: 'rgba(59,130,246,0.3)', sub: null },
  { key: 'interviewJobs',   label: 'Interviews',    icon: Star,      from: '#f59e0b', to: '#d97706', glow: 'rgba(245,158,11,0.3)', sub: null },
  { key: 'totalSearches',   label: 'Searches',      icon: Search,    from: '#6366f1', to: '#4f46e5', glow: 'rgba(99,102,241,0.3)', sub: null },
];

const QUICK_ACTIONS = [
  { to: '/search',     label: 'Search Jobs',       sub: 'Find matching positions',   icon: Search,     bg: 'from-blue-500 to-blue-600'   },
  { to: '/recruiters', label: 'Find HR Contacts',  sub: 'Discover decision makers',  icon: Users,      bg: 'from-cyan-500 to-cyan-600'   },
  { to: '/outreach',   label: 'Send Outreach',     sub: 'Email recruiters directly', icon: Mail,       bg: 'from-emerald-500 to-emerald-600'},
  { to: '/profile',    label: 'Update Profile',    sub: 'Keep your info fresh',      icon: TrendingUp, bg: 'from-violet-500 to-violet-600'},
];

const container = {
  hidden: {},
  show: { transition: { staggerChildren: 0.08, delayChildren: 0.1 } },
};
const item = {
  hidden: { opacity: 0, y: 16 },
  show:   { opacity: 1, y: 0, transition: { duration: 0.35, ease: 'easeOut' } },
};

export default function Dashboard() {
  const { user }                = useAuth();
  const { remaining, usagePct } = useCredits();
  const [stats,     setStats]     = useState(null);
  const [jobs,      setJobs]      = useState([]);
  const [loading,   setLoad]      = useState(true);
  const [followUps, setFollowUps] = useState([]);
  const [fuMarking, setFuMarking] = useState({});

  useEffect(() => {
    Promise.all([
      api.get('/user/stats').catch(() => ({ data: { data: null } })),
      api.get('/jobs?limit=5&sort=matchScore').catch(() => ({ data: { data: [] } })),
      api.get('/jobs/follow-ups').catch(() => ({ data: { data: [] } })),
    ]).then(([s, j, fu]) => {
      setStats(s.data.data);
      setJobs(j.data.data || []);
      setFollowUps(fu.data.data || []);
    }).finally(() => setLoad(false));
  }, []);

  const markFollowUpSent = async (jobId) => {
    setFuMarking(p => ({ ...p, [jobId]: 'sent' }));
    try {
      await api.post(`/jobs/${jobId}/follow-up/sent`);
      setFollowUps(prev => prev.filter(j => j._id !== jobId));
    } catch { /* silent */ }
    finally { setFuMarking(p => ({ ...p, [jobId]: null })); }
  };

  const snoozeFollowUp = async (jobId) => {
    setFuMarking(p => ({ ...p, [jobId]: 'snooze' }));
    try {
      await api.post(`/jobs/${jobId}/follow-up/snooze`, { days: 3 });
      setFollowUps(prev => prev.filter(j => j._id !== jobId));
    } catch { /* silent */ }
    finally { setFuMarking(p => ({ ...p, [jobId]: null })); }
  };

  const firstName   = user?.profile?.firstName || 'there';
  const creditColor = usagePct >= 80 ? '#ef4444' : usagePct >= 50 ? '#f59e0b' : '#10b981';
  const barColor    = usagePct >= 80 ? 'bg-red-500' : usagePct >= 50 ? 'bg-amber-500' : 'bg-emerald-500';

  return (
    <motion.div
      variants={container}
      initial="hidden"
      animate="show"
      className="max-w-6xl mx-auto space-y-5 pb-6"
    >
      {/* ── Hero welcome ─────────────────────────────────────────── */}
      <motion.div variants={item} className="relative overflow-hidden rounded-3xl p-7 text-white"
        style={{ background: 'linear-gradient(135deg, #1e40af 0%, #3730a3 50%, #5b21b6 100%)', boxShadow: '0 20px 60px -12px rgba(37,99,235,0.4)' }}
      >
        {/* Floating orbs */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-12 -right-12 w-48 h-48 rounded-full bg-white/5 blur-xl" />
          <div className="absolute -bottom-16 -left-8 w-64 h-64 rounded-full bg-white/5 blur-2xl" />
          <div className="absolute top-6 right-1/3 w-24 h-24 rounded-full bg-white/5 blur-lg" />
        </div>
        <div className="relative flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <p className="text-blue-200 text-xs sm:text-sm font-medium mb-1">Good {getTimeOfDay()} 👋</p>
            <h1 className="text-xl sm:text-2xl lg:text-3xl font-black tracking-tight truncate">Welcome back, {firstName}!</h1>
            <p className="text-blue-200/80 text-xs sm:text-sm mt-2 max-w-xs sm:max-w-sm leading-relaxed">
              Your AI-powered job search is ready. Let's land your next opportunity.
            </p>
            <div className="flex items-center gap-2 sm:gap-3 mt-4 sm:mt-5 flex-wrap">
              <Link to="/search" className="inline-flex items-center gap-2 bg-white text-blue-700 font-bold text-xs sm:text-sm px-4 sm:px-5 py-2 sm:py-2.5 rounded-2xl hover:bg-blue-50 transition-colors shadow-lg">
                <Plus className="w-3.5 h-3.5 sm:w-4 sm:h-4" /> New Search
              </Link>
              <Link to="/results" className="inline-flex items-center gap-2 bg-white/15 hover:bg-white/25 text-white font-semibold text-xs sm:text-sm px-3 sm:px-4 py-2 sm:py-2.5 rounded-2xl transition-colors backdrop-blur-sm">
                View Results <ArrowRight className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              </Link>
            </div>
          </div>
          <div className="hidden sm:flex flex-col items-end gap-2 flex-shrink-0">
            <div className="bg-white/10 backdrop-blur-sm rounded-2xl px-4 py-3 text-center min-w-[100px]">
              <p className="text-2xl font-black" style={{ color: creditColor === '#10b981' ? '#6ee7b7' : creditColor === '#f59e0b' ? '#fde68a' : '#fca5a5' }}>{remaining}</p>
              <p className="text-xs text-blue-200 font-medium">credits left</p>
            </div>
            <Badge
              variant={user?.plan === 'pro' ? 'blue' : user?.plan === 'team' ? 'purple' : 'gray'}
              className="font-bold capitalize"
            >
              {user?.plan || 'free'} plan
            </Badge>
          </div>
        </div>
      </motion.div>

      {/* ── Stats grid ───────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {STAT_CONFIG.map(({ key, label, icon: Icon, from, to, glow, sub }, i) => {
          const value   = stats?.[key] ?? 0;
          const subText = sub ? sub(stats) : null;
          return (
            <motion.div
              key={key}
              variants={item}
              className="group relative bg-white rounded-2xl border border-gray-100 p-4 overflow-hidden cursor-default"
              style={{ boxShadow: '0 2px 8px -2px rgba(0,0,0,0.06)' }}
              whileHover={{ y: -3, boxShadow: `0 12px 24px -6px ${glow}` }}
              transition={{ duration: 0.2 }}
            >
              <div className="absolute -right-4 -top-4 w-16 h-16 rounded-full opacity-10 transition-opacity group-hover:opacity-20"
                style={{ background: `radial-gradient(circle, ${from}, ${to})` }}
              />
              <div className="relative">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center mb-2.5"
                  style={{ background: `linear-gradient(135deg, ${from}, ${to})`, boxShadow: `0 4px 12px ${glow}` }}
                >
                  <Icon className="w-4 h-4 text-white" />
                </div>
                <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide leading-tight">{label}</p>
                <p className="text-2xl font-black text-gray-900 mt-0.5 tabular-nums">
                  {loading ? <span className="skeleton inline-block w-8 h-7 rounded-lg align-middle" /> : value}
                </p>
                {subText && !loading && (
                  <p className="text-[10px] text-gray-400 mt-0.5 leading-tight truncate">{subText}</p>
                )}
              </div>
            </motion.div>
          );
        })}
      </div>

      <div className="grid lg:grid-cols-3 gap-5">

        {/* ── Recent jobs ──────────────────────────────────────── */}
        <motion.div variants={item} className="lg:col-span-2 bg-white rounded-3xl border border-gray-100 overflow-hidden"
          style={{ boxShadow: '0 4px 24px -4px rgba(0,0,0,0.07)' }}
        >
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
            <div>
              <h2 className="font-bold text-gray-900">Recent Job Matches</h2>
              <p className="text-xs text-gray-400 mt-0.5">Sorted by AI match score</p>
            </div>
            <Link to="/results" className="flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-700 transition-colors">
              View all <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {loading ? (
            <div className="divide-y divide-gray-100">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="flex items-center gap-3 p-4">
                  <div className="skeleton w-10 h-10 rounded-xl flex-shrink-0" />
                  <div className="flex-1 space-y-2">
                    <div className="skeleton h-3.5 w-3/4 rounded-lg" />
                    <div className="skeleton h-3 w-1/2 rounded-lg" />
                  </div>
                  <div className="skeleton h-6 w-12 rounded-full" />
                </div>
              ))}
            </div>
          ) : jobs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-14 text-center px-6">
              <div className="w-14 h-14 rounded-3xl bg-blue-50 flex items-center justify-center mb-4">
                <Search className="w-7 h-7 text-blue-400" />
              </div>
              <p className="font-bold text-gray-900 mb-1">No jobs yet</p>
              <p className="text-sm text-gray-400 mb-5">Run your first AI-powered search</p>
              <Link to="/search" className="btn btn-primary">
                <Search className="w-4 h-4" /> Start Searching
              </Link>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {jobs.map((job, i) => (
                <motion.div
                  key={job._id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.2 + i * 0.06 }}
                  className="flex items-center gap-3 px-4 py-3.5 hover:bg-slate-50 transition-colors group cursor-pointer"
                >
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-black text-sm flex-shrink-0"
                    style={{ background: `hsl(${(job.company?.charCodeAt(0) || 65) * 5 % 360}, 65%, 55%)` }}
                  >
                    {job.company?.[0]?.toUpperCase() || '?'}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-gray-900 text-sm truncate group-hover:text-blue-700 transition-colors">{job.title}</p>
                    <p className="text-xs text-gray-400 mt-0.5 flex items-center gap-2">
                      <Building className="w-3 h-3" /> {job.company}
                      {job.location && <><MapPin className="w-3 h-3 ml-1" /> {job.location}</>}
                    </p>
                  </div>
                  <span className={cn(
                    'text-xs font-bold px-2.5 py-1 rounded-full border flex-shrink-0',
                    job.matchScore >= 75 ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                    job.matchScore >= 50 ? 'bg-amber-50 text-amber-700 border-amber-200' :
                    'bg-gray-100 text-gray-500 border-gray-200'
                  )}>
                    {job.matchScore}%
                  </span>
                </motion.div>
              ))}
            </div>
          )}
        </motion.div>

        {/* ── Right column ─────────────────────────────────────── */}
        <div className="space-y-4">

          {/* Credits */}
          <motion.div variants={item} className="bg-white rounded-3xl border border-gray-100 p-5"
            style={{ boxShadow: '0 4px 24px -4px rgba(0,0,0,0.07)' }}
          >
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Monthly Credits</p>
                <p className="text-3xl font-black mt-1 tabular-nums" style={{ color: creditColor }}>{remaining}</p>
              </div>
              <div className="w-12 h-12 rounded-2xl flex items-center justify-center"
                style={{ background: `linear-gradient(135deg, ${creditColor}20, ${creditColor}10)` }}
              >
                <Zap className="w-6 h-6" style={{ color: creditColor }} />
              </div>
            </div>
            <div className="h-2 bg-gray-100 rounded-full overflow-hidden mb-2">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${Math.min(usagePct, 100)}%` }}
                transition={{ duration: 0.8, delay: 0.3 }}
                className={cn('h-full rounded-full', barColor)}
              />
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-gray-400">{usagePct}% used</span>
              <Link to="/credits" className="font-semibold text-blue-600 hover:text-blue-700">Top up →</Link>
            </div>
            {usagePct >= 80 && (
              <div className="mt-3 p-3 bg-red-50 rounded-xl border border-red-100">
                <p className="text-xs font-semibold text-red-700 mb-1">Running low!</p>
                <Link to="/billing" className="text-xs text-red-600 hover:underline font-medium">Upgrade your plan →</Link>
              </div>
            )}
          </motion.div>

          {/* Quick Actions */}
          <motion.div variants={item} className="bg-white rounded-3xl border border-gray-100 overflow-hidden"
            style={{ boxShadow: '0 4px 24px -4px rgba(0,0,0,0.07)' }}
          >
            <div className="px-5 py-4 border-b border-gray-100">
              <h3 className="font-bold text-gray-900 text-sm">Quick Actions</h3>
            </div>
            <div className="divide-y divide-gray-100">
              {QUICK_ACTIONS.map(({ to, label, sub, icon: Icon, bg }) => (
                <Link
                  key={to}
                  to={to}
                  className="flex items-center gap-3 px-4 py-3.5 hover:bg-slate-50 transition-colors group"
                >
                  <div className={cn('w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm bg-gradient-to-br', bg)}>
                    <Icon className="w-4 h-4 text-white" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-gray-900 leading-tight">{label}</p>
                    <p className="text-xs text-gray-400 mt-0.5 truncate">{sub}</p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-gray-500 flex-shrink-0 transition-colors" />
                </Link>
              ))}
            </div>
          </motion.div>

          {/* AI tip */}
          <motion.div variants={item}
            className="relative overflow-hidden rounded-3xl p-5"
            style={{ background: 'linear-gradient(135deg, #ede9fe, #ddd6fe, #c4b5fd)', boxShadow: '0 4px 20px -4px rgba(139,92,246,0.25)' }}
          >
            <div className="absolute -right-6 -bottom-6 w-28 h-28 rounded-full bg-violet-400/20 blur-2xl" />
            <div className="relative">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-8 h-8 rounded-xl bg-violet-500 flex items-center justify-center">
                  <Sparkles className="w-4 h-4 text-white" />
                </div>
                <p className="text-xs font-bold text-violet-700 uppercase tracking-wide">AI Tip</p>
              </div>
              <p className="text-sm text-violet-900 leading-relaxed font-medium">
                Upload your resume to unlock personalised job matching and ATS-optimised emails.
              </p>
              <Link to="/profile?tab=resume" className="mt-3 inline-flex items-center gap-1.5 text-xs font-bold text-violet-700 hover:text-violet-900 transition-colors">
                Upload Resume <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </motion.div>
        </div>
      </div>

      {/* ── Follow-ups Due ────────────────────────────────────────── */}
      {(loading || followUps.length > 0) && (
        <motion.div variants={item} className="bg-white rounded-3xl border border-gray-100 overflow-hidden"
          style={{ boxShadow: '0 4px 24px -4px rgba(0,0,0,0.07)' }}
        >
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
            <div className="flex items-center gap-2">
              <Bell className="w-4 h-4 text-violet-500" />
              <h2 className="font-bold text-gray-900">Follow-ups Due</h2>
              {followUps.length > 0 && (
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-violet-100 text-violet-700">{followUps.length}</span>
              )}
            </div>
            <Link to="/results" className="flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-700 transition-colors">
              View all <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {loading ? (
            <div className="divide-y divide-gray-100">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="flex items-center gap-3 p-4">
                  <div className="skeleton w-10 h-10 rounded-xl flex-shrink-0" />
                  <div className="flex-1 space-y-2"><div className="skeleton h-3.5 w-3/4 rounded-lg" /><div className="skeleton h-3 w-1/2 rounded-lg" /></div>
                  <div className="skeleton h-8 w-20 rounded-xl" />
                </div>
              ))}
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {followUps.slice(0, 5).map(job => (
                <div key={job._id} className="flex items-center gap-3 px-4 py-3.5">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-black text-sm flex-shrink-0"
                    style={{ background: `hsl(${(job.company?.charCodeAt(0) || 65) * 5 % 360}, 65%, 55%)` }}
                  >
                    {job.company?.[0]?.toUpperCase() || '?'}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-gray-900 text-sm truncate">{job.title}</p>
                    <p className="text-xs text-gray-400 mt-0.5 flex items-center gap-1.5">
                      <Building className="w-3 h-3" /> {job.company}
                      {job.urgency === 'overdue' && (
                        <span className="text-[10px] font-bold text-red-600 bg-red-50 px-1.5 py-0.5 rounded-full ml-1">Overdue</span>
                      )}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 sm:gap-1.5 flex-shrink-0">
                    <button
                      onClick={() => markFollowUpSent(job._id)}
                      disabled={!!fuMarking[job._id]}
                      className="flex items-center gap-1 px-2 sm:px-2.5 py-1.5 rounded-xl text-xs font-semibold bg-emerald-50 text-emerald-700 hover:bg-emerald-100 transition-colors border border-emerald-200 whitespace-nowrap"
                      title="Mark as sent"
                    >
                      <Check className="w-3.5 h-3.5" /> <span className="hidden sm:inline">Sent</span><span className="sm:hidden">✓</span>
                    </button>
                    <button
                      onClick={() => snoozeFollowUp(job._id)}
                      disabled={!!fuMarking[job._id]}
                      className="flex items-center gap-1 px-2 sm:px-2.5 py-1.5 rounded-xl text-xs font-semibold bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors whitespace-nowrap"
                      title="Snooze 3 days"
                    >
                      <Clock className="w-3.5 h-3.5" /> +3d
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </motion.div>
      )}
    </motion.div>
  );
}
