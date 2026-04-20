import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Mail, Loader2, RefreshCw, MapPin, Building, Star,
  X, ChevronLeft, ChevronRight, ExternalLink, Inbox,
  Clock, ChevronDown, ChevronUp, AlertCircle,
} from 'lucide-react';
import { api }      from '@utils/axios';
import { useToast } from '@hooks/useToast';
import { fAgo }     from '@utils/formatters';
import { cn }       from '@utils/helpers';
import JobDetailPanel from '@components/jobs/JobDetailPanel';

const SOURCE_FILTERS = [
  { key: '',                  label: 'All Portals'  },
  { key: 'email_linkedin',    label: 'LinkedIn'     },
  { key: 'email_naukri',      label: 'Naukri'       },
  { key: 'email_indeed',      label: 'Indeed'       },
  { key: 'email_foundit',     label: 'Foundit'      },
  { key: 'email_internshala', label: 'Internshala'  },
  { key: 'email_timesjobs',   label: 'TimesJobs'    },
  { key: 'email_shine',       label: 'Shine'        },
  { key: 'email_instahyre',   label: 'Instahyre'    },
  { key: 'email_hirist',      label: 'Hirist'       },
  { key: 'email_alert',       label: 'Other'        },
];

const STATUS_FILTERS = [
  { key: '',        label: 'All'     },
  { key: 'new',     label: 'New'     },
  { key: 'saved',   label: 'Saved'   },
  { key: 'applied', label: 'Applied' },
  { key: 'ignored', label: 'Ignored' },
];

const FETCH_INTERVALS = [
  { label: 'Last 7 days',  value: 7  },
  { label: 'Last 14 days', value: 14 },
  { label: 'Last 30 days', value: 30 },
  { label: 'Last 60 days', value: 60 },
  { label: 'All time',     value: 0  },
];

const STATUS_CONFIG = {
  new:     { label: 'New',     cls: 'bg-blue-100 text-blue-700'       },
  saved:   { label: 'Saved',   cls: 'bg-amber-100 text-amber-700'     },
  applied: { label: 'Applied', cls: 'bg-emerald-100 text-emerald-700' },
  ignored: { label: 'Ignored', cls: 'bg-gray-100 text-gray-500'       },
};

const SOURCE_BADGES = {
  email_linkedin:    { label: 'LinkedIn',    cls: 'bg-blue-100 text-blue-700'      },
  email_naukri:      { label: 'Naukri',      cls: 'bg-orange-100 text-orange-700'  },
  email_indeed:      { label: 'Indeed',      cls: 'bg-violet-100 text-violet-700'  },
  email_foundit:     { label: 'Foundit',     cls: 'bg-purple-100 text-purple-700'  },
  email_internshala: { label: 'Internshala', cls: 'bg-teal-100 text-teal-700'      },
  email_timesjobs:   { label: 'TimesJobs',   cls: 'bg-red-100 text-red-700'        },
  email_shine:       { label: 'Shine',       cls: 'bg-pink-100 text-pink-700'      },
  email_instahyre:   { label: 'Instahyre',   cls: 'bg-cyan-100 text-cyan-700'      },
  email_hirist:      { label: 'Hirist',      cls: 'bg-indigo-100 text-indigo-700'  },
};

const fadeUp = {
  hidden: { opacity: 0, y: 12 },
  show:   { opacity: 1, y: 0, transition: { duration: 0.3, ease: 'easeOut' } },
};
const stagger = { show: { transition: { staggerChildren: 0.05 } } };

function CompanyAvatar({ name }) {
  const char = (name && name.length > 0) ? name[0].toUpperCase() : 'J';
  const hue  = ((name?.charCodeAt(0) || 74) * 5) % 360;
  return (
    <div
      className="w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm flex-shrink-0"
      style={{ background: `hsl(${hue},65%,92%)`, color: `hsl(${hue},65%,35%)` }}
    >
      {char}
    </div>
  );
}

function SourceBadge({ source }) {
  const cfg = SOURCE_BADGES[source] || { label: source?.replace('email_', '') || 'Email', cls: 'bg-gray-100 text-gray-600' };
  return (
    <span className={cn('text-[10px] font-semibold px-1.5 py-0.5 rounded-full', cfg.cls)}>
      {cfg.label}
    </span>
  );
}

const LIMIT = 20;

export default function EmailJobs() {
  const toast = useToast();
  const [searchParams, setSearchParams] = useSearchParams();

  const [jobs,           setJobs]           = useState([]);
  const [loading,        setLoading]        = useState(true);
  const [total,          setTotal]          = useState(0);
  const [page,           setPage]           = useState(1);
  const [sourceFilter,   setSourceFilter]   = useState('');
  const [statusFilter,   setStatusFilter]   = useState('');
  const [selected,       setSelected]       = useState(null);
  const [fetchLoading,   setFetchLoading]   = useState(false);
  const [fetchResult,    setFetchResult]    = useState(null);
  const [gmailConnected,  setGmailConnected]  = useState(null); // null = loading
  const [gmailEmail,      setGmailEmail]      = useState('');
  const [lastFetchedAt,   setLastFetchedAt]   = useState(null);
  const [maxEmails,      setMaxEmails]      = useState(20);
  const [daysBack,       setDaysBack]       = useState(30);
  const [showDebug,      setShowDebug]      = useState(false);
  const [debugLog,       setDebugLog]       = useState([]);
  const [connectLoading, setConnectLoading] = useState(false);

  const checkGmailStatus = useCallback(() => {
    api.get('/linkedin/gmail/status')
      .then(r => {
        const d = r.data.data;
        setGmailConnected(d?.connected || false);
        setGmailEmail(d?.email || '');
        setLastFetchedAt(d?.lastFetchedAt || null);
      })
      .catch(() => setGmailConnected(false));
  }, []);

  useEffect(() => {
    checkGmailStatus();
    // Handle OAuth redirect back to this page
    const gmailParam = searchParams.get('gmail');
    if (gmailParam === 'connected') {
      toast.success('Gmail connected successfully!');
      setSearchParams({}, { replace: true });
      checkGmailStatus();
    } else if (gmailParam === 'error') {
      toast.error('Gmail connection failed. Please try again.');
      setSearchParams({}, { replace: true });
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const connectGmail = async () => {
    setConnectLoading(true);
    try {
      const { data } = await api.get('/linkedin/gmail/connect');
      window.location.href = data.data.url;
    } catch {
      toast.error('Failed to start Gmail connection');
      setConnectLoading(false);
    }
  };

  const disconnectGmail = async () => {
    try {
      await api.delete('/linkedin/gmail/disconnect');
      setGmailConnected(false);
      setGmailEmail('');
      toast.success('Gmail disconnected');
    } catch { toast.error('Failed to disconnect'); }
  };

  useEffect(() => { loadJobs(); }, [sourceFilter, statusFilter, page]);

  const loadJobs = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page, limit: LIMIT });
      if (sourceFilter) params.set('source', sourceFilter);
      if (statusFilter) params.set('status', statusFilter);
      const { data } = await api.get(`/linkedin/gmail/jobs?${params}`);
      setJobs(data.data || []);
      setTotal(data.pagination?.total || 0);
    } catch (err) {
      toast.error('Failed to load jobs');
      addDebugLog('error', 'GET /linkedin/gmail/jobs failed', err.response?.data || err.message);
    } finally { setLoading(false); }
  };

  const addDebugLog = (type, label, data) => {
    setDebugLog(prev => [{
      type, label, data,
      time: new Date().toLocaleTimeString(),
    }, ...prev].slice(0, 20));
  };

  const fetchFromGmail = async () => {
    setFetchLoading(true); setFetchResult(null);
    addDebugLog('info', `Fetching from Gmail (maxEmails: ${maxEmails})...`, null);
    try {
      const { data } = await api.post('/linkedin/gmail/fetch', { maxResults: maxEmails, daysBack });
      setFetchResult(data.data);
      addDebugLog('success', 'Fetch response', data.data);
      const d = data.data;
      if (d?.lastFetchedAt) setLastFetchedAt(d.lastFetchedAt);
      if (d?.saved > 0) {
        toast.success(`Fetched ${d.saved} new jobs from email!`);
        setPage(1);
        loadJobs();
      } else if (d?.fetched === 0) {
        toast.info('No job alert emails found — try increasing the time range or check your Gmail subscriptions');
        addDebugLog('warn', 'No emails matched the query. Try "All time" or subscribe to job alerts on LinkedIn/Naukri/Indeed.', null);
      } else {
        toast.info(`Found ${d?.fetched} jobs in emails — all already saved`);
      }
    } catch (err) {
      const code = err.response?.data?.code;
      const msg  = err.response?.data?.message || 'Fetch failed';
      if (code === 'GMAIL_TOKEN_EXPIRED') {
        setGmailConnected(false);
        toast.error('Gmail session expired — please reconnect your Gmail.');
      } else if (code === 'RATE_LIMITED') {
        toast.error(msg);
      } else {
        toast.error(msg);
      }
      addDebugLog('error', msg, err.response?.data || err.message);
    } finally { setFetchLoading(false); }
  };

  const totalPages = Math.ceil(total / LIMIT);

  const changeFilter = (type, val) => {
    if (type === 'source') setSourceFilter(val);
    if (type === 'status') setStatusFilter(val);
    setPage(1);
    setSelected(null);
  };

  return (
    <motion.div variants={stagger} initial="hidden" animate="show" className="space-y-4">

      {/* Header */}
      <motion.div variants={fadeUp} className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <Mail className="w-5 h-5 text-emerald-600" />
            Email Job Alerts
          </h1>
          <p className="text-sm text-gray-400 mt-0.5">
            {gmailEmail ? `Reading from ${gmailEmail}` : 'Jobs imported from Gmail job alert emails'}
            {total > 0 && ` · ${total} saved`}
            {lastFetchedAt && ` · Last fetched ${fAgo(lastFetchedAt)}`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowDebug(p => !p)}
            className="btn btn-secondary btn-sm"
          >
            {showDebug ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            Debug
          </button>
          <button
            onClick={fetchFromGmail}
            disabled={fetchLoading || gmailConnected === false}
            title={gmailConnected === false ? 'Connect Gmail first using the button below' : ''}
            className="btn btn-primary btn-sm"
          >
            {fetchLoading
              ? <><Loader2 className="w-4 h-4 animate-spin" /> Fetching…</>
              : <><RefreshCw className="w-4 h-4" /> Fetch from Gmail</>}
          </button>
        </div>
      </motion.div>

      {/* Gmail not connected (false = confirmed disconnected, null = still loading) */}
      {gmailConnected === false && (
        <motion.div variants={fadeUp} className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-amber-500 flex-shrink-0" />
            <div>
              <p className="text-sm font-semibold text-amber-800">Gmail not connected</p>
              <p className="text-xs text-amber-600 mt-0.5">Connect your Gmail to auto-import jobs from LinkedIn, Naukri, Indeed and other job alert emails.</p>
            </div>
          </div>
          <button onClick={connectGmail} disabled={connectLoading} className="btn btn-primary btn-sm flex-shrink-0">
            {connectLoading ? <><Loader2 className="w-4 h-4 animate-spin" /> Connecting…</> : <><Mail className="w-4 h-4" /> Connect Gmail</>}
          </button>
        </motion.div>
      )}

      {/* Fetch config row */}
      {gmailConnected && (
        <motion.div variants={fadeUp} className="bg-blue-50 border border-blue-100 rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <Clock className="w-4 h-4 text-blue-600" />
            <p className="text-sm font-semibold text-blue-800">Fetch Settings</p>
          </div>
          <div className="flex flex-wrap gap-4 items-end">
            <div>
              <label className="label text-blue-700 text-xs mb-1">Emails to scan</label>
              <select
                value={maxEmails}
                onChange={e => setMaxEmails(Number(e.target.value))}
                className="input bg-white text-sm w-36"
              >
                <option value={10}>Last 10 emails</option>
                <option value={20}>Last 20 emails</option>
                <option value={50}>Last 50 emails</option>
                <option value={100}>Last 100 emails</option>
              </select>
            </div>
            <div className="flex flex-wrap gap-2">
              {FETCH_INTERVALS.map(f => (
                <button
                  key={f.value}
                  onClick={() => setDaysBack(f.value)}
                  className={cn(
                    'px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all',
                    daysBack === f.value
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'bg-white text-gray-600 border-gray-200 hover:border-blue-300'
                  )}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>
          <p className="text-xs text-blue-500 mt-2">
            Searches <strong>all job-related emails</strong> in your Gmail — any portal, any sender — using broad keywords like "job alert", "hiring", "job opening", "vacancy" etc.
          </p>
        </motion.div>
      )}

      {/* Fetch result banner */}
      <AnimatePresence>
        {fetchResult && (
          <motion.div
            initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
            className={cn('rounded-2xl p-4 flex items-center justify-between gap-3 border',
              fetchResult.saved > 0 ? 'bg-emerald-50 border-emerald-200' : 'bg-amber-50 border-amber-200'
            )}
          >
            <div className="space-y-0.5">
              {fetchResult.saved > 0 ? (
                <p className="font-semibold text-emerald-800 text-sm">
                  ✅ {fetchResult.saved} new jobs saved · {fetchResult.emailsFound} HR emails found
                  {fetchResult.employeesFound > 0 && ` · ${fetchResult.employeesFound} employees`}
                </p>
              ) : (
                <p className="text-sm font-medium text-amber-800">
                  No new jobs. {fetchResult.fetched > 0
                    ? `${fetchResult.fetched} already in your list.`
                    : 'No job alert emails found — subscribe to job alerts on LinkedIn/Naukri/Indeed.'}
                </p>
              )}
              <p className="text-xs text-gray-400">
                Scanned {fetchResult.fetched} raw jobs from {maxEmails} emails
              </p>
            </div>
            <button onClick={() => setFetchResult(null)} className="text-gray-400 hover:text-gray-600 flex-shrink-0">
              <X className="w-4 h-4" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Debug panel */}
      <AnimatePresence>
        {showDebug && (
          <motion.div
            initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="bg-gray-900 rounded-2xl p-4 space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">API Debug Log</p>
                <button onClick={() => setDebugLog([])} className="text-xs text-gray-500 hover:text-gray-300">Clear</button>
              </div>
              <div className="space-y-1.5 max-h-60 overflow-y-auto">
                {debugLog.length === 0 ? (
                  <p className="text-xs text-gray-500">Click "Fetch from Gmail" to see live API responses here.</p>
                ) : debugLog.map((log, i) => (
                  <div key={i} className={cn('rounded-lg p-2 text-xs font-mono',
                    log.type === 'error'   ? 'bg-red-900/40 text-red-300'     :
                    log.type === 'success' ? 'bg-emerald-900/40 text-emerald-300' :
                    log.type === 'warn'    ? 'bg-amber-900/40 text-amber-300'  :
                    'bg-gray-800 text-gray-300'
                  )}>
                    <span className="text-gray-500">[{log.time}]</span> {log.label}
                    {log.data && (
                      <pre className="mt-1 text-[10px] opacity-80 whitespace-pre-wrap break-all">
                        {JSON.stringify(log.data, null, 2)}
                      </pre>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Source filters */}
      <motion.div variants={fadeUp} className="space-y-2">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Filter by Portal</p>
        <div className="flex gap-2 flex-wrap">
          {SOURCE_FILTERS.map(f => (
            <button
              key={f.key}
              onClick={() => changeFilter('source', f.key)}
              className={cn(
                'px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all',
                sourceFilter === f.key
                  ? 'bg-emerald-600 text-white border-emerald-600'
                  : 'bg-white text-gray-600 border-gray-200 hover:border-emerald-300'
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
      </motion.div>

      {/* Status filters */}
      <motion.div variants={fadeUp} className="flex gap-2 flex-wrap">
        {STATUS_FILTERS.map(f => (
          <button
            key={f.key}
            onClick={() => changeFilter('status', f.key)}
            className={cn(
              'px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all',
              statusFilter === f.key
                ? 'bg-blue-600 text-white border-blue-600'
                : 'bg-white text-gray-600 border-gray-200 hover:border-blue-300'
            )}
          >
            {f.label}
          </button>
        ))}
      </motion.div>

      {/* Jobs list */}
      <div className="flex-1 min-w-0 space-y-2">
        {loading ? (
          [...Array(5)].map((_, i) => (
            <div key={i} className="bg-white rounded-2xl border border-gray-100 p-4 flex items-center gap-3">
              <div className="skeleton w-10 h-10 rounded-xl flex-shrink-0" />
              <div className="flex-1 space-y-2">
                <div className="skeleton h-4 w-2/3 rounded" />
                <div className="skeleton h-3 w-1/3 rounded" />
              </div>
            </div>
          ))
        ) : jobs.length === 0 ? (
          <motion.div variants={fadeUp} className="bg-white rounded-2xl border border-gray-100 p-14 text-center">
            <div className="w-14 h-14 rounded-2xl bg-emerald-50 flex items-center justify-center mx-auto mb-3">
              <Inbox className="w-6 h-6 text-emerald-400" />
            </div>
            <p className="text-gray-700 font-semibold">No email jobs yet</p>
            <p className="text-gray-400 text-sm mt-1 mb-4">
              {gmailConnected
                ? 'Click "Fetch from Gmail" to scan your inbox for job alert emails'
                : 'Connect Gmail first in the LinkedIn page'}
            </p>
            {gmailConnected && (
              <button onClick={fetchFromGmail} disabled={fetchLoading} className="btn btn-primary btn-sm mx-auto">
                {fetchLoading
                  ? <><Loader2 className="w-4 h-4 animate-spin" /> Fetching…</>
                  : <><RefreshCw className="w-4 h-4" /> Fetch Now</>}
              </button>
            )}
          </motion.div>
        ) : (
          <motion.div variants={stagger} initial="hidden" animate="show" className="space-y-2">
            {jobs.map(job => {
              const sc = STATUS_CONFIG[job.status] || STATUS_CONFIG.new;
              return (
                <motion.div
                  key={job._id}
                  variants={fadeUp}
                  onClick={() => setSelected(job)}
                  whileHover={{ y: -1 }}
                  className={cn(
                    'bg-white rounded-2xl border cursor-pointer transition-all p-4',
                    selected?._id === job._id
                      ? 'border-emerald-300 shadow-md'
                      : 'border-gray-100 hover:border-emerald-200 hover:shadow-sm'
                  )}
                >
                  <div className="flex items-start gap-3">
                    <CompanyAvatar name={job.company} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <h3 className="font-semibold text-gray-900 text-sm truncate">{job.title}</h3>
                          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                            {job.company && (
                              <span className="text-xs text-gray-500 flex items-center gap-1">
                                <Building className="w-3 h-3" /> {job.company}
                              </span>
                            )}
                            {job.location && (
                              <span className="text-xs text-gray-400 flex items-center gap-1">
                                <MapPin className="w-3 h-3" /> {job.location}
                              </span>
                            )}
                            {job.remote && (
                              <span className="text-xs bg-emerald-100 text-emerald-700 font-semibold px-1.5 py-0.5 rounded-full">Remote</span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5 flex-shrink-0 flex-wrap justify-end">
                          {job.matchScore > 0 && (
                            <span className={cn('flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold',
                              job.matchScore >= 75 ? 'bg-emerald-100 text-emerald-700' :
                              job.matchScore >= 50 ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-500'
                            )}>
                              <Star className="w-3 h-3" /> {job.matchScore}%
                            </span>
                          )}
                          <SourceBadge source={job.source} />
                          <span className={cn('text-xs font-semibold px-2 py-0.5 rounded-full', sc.cls)}>{sc.label}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 mt-1.5">
                        {job.recruiterEmail ? (
                          <span className="text-xs bg-emerald-100 text-emerald-700 font-semibold px-1.5 py-0.5 rounded-full flex items-center gap-1">
                            <Mail className="w-3 h-3" /> HR Email
                          </span>
                        ) : job.careerPageUrl ? (
                          <span className="text-xs bg-blue-50 text-blue-600 font-semibold px-1.5 py-0.5 rounded-full flex items-center gap-1">
                            <ExternalLink className="w-3 h-3" /> Career Page
                          </span>
                        ) : null}
                        {job.url && (
                          <a
                            href={job.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={e => e.stopPropagation()}
                            className="text-xs text-blue-500 hover:text-blue-700 flex items-center gap-0.5"
                          >
                            <ExternalLink className="w-3 h-3" /> View Job
                          </a>
                        )}
                        <span className="text-xs text-gray-300">· {fAgo(job.createdAt)}</span>
                      </div>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </motion.div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-3 pt-2">
            <button disabled={page === 1} onClick={() => { setPage(p => p - 1); setSelected(null); }} className="btn btn-secondary btn-sm">
              <ChevronLeft className="w-4 h-4" /> Prev
            </button>
            <span className="text-sm font-medium text-gray-600">
              Page {page} of {totalPages} · {total} jobs
            </span>
            <button disabled={page >= totalPages} onClick={() => { setPage(p => p + 1); setSelected(null); }} className="btn btn-secondary btn-sm">
              Next <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>

      {/* Detail panel */}
      <AnimatePresence>
        {selected && (
          <>
            <motion.div
              key="backdrop"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/20 z-[1100]"
              onClick={() => setSelected(null)}
            />
            <motion.div
              key="sheet"
              initial={{ x: '100%', opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: '100%', opacity: 0 }}
              transition={{ type: 'tween', duration: 0.22, ease: 'easeOut' }}
              className="fixed right-0 top-0 h-full w-full max-w-md bg-white shadow-2xl z-[1101] flex flex-col overflow-hidden"
            >
              <JobDetailPanel
                job={selected}
                mode="linkedin"
                onClose={() => setSelected(null)}
                onJobUpdate={(patch) => {
                  if (patch._deleted) { setSelected(null); loadJobs(); return; }
                  setJobs(prev => prev.map(j => j._id === selected._id ? { ...j, ...patch } : j));
                  setSelected(prev => prev ? { ...prev, ...patch } : prev);
                }}
              />
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
