import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  TrendingUp, Target, MapPin, Briefcase,
  Star, AlertCircle, CheckCircle, Loader2,
  BarChart2, ArrowRight, Sparkles, Wifi,
} from 'lucide-react';
import { api }  from '@utils/axios';
import { cn }   from '@utils/helpers';
import { Link } from 'react-router-dom';
import { Badge } from '@components/ui';

const container = {
  hidden: {},
  show: { transition: { staggerChildren: 0.07, delayChildren: 0.05 } },
};
const item = {
  hidden: { opacity: 0, y: 16 },
  show:   { opacity: 1, y: 0, transition: { duration: 0.3, ease: 'easeOut' } },
};

function StatCard({ label, value, sub, icon: Icon, color = 'blue', loading }) {
  const colors = {
    blue:    { bg: 'from-blue-500 to-blue-600',    glow: 'rgba(59,130,246,0.25)',   pill: 'bg-blue-50 text-blue-700'    },
    emerald: { bg: 'from-emerald-500 to-teal-500', glow: 'rgba(16,185,129,0.25)',   pill: 'bg-emerald-50 text-emerald-700'},
    violet:  { bg: 'from-violet-500 to-indigo-500',glow: 'rgba(139,92,246,0.25)',   pill: 'bg-violet-50 text-violet-700'  },
    amber:   { bg: 'from-amber-500 to-orange-500', glow: 'rgba(245,158,11,0.25)',   pill: 'bg-amber-50 text-amber-700'  },
  };
  const c = colors[color] || colors.blue;
  return (
    <motion.div variants={item}
      className="bg-white rounded-2xl border border-gray-100 p-5 overflow-hidden relative"
      style={{ boxShadow: '0 2px 12px -2px rgba(0,0,0,0.06)' }}
    >
      <div className="absolute -right-4 -top-4 w-20 h-20 rounded-full opacity-10"
        style={{ background: `radial-gradient(circle, ${c.glow}, transparent)` }} />
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-3 bg-gradient-to-br ${c.bg} shadow-sm`}>
        <Icon className="w-5 h-5 text-white" />
      </div>
      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">{label}</p>
      {loading
        ? <div className="skeleton h-8 w-20 rounded-lg mt-1" />
        : <p className="text-3xl font-black text-gray-900 mt-1 tabular-nums">{value ?? '—'}</p>}
      {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
    </motion.div>
  );
}

function BarRow({ label, value, max, color = 'bg-blue-500' }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div className="flex items-center gap-3">
      <span className="text-xs text-gray-600 w-28 flex-shrink-0 truncate">{label}</span>
      <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
          className={`h-full rounded-full ${color}`}
        />
      </div>
      <span className="text-xs font-bold text-gray-700 w-8 text-right">{value}</span>
    </div>
  );
}

export default function Insights() {
  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/jobs/insights')
      .then(({ data: res }) => setData(res.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const cbRate   = data ? Math.round((data.callbackRate  || 0) * 100) : null;
  const remRate  = data ? Math.round((data.remoteRate    || 0) * 100) : null;
  const maxSource = data?.sourceBreakdown
    ? Math.max(...Object.values(data.sourceBreakdown)) : 1;

  return (
    <motion.div variants={container} initial="hidden" animate="show"
      className="max-w-5xl mx-auto space-y-6 pb-8"
    >
      {/* Header */}
      <motion.div variants={item} className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black text-gray-900 flex items-center gap-2">
            <BarChart2 className="w-6 h-6 text-violet-600" /> Job Insights
          </h1>
          <p className="text-gray-400 text-sm mt-0.5">Analytics on your application performance</p>
        </div>
        <Link to="/results" className="btn btn-secondary btn-sm">
          <Briefcase className="w-3.5 h-3.5" /> View Jobs
        </Link>
      </motion.div>

      {/* Key stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard label="Callback Rate"  value={cbRate != null ? `${cbRate}%` : null}  icon={Target}    color="emerald" loading={loading} sub="responses / applied" />
        <StatCard label="Total Applied"  value={data?.totalApplied}  icon={Briefcase} color="blue"    loading={loading} sub="applications sent" />
        <StatCard label="Remote Jobs"    value={remRate != null ? `${remRate}%` : null} icon={Wifi}      color="violet"  loading={loading} sub="of applications" />
        <StatCard label="Avg Match Score" value={data?.avgMatchScore != null ? `${Math.round(data.avgMatchScore)}%` : null} icon={Star} color="amber" loading={loading} sub="across all jobs" />
      </div>

      <div className="grid lg:grid-cols-2 gap-5">

        {/* Source breakdown */}
        <motion.div variants={item} className="bg-white rounded-3xl border border-gray-100 p-5"
          style={{ boxShadow: '0 4px 24px -4px rgba(0,0,0,0.07)' }}
        >
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold text-gray-900 flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-blue-500" /> Applications by Source
            </h2>
          </div>
          {loading ? (
            <div className="space-y-3">
              {[...Array(4)].map((_, i) => <div key={i} className="skeleton h-4 rounded-lg" />)}
            </div>
          ) : data?.sourceBreakdown && Object.keys(data.sourceBreakdown).length > 0 ? (
            <div className="space-y-3">
              {Object.entries(data.sourceBreakdown)
                .sort(([, a], [, b]) => b - a)
                .map(([source, count]) => (
                  <BarRow key={source} label={source} value={count} max={maxSource} color="bg-blue-500" />
                ))}
            </div>
          ) : (
            <p className="text-sm text-gray-400 italic py-4 text-center">No data yet — apply to some jobs first</p>
          )}
        </motion.div>

        {/* Score correlation */}
        <motion.div variants={item} className="bg-white rounded-3xl border border-gray-100 p-5"
          style={{ boxShadow: '0 4px 24px -4px rgba(0,0,0,0.07)' }}
        >
          <h2 className="font-bold text-gray-900 flex items-center gap-2 mb-4">
            <Star className="w-4 h-4 text-amber-500" /> Match Score vs Outcomes
          </h2>
          {loading ? (
            <div className="space-y-3">
              {[...Array(3)].map((_, i) => <div key={i} className="skeleton h-16 rounded-xl" />)}
            </div>
          ) : data?.scoreCorrelation ? (
            <div className="space-y-3">
              {data.scoreCorrelation.map(({ range, applied, interviews, offers }) => (
                <div key={range} className="p-3 bg-gray-50 rounded-xl border border-gray-100">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-gray-700">{range} match</span>
                    <span className="text-[10px] text-gray-400">{applied} applied</span>
                  </div>
                  <div className="flex gap-3">
                    <div className="flex-1">
                      <p className="text-[10px] text-gray-400 mb-1">Interviews</p>
                      <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: applied > 0 ? `${Math.round((interviews / applied) * 100)}%` : '0%' }}
                          transition={{ duration: 0.6 }}
                          className="h-full bg-violet-500 rounded-full"
                        />
                      </div>
                      <p className="text-[10px] font-bold text-violet-600 mt-0.5">{interviews}</p>
                    </div>
                    <div className="flex-1">
                      <p className="text-[10px] text-gray-400 mb-1">Offers</p>
                      <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: applied > 0 ? `${Math.round((offers / applied) * 100)}%` : '0%' }}
                          transition={{ duration: 0.6 }}
                          className="h-full bg-emerald-500 rounded-full"
                        />
                      </div>
                      <p className="text-[10px] font-bold text-emerald-600 mt-0.5">{offers}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-400 italic py-4 text-center">Apply to jobs to see correlation data</p>
          )}
        </motion.div>

        {/* Remote vs onsite */}
        <motion.div variants={item} className="bg-white rounded-3xl border border-gray-100 p-5"
          style={{ boxShadow: '0 4px 24px -4px rgba(0,0,0,0.07)' }}
        >
          <h2 className="font-bold text-gray-900 flex items-center gap-2 mb-4">
            <MapPin className="w-4 h-4 text-emerald-500" /> Remote vs On-site Performance
          </h2>
          {loading ? (
            <div className="space-y-3">{[...Array(2)].map((_, i) => <div key={i} className="skeleton h-16 rounded-xl" />)}</div>
          ) : data?.remoteVsOnsite ? (
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: 'Remote', d: data.remoteVsOnsite.remote, color: 'bg-emerald-500', badgeVariant: 'green' },
                { label: 'On-site', d: data.remoteVsOnsite.onsite, color: 'bg-blue-500', badgeVariant: 'blue' },
              ].map(({ label, d, color, badgeVariant }) => (
                <div key={label} className="p-3 bg-gray-50 rounded-xl border border-gray-100 text-center">
                  <Badge variant={badgeVariant} size="sm" className="mb-2 inline-block font-bold">
                    {label}
                  </Badge>
                  <p className="text-2xl font-black text-gray-900">{d?.applied ?? 0}</p>
                  <p className="text-[10px] text-gray-400">applied</p>
                  <div className="flex justify-center gap-3 mt-2">
                    <div>
                      <p className="text-xs font-bold text-violet-600">{d?.interviews ?? 0}</p>
                      <p className="text-[10px] text-gray-400">interviews</p>
                    </div>
                    <div>
                      <p className="text-xs font-bold text-emerald-600">{d?.offers ?? 0}</p>
                      <p className="text-[10px] text-gray-400">offers</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-400 italic py-4 text-center">No data yet</p>
          )}
        </motion.div>

        {/* HR email impact */}
        <motion.div variants={item} className="bg-white rounded-3xl border border-gray-100 p-5"
          style={{ boxShadow: '0 4px 24px -4px rgba(0,0,0,0.07)' }}
        >
          <h2 className="font-bold text-gray-900 flex items-center gap-2 mb-4">
            <Sparkles className="w-4 h-4 text-violet-500" /> HR Email Impact
          </h2>
          {loading ? (
            <div className="space-y-3">{[...Array(2)].map((_, i) => <div key={i} className="skeleton h-16 rounded-xl" />)}</div>
          ) : data?.hrEmailImpact ? (
            <div className="space-y-3">
              {[
                { label: 'With HR Email', d: data.hrEmailImpact.withEmail, badgeVariant: 'violet' },
                { label: 'Without HR Email', d: data.hrEmailImpact.withoutEmail, badgeVariant: 'gray' },
              ].map(({ label, d, badgeVariant }) => {
                const cbr = d?.applied > 0 ? Math.round(((d.interviews || 0) / d.applied) * 100) : 0;
                return (
                  <div key={label} className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl border border-gray-100">
                    <div className="flex-1">
                      <Badge variant={badgeVariant} size="sm" className="text-[10px] font-bold">
                        {label}
                      </Badge>
                      <p className="text-xs text-gray-500 mt-1">{d?.applied ?? 0} applied · {d?.interviews ?? 0} interviews</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xl font-black text-gray-900">{cbr}%</p>
                      <p className="text-[10px] text-gray-400">callback</p>
                    </div>
                  </div>
                );
              })}
              {data.hrEmailImpact.withEmail?.applied > 0 && data.hrEmailImpact.withoutEmail?.applied > 0 && (() => {
                const a = data.hrEmailImpact.withEmail.applied > 0 ? (data.hrEmailImpact.withEmail.interviews || 0) / data.hrEmailImpact.withEmail.applied : 0;
                const b = data.hrEmailImpact.withoutEmail.applied > 0 ? (data.hrEmailImpact.withoutEmail.interviews || 0) / data.hrEmailImpact.withoutEmail.applied : 0;
                const diff = Math.round((a - b) * 100);
                if (diff > 0) return (
                  <div className="flex items-center gap-2 p-2.5 bg-emerald-50 rounded-xl border border-emerald-100">
                    <CheckCircle className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                    <p className="text-xs text-emerald-700 font-semibold">HR emails boost callback rate by <span className="font-black">+{diff}%</span></p>
                  </div>
                );
                return null;
              })()}
            </div>
          ) : (
            <p className="text-sm text-gray-400 italic py-4 text-center">Find HR contacts to see email impact data</p>
          )}
        </motion.div>
      </div>

      {/* AI Recommendations */}
      {(loading || data?.recommendations?.length > 0) && (
        <motion.div variants={item} className="bg-white rounded-3xl border border-gray-100 p-6"
          style={{ boxShadow: '0 4px 24px -4px rgba(0,0,0,0.07)' }}
        >
          <h2 className="font-bold text-gray-900 flex items-center gap-2 mb-4">
            <Sparkles className="w-5 h-5 text-violet-600" /> AI Recommendations
          </h2>
          {loading ? (
            <div className="space-y-3">{[...Array(3)].map((_, i) => <div key={i} className="skeleton h-12 rounded-xl" />)}</div>
          ) : (
            <div className="space-y-3">
              {data?.recommendations?.map((rec, i) => (
                <div key={i} className={cn(
                  'flex items-start gap-3 p-4 rounded-xl border',
                  rec.type === 'positive' ? 'bg-emerald-50 border-emerald-100' :
                  rec.type === 'warning'  ? 'bg-amber-50 border-amber-100' :
                  'bg-blue-50 border-blue-100'
                )}>
                  {rec.type === 'positive'
                    ? <CheckCircle className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
                    : rec.type === 'warning'
                      ? <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                      : <Sparkles className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />}
                  <p className={cn('text-sm font-medium',
                    rec.type === 'positive' ? 'text-emerald-800' :
                    rec.type === 'warning'  ? 'text-amber-800' : 'text-blue-800'
                  )}>{rec.message}</p>
                </div>
              ))}
            </div>
          )}
        </motion.div>
      )}

      {/* Empty state */}
      {!loading && !data?.totalApplied && (
        <motion.div variants={item} className="bg-white rounded-3xl border border-gray-100 p-12 text-center">
          <div className="w-16 h-16 rounded-3xl bg-violet-50 flex items-center justify-center mx-auto mb-4">
            <BarChart2 className="w-8 h-8 text-violet-400" />
          </div>
          <p className="font-bold text-gray-900 mb-1">No data yet</p>
          <p className="text-gray-400 text-sm mb-5">Start applying to jobs to see your performance insights</p>
          <Link to="/results" className="btn btn-primary inline-flex items-center gap-2">
            <ArrowRight className="w-4 h-4" /> View Job Results
          </Link>
        </motion.div>
      )}
    </motion.div>
  );
}
