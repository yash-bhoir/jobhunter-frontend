import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  MapPin, Bookmark, BookmarkCheck,
  Search, Download, Building, Wifi, Star, Mail, Send,
  Loader2, ChevronLeft, ChevronRight, Users, Clock,
  RefreshCw, X, SlidersHorizontal, Copy, Check,
  Linkedin, ShieldCheck, AlertCircle, HelpCircle,
  Sparkles, ArrowUpRight, Lock, Zap
} from 'lucide-react';
import { api }  from '@utils/axios';
import { cn }   from '@utils/helpers';
import { truncate } from '@utils/formatters';
import { JOB_STATUS_STYLES, JOB_STATUS_LABELS } from '@utils/constants';
import { useToast } from '@hooks/useToast';
import { useAuth }  from '@hooks/useAuth';
import MatchExplainer  from '../../components/jobs/MatchExplainer';
import CompanyResearch from '../../components/jobs/CompanyResearch';

const STATUSES  = ['found','saved','applied','interview','offer','rejected'];
const SORT_OPTS = [
  { value: 'matchScore', label: 'Best Match' },
  { value: 'date',       label: 'Newest'     },
];

const SCORE_STYLE = (s) =>
  s >= 75 ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
  s >= 50 ? 'bg-amber-50 text-amber-700 border border-amber-200' :
            'bg-gray-100 text-gray-500';

const FREE_JOB_LIMIT = 10;

// Locked job card shown to free users beyond their limit
const LockedJobCard = ({ job }) => (
  <div className="relative overflow-hidden rounded-2xl border-2 border-dashed border-gray-200 bg-gray-50/60 p-4 select-none">
    {/* Blurred content */}
    <div className="blur-sm pointer-events-none opacity-60">
      <div className="flex items-start gap-3">
        <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 bg-gray-300 text-white font-black text-base" />
        <div className="flex-1 space-y-2">
          <div className="h-4 bg-gray-200 rounded-lg w-3/5" />
          <div className="h-3 bg-gray-200 rounded-lg w-2/5" />
          <div className="h-3 bg-gray-200 rounded-lg w-1/3" />
        </div>
        <div className="w-12 h-6 bg-gray-200 rounded-full" />
      </div>
    </div>
    {/* Lock overlay */}
    <div className="absolute inset-0 flex items-center justify-center">
      <div className="flex items-center gap-2 bg-white/90 backdrop-blur-sm border border-gray-200 rounded-xl px-3 py-2 shadow-sm">
        <Lock className="w-3.5 h-3.5 text-gray-500" />
        <span className="text-xs font-semibold text-gray-600">Pro only</span>
      </div>
    </div>
  </div>
);

const listVariants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.04 } },
};
const cardVariant = {
  hidden: { opacity: 0, y: 12 },
  show:   { opacity: 1, y: 0, transition: { duration: 0.25, ease: 'easeOut' } },
};

export default function Results() {
  const toast    = useToast();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const searchId = searchParams.get('searchId');

  const [jobs,        setJobs]        = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [selected,    setSelected]    = useState(null);
  const [filter,      setFilter]      = useState({ status: '', source: '', remote: '' });
  const [sort,        setSort]        = useState('matchScore');
  const [search,      setSearch]      = useState('');
  const [page,        setPage]        = useState(1);
  const [total,       setTotal]       = useState(0);
  const [searchMeta,  setSearchMeta]  = useState(null);
  const [outreachLoading, setOutreachLoading] = useState(false);
  const [hrLookup,    setHrLookup]    = useState({});
  const [showFilters, setShowFilters] = useState(false);
  const [activeTab,   setActiveTab]   = useState('details');
  const [evalLoading, setEvalLoading] = useState(false);
  const [prepLoading, setPrepLoading] = useState(false);
  const [livenessLoading, setLivenessLoading] = useState({});

  useEffect(() => {
    if (!searchId) return;
    api.get(`/search/${searchId}`).then(({ data }) => setSearchMeta(data.data)).catch(() => {});
  }, [searchId]);

  const checkLiveness = async (job) => {
    const jobId = job._id;
    setLivenessLoading(p => ({ ...p, [jobId]: true }));
    try {
      const { data } = await api.post(`/jobs/${jobId}/check-liveness`);
      const liveness = data.data?.liveness;
      setJobs(prev => prev.map(j => j._id === jobId ? { ...j, liveness } : j));
      setSelected(prev => prev?._id === jobId ? { ...prev, liveness } : prev);
      toast.success(liveness === 'active' ? 'Job is still active!' : liveness === 'expired' ? 'Job may be closed' : 'Status unclear');
    } catch { toast.error('Liveness check failed'); }
    finally { setLivenessLoading(p => ({ ...p, [jobId]: false })); }
  };

  const runDeepEval = async (job) => {
    setEvalLoading(true);
    try {
      const { data } = await api.post(`/jobs/${job._id}/deep-evaluate`);
      const deepEval = data.data;
      setJobs(prev => prev.map(j => j._id === job._id ? { ...j, deepEval } : j));
      setSelected(prev => prev?._id === job._id ? { ...prev, deepEval } : prev);
      toast.success('Deep evaluation complete');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Evaluation failed');
    }
    finally { setEvalLoading(false); }
  };

  const runInterviewPrep = async (job) => {
    setPrepLoading(true);
    try {
      const { data } = await api.post(`/jobs/${job._id}/interview-prep`);
      const interviewPrep = data.data;
      setJobs(prev => prev.map(j => j._id === job._id ? { ...j, interviewPrep } : j));
      setSelected(prev => prev?._id === job._id ? { ...prev, interviewPrep } : prev);
      toast.success('Interview prep generated');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Prep generation failed');
    }
    finally { setPrepLoading(false); }
  };

  const fetchJobs = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page, limit: 20, sort,
        ...(filter.status && { status: filter.status }),
        ...(filter.source && { source: filter.source }),
        ...(filter.remote && { remote: filter.remote }),
        ...(searchId      && { searchId }),
      });
      const { data } = await api.get(`/jobs?${params}`);
      setJobs(data.data || []);
      setTotal(data.pagination?.total || 0);
    } catch { toast.error('Failed to load jobs'); }
    finally  { setLoading(false); }
  };

  useEffect(() => { fetchJobs(); }, [page, sort, filter]);

  const updateStatus = async (jobId, status) => {
    try {
      await api.patch(`/jobs/${jobId}/status`, { status });
      setJobs(prev => prev.map(j => j._id === jobId ? { ...j, status } : j));
      if (selected?._id === jobId) setSelected(prev => ({ ...prev, status }));
      toast.success(`Marked as ${status}`);
    } catch { toast.error('Failed to update'); }
  };

  const saveJob = async (job) => {
    try {
      await api.post(job.status === 'saved' ? `/jobs/${job._id}/unsave` : `/jobs/${job._id}/save`);
      const ns = job.status === 'saved' ? 'found' : 'saved';
      setJobs(prev => prev.map(j => j._id === job._id ? { ...j, status: ns } : j));
      if (selected?._id === job._id) setSelected(prev => ({ ...prev, status: ns }));
    } catch { toast.error('Failed'); }
  };

  const findHRContact = async (job) => {
    const jobId = job._id;
    setHrLookup(p => ({ ...p, [jobId]: { loading: true } }));
    try {
      const { data } = await api.post('/recruiters/lookup', { company: job.company, jobId });
      const result = data.data;
      setHrLookup(p => ({ ...p, [jobId]: { loading: false, result } }));
      const top = result.emails?.[0];
      if (top?.email) {
        const patch = {
          recruiterEmail:       top.email,
          recruiterName:        top.name       || null,
          recruiterConfidence:  top.confidence || null,
          recruiterEmailStatus: top.status     || 'unknown',
          allRecruiterContacts: result.emails  || [],
        };
        setJobs(prev => prev.map(j => j._id === jobId ? { ...j, ...patch } : j));
        setSelected(prev => prev?._id === jobId ? { ...prev, ...patch } : prev);
      }
    } catch (err) {
      const msg = err.response?.data?.message || 'Lookup failed';
      setHrLookup(p => ({ ...p, [jobId]: { loading: false, error: msg } }));
      toast.error(msg);
    }
  };

  const findEmployees = async (job) => {
    const jobId = job._id;
    setHrLookup(p => ({ ...p, [`emp_${jobId}`]: { loading: true } }));
    try {
      const { data } = await api.post(`/jobs/${jobId}/find-employees`);
      const employees = data.data.employees || [];
      const patch = { employees };
      setJobs(prev => prev.map(j => j._id === jobId ? { ...j, ...patch } : j));
      setSelected(prev => prev?._id === jobId ? { ...prev, ...patch } : prev);
      setHrLookup(p => ({ ...p, [`emp_${jobId}`]: { loading: false } }));
      toast.success(employees.length > 0
        ? `Found ${employees.length} employee contacts`
        : 'No employees found via Apollo for this company');
    } catch (err) {
      const msg = err.response?.data?.message || 'Employee search failed';
      setHrLookup(p => ({ ...p, [`emp_${jobId}`]: { loading: false, error: msg } }));
      toast.error(msg);
    }
  };

  // Fetch fresh contacts (employees + HR) from DB when a job is selected
  const fetchContacts = async (jobId) => {
    try {
      const { data } = await api.get(`/jobs/${jobId}/contacts`);
      const { hrContacts, employees } = data.data;
      const patch = {};
      if (employees?.length > 0) patch.employees = employees;
      if (hrContacts?.length > 0) {
        patch.allRecruiterContacts = hrContacts;
        patch.recruiterEmail = hrContacts[0]?.email || undefined;
        patch.recruiterName  = hrContacts[0]?.name  || undefined;
      }
      if (Object.keys(patch).length > 0) {
        setJobs(prev => prev.map(j => j._id === jobId ? { ...j, ...patch } : j));
        setSelected(prev => prev?._id === jobId ? { ...prev, ...patch } : prev);
      }
    } catch { /* silent — contacts are optional */ }
  };

  const exportExcel = async () => {
    try {
      const response = await api.post('/jobs/export/excel', {}, { responseType: 'blob' });
      const url  = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href  = url;
      link.setAttribute('download', 'jobhunter-results.xlsx');
      document.body.appendChild(link); link.click(); link.remove();
      toast.success('Excel downloaded!');
    } catch { toast.error('Export failed'); }
  };

  const handleManageOutreach = async () => {
    setOutreachLoading(true);
    try {
      const { data } = await api.get('/search/history?limit=1');
      const sid = data.data?.[0]?._id;
      if (sid) navigate(`/outreach-manager?searchId=${sid}`);
      else toast.error('Run a search first');
    } catch { toast.error('Failed'); }
    finally { setOutreachLoading(false); }
  };

  const filtered = jobs.filter(j =>
    !search ||
    j.title?.toLowerCase().includes(search.toLowerCase()) ||
    j.company?.toLowerCase().includes(search.toLowerCase())
  );

  const jobsWithEmail = jobs.filter(j => j.recruiterEmail).length;
  const isPro = user?.plan === 'pro' || user?.plan === 'team';

  return (
    <div className="flex gap-5 h-full max-w-7xl mx-auto relative">

      {/* ── Left — job list ───────────────────────────────────────── */}
      <div className="flex-1 min-w-0 space-y-4">

        {/* Header */}
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold text-gray-900">Job Results</h1>
            <p className="text-gray-400 text-sm mt-0.5">
              {loading ? '...' : total} jobs{jobsWithEmail > 0 && ` · ${jobsWithEmail} HR emails`}
            </p>
          </div>
          <div className="flex gap-2">
            {searchId && (
              <button onClick={() => navigate('/results')} className="btn btn-secondary btn-sm">
                <RefreshCw className="w-3.5 h-3.5" /> All
              </button>
            )}
            <button onClick={() => setShowFilters(v => !v)} className={cn('btn btn-sm', showFilters ? 'btn-primary' : 'btn-secondary')}>
              <SlidersHorizontal className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Filters</span>
            </button>
            <button onClick={exportExcel} className="btn btn-secondary btn-sm">
              <Download className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Export</span>
            </button>
          </div>
        </div>

        {/* Past search banner */}
        {searchId && searchMeta && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center justify-between gap-3 p-3.5 bg-amber-50 border border-amber-200 rounded-2xl"
          >
            <div className="flex items-center gap-2 min-w-0">
              <Clock className="w-4 h-4 text-amber-600 flex-shrink-0" />
              <div className="min-w-0">
                <p className="text-sm font-semibold text-amber-800 truncate">"{searchMeta.query?.role}"</p>
                <p className="text-xs text-amber-600">{searchMeta.query?.location} · {searchMeta.totalFound} jobs</p>
              </div>
            </div>
            <Link to="/search" className="btn btn-sm bg-amber-500 text-white hover:bg-amber-600 flex-shrink-0">New Search</Link>
          </motion.div>
        )}

        {/* Outreach banner */}
        {isPro && jobsWithEmail > 0 && (
          <motion.div
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            className="relative overflow-hidden rounded-2xl p-4 text-white"
            style={{ background: 'linear-gradient(135deg, #2563eb, #7c3aed)' }}
          >
            <div className="absolute inset-0 opacity-10">
              <div className="absolute -right-6 -top-6 w-32 h-32 rounded-full bg-white" />
              <div className="absolute -left-4 -bottom-4 w-24 h-24 rounded-full bg-white" />
            </div>
            <div className="relative flex items-center justify-between gap-4">
              <div>
                <p className="font-bold flex items-center gap-2">
                  <Sparkles className="w-4 h-4" />
                  {jobsWithEmail} HR emails ready for outreach
                </p>
                <p className="text-blue-100 text-sm mt-0.5">AI-powered personalised emails · 7 credits each</p>
              </div>
              <button
                onClick={handleManageOutreach}
                disabled={outreachLoading}
                className="btn bg-white text-blue-700 hover:bg-blue-50 flex-shrink-0 font-bold"
              >
                {outreachLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                Manage Outreach
              </button>
            </div>
          </motion.div>
        )}

        {/* Filter bar */}
        <AnimatePresence>
          {showFilters && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden"
            >
              <div className="bg-white rounded-2xl border border-gray-100 p-4 space-y-3">
                <div className="relative">
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    placeholder="Search by title or company..."
                    className="input pl-10"
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <select value={filter.status} onChange={e => setFilter(p => ({ ...p, status: e.target.value }))} className="input text-sm">
                    <option value="">All Status</option>
                    {STATUSES.map(s => <option key={s} value={s}>{JOB_STATUS_LABELS[s]}</option>)}
                  </select>
                  <select value={filter.remote} onChange={e => setFilter(p => ({ ...p, remote: e.target.value }))} className="input text-sm">
                    <option value="">All Types</option>
                    <option value="true">Remote</option>
                    <option value="false">On-site</option>
                  </select>
                  <select value={sort} onChange={e => setSort(e.target.value)} className="input text-sm">
                    {SORT_OPTS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Job list */}
        {loading ? (
          <div className="space-y-3">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="bg-white rounded-2xl border border-gray-100 p-4 flex gap-3">
                <div className="skeleton w-11 h-11 rounded-xl flex-shrink-0" />
                <div className="flex-1 space-y-2.5">
                  <div className="skeleton h-4 w-3/5 rounded-lg" />
                  <div className="skeleton h-3 w-2/5 rounded-lg" />
                  <div className="skeleton h-3 w-4/5 rounded-lg" />
                </div>
                <div className="skeleton w-12 h-6 rounded-full flex-shrink-0" />
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="bg-white rounded-3xl border border-gray-100 p-12 text-center">
            <div className="w-16 h-16 rounded-3xl bg-gray-100 flex items-center justify-center mx-auto mb-4">
              <Search className="w-8 h-8 text-gray-300" />
            </div>
            <p className="font-bold text-gray-900 mb-1">No jobs yet</p>
            <p className="text-gray-400 text-sm mb-5">Run your first AI-powered search to see results</p>
            <Link to="/search" className="btn btn-primary">Search Jobs</Link>
          </div>
        ) : (
          <motion.div
            variants={listVariants}
            initial="hidden"
            animate="show"
            className="space-y-2.5"
          >
            {filtered.map((job, idx) => {
              // Free plan: show first 10 normally, lock the rest
              const isLocked = !isPro && idx >= FREE_JOB_LIMIT;
              if (isLocked) return <motion.div key={job._id} variants={cardVariant}><LockedJobCard job={job} /></motion.div>;

              return (
              <motion.div
                key={job._id}
                variants={cardVariant}
                onClick={() => { setSelected(job); setActiveTab('details'); fetchContacts(job._id); }}
                className={cn(
                  'group bg-white rounded-2xl border-2 p-4 cursor-pointer transition-all duration-200',
                  'hover:shadow-md hover:-translate-y-0.5',
                  selected?._id === job._id
                    ? 'border-blue-400 shadow-md bg-blue-50/20'
                    : 'border-gray-100 hover:border-blue-200'
                )}
                style={{ perspective: '800px' }}
              >
                <div className="flex items-start gap-3">
                  {/* Company logo */}
                  <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 text-white font-black text-base shadow-sm"
                    style={{ background: `hsl(${(job.company?.charCodeAt(0) || 65) * 5 % 360}, 65%, 55%)` }}
                  >
                    {job.company?.[0]?.toUpperCase() || '?'}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <h3 className="font-bold text-gray-900 text-sm truncate group-hover:text-blue-700 transition-colors">{job.title}</h3>
                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                          <span className="text-xs text-gray-500 font-medium flex items-center gap-1">
                            <Building className="w-3 h-3" /> {job.company}
                          </span>
                          {job.location && (
                            <span className="text-xs text-gray-400 flex items-center gap-1">
                              <MapPin className="w-3 h-3" /> {job.location}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        <span className={cn('inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold', SCORE_STYLE(job.matchScore))}>
                          <Star className="w-3 h-3" /> {job.matchScore}%
                        </span>
                        <button
                          onClick={e => { e.stopPropagation(); saveJob(job); }}
                          className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
                        >
                          {job.status === 'saved'
                            ? <BookmarkCheck className="w-4 h-4 text-blue-600" />
                            : <Bookmark className="w-4 h-4 text-gray-300 group-hover:text-gray-500" />}
                        </button>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 mt-2 flex-wrap">
                      {job.remote && <span className="badge badge-green text-xs"><Wifi className="w-3 h-3" /> Remote</span>}
                      {job.recruiterEmail && <span className="badge badge-blue text-xs"><Mail className="w-3 h-3" /> HR Email</span>}
                      <span className={cn('badge text-xs', JOB_STATUS_STYLES[job.status])}>{JOB_STATUS_LABELS[job.status]}</span>
                      {/* Liveness badge */}
                      {job.liveness === 'expired' && (
                        <span className="badge text-xs bg-red-100 text-red-600 border border-red-200">Possibly Closed</span>
                      )}
                      {job.liveness === 'uncertain' && (
                        <span className="badge text-xs bg-amber-100 text-amber-600 border border-amber-200">Unverified</span>
                      )}
                      {/* Follow-up badge */}
                      {job.followUpDate && new Date(job.followUpDate) <= new Date() && (
                        <span className="badge text-xs bg-violet-100 text-violet-700 border border-violet-200">Follow Up Due</span>
                      )}
                      {job.salary && job.salary !== 'Not specified' && (
                        <span className="text-xs text-gray-400 font-medium">{job.salary}</span>
                      )}
                      <span className="text-xs text-gray-300 ml-auto">{job.source}</span>
                    </div>
                  </div>
                </div>
              </motion.div>
              );
            })}

            {/* Free plan paywall banner */}
            {!isPro && filtered.length > FREE_JOB_LIMIT && (
              <motion.div
                variants={cardVariant}
                className="rounded-2xl border-2 border-blue-200 bg-gradient-to-br from-blue-50 to-violet-50 p-6 text-center"
              >
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center mx-auto mb-3 shadow-lg">
                  <Zap className="w-6 h-6 text-white" />
                </div>
                <h3 className="font-bold text-gray-900 mb-1">
                  {filtered.length - FREE_JOB_LIMIT} more jobs locked
                </h3>
                <p className="text-sm text-gray-500 mb-4">
                  Upgrade to Pro to unlock all {filtered.length} jobs, HR emails, deep evaluation &amp; more
                </p>
                <a
                  href="/settings?tab=billing"
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-violet-600 text-white font-bold text-sm shadow-md hover:shadow-lg hover:scale-105 transition-all duration-200"
                >
                  <Zap className="w-4 h-4" /> Upgrade to Pro
                </a>
              </motion.div>
            )}
          </motion.div>
        )}

        {/* Pagination */}
        {total > 20 && (
          <div className="flex items-center justify-center gap-3 pt-2">
            <button disabled={page === 1} onClick={() => setPage(p => p - 1)} className="btn btn-secondary btn-sm">
              <ChevronLeft className="w-4 h-4" /> Prev
            </button>
            <span className="text-sm font-medium text-gray-600">{page} / {Math.ceil(total / 20)}</span>
            <button disabled={page * 20 >= total} onClick={() => setPage(p => p + 1)} className="btn btn-secondary btn-sm">
              Next <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>

      {/* ── Right — job detail panel ──────────────────────────────── */}
      {/* Mobile overlay */}
      <AnimatePresence>
        {selected && (
          <motion.div
            key="overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/40 z-40 lg:hidden"
            onClick={() => setSelected(null)}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {selected && (
          <motion.div
            initial={{ opacity: 0, y: '100%' }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: '100%' }}
            transition={{ duration: 0.28, ease: 'easeOut' }}
            className="fixed bottom-0 inset-x-0 z-50 lg:relative lg:z-auto lg:bottom-auto lg:inset-x-auto lg:w-[380px] lg:flex-shrink-0"
          >
            {/* Desktop: re-enter from right */}
            <div className="bg-white rounded-t-3xl lg:rounded-3xl border border-gray-100 lg:sticky lg:top-4 overflow-hidden"
              style={{ maxHeight: '88vh', display: 'flex', flexDirection: 'column', boxShadow: '0 8px 32px -4px rgba(0,0,0,0.1)' }}
            >
            {/* Mobile drag handle */}
            <div className="flex justify-center pt-3 pb-1 lg:hidden flex-shrink-0">
              <div className="w-10 h-1 bg-gray-300 rounded-full" />
            </div>
              {/* Header */}
              <div className="p-5 border-b border-gray-100 flex-shrink-0">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-white font-black text-lg flex-shrink-0"
                      style={{ background: `hsl(${(selected.company?.charCodeAt(0) || 65) * 5 % 360}, 65%, 55%)` }}
                    >
                      {selected.company?.[0]?.toUpperCase() || '?'}
                    </div>
                    <div className="min-w-0">
                      <h2 className="font-bold text-gray-900 leading-tight truncate">{selected.title}</h2>
                      <p className="text-sm text-gray-500 font-medium mt-0.5">{selected.company}</p>
                    </div>
                  </div>
                  <button onClick={() => setSelected(null)} className="p-1.5 rounded-xl hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors flex-shrink-0">
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="flex items-center gap-2 mt-3 flex-wrap">
                  <span className={cn('inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold', SCORE_STYLE(selected.matchScore))}>
                    <Star className="w-3 h-3" /> {selected.matchScore}% match
                  </span>
                  {selected.remote && <span className="badge badge-green text-xs"><Wifi className="w-3 h-3" /> Remote</span>}
                  {selected.location && (
                    <span className="text-xs text-gray-400 flex items-center gap-1">
                      <MapPin className="w-3 h-3" /> {selected.location}
                    </span>
                  )}
                </div>
              </div>

              {/* Tabs */}
              <div className="flex border-b border-gray-100 flex-shrink-0 px-1 overflow-x-auto">
                {['details', 'contacts', 'status', 'ai', 'eval', 'prep'].map(tab => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={cn(
                      'flex-shrink-0 px-2 py-3 text-xs font-semibold capitalize transition-colors border-b-2 whitespace-nowrap',
                      activeTab === tab
                        ? 'border-blue-600 text-blue-700'
                        : 'border-transparent text-gray-400 hover:text-gray-600'
                    )}
                  >
                    {tab === 'contacts'
                      ? `Contacts${(selected.allRecruiterContacts?.length || (selected.recruiterEmail ? 1 : 0)) > 0 ? ` (${selected.allRecruiterContacts?.length || 1})` : ''}`
                      : tab === 'ai' ? 'AI Tools'
                      : tab === 'eval' ? 'Deep Eval'
                      : tab === 'prep' ? 'Prep'
                      : tab}
                  </button>
                ))}
              </div>

              {/* Tab content */}
              <div className="flex-1 overflow-y-auto p-5 space-y-4">

                {activeTab === 'details' && (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
                    <div className="flex gap-2">
                      {selected.salary && selected.salary !== 'Not specified' && (
                        <span className="badge badge-gray">{selected.salary}</span>
                      )}
                      <span className="badge badge-indigo">{selected.source}</span>
                    </div>
                    {selected.description ? (
                      <div>
                        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Description</p>
                        <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-line">
                          {truncate(selected.description, 600)}
                        </p>
                      </div>
                    ) : (
                      <p className="text-sm text-gray-400 italic">No description available</p>
                    )}
                    {/* Liveness status */}
                    {selected.liveness && (
                      <div className={cn('flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold',
                        selected.liveness === 'active'    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                        selected.liveness === 'expired'   ? 'bg-red-50 text-red-600 border border-red-200' :
                        'bg-amber-50 text-amber-700 border border-amber-200'
                      )}>
                        {selected.liveness === 'active'  && <ShieldCheck className="w-3.5 h-3.5" />}
                        {selected.liveness === 'expired' && <AlertCircle className="w-3.5 h-3.5" />}
                        {selected.liveness === 'uncertain' && <HelpCircle className="w-3.5 h-3.5" />}
                        {selected.liveness === 'active'   ? 'Job is still active' :
                         selected.liveness === 'expired'  ? 'Job may be closed' : 'Status uncertain'}
                      </div>
                    )}
                    <div className="flex gap-2">
                      <a
                        href={selected.applyUrl || selected.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn btn-primary flex-1 justify-center"
                      >
                        <ArrowUpRight className="w-4 h-4" /> Apply Now
                      </a>
                      <button
                        onClick={() => checkLiveness(selected)}
                        disabled={livenessLoading[selected._id]}
                        className="btn btn-secondary px-3"
                        title="Check if job is still open"
                      >
                        {livenessLoading[selected._id]
                          ? <Loader2 className="w-4 h-4 animate-spin" />
                          : <RefreshCw className="w-4 h-4" />}
                      </button>
                    </div>
                    <button
                      onClick={() => {
                        const allEmails = [
                          ...(selected.allRecruiterContacts?.length > 0
                            ? selected.allRecruiterContacts
                            : selected.recruiterEmail
                              ? [{ email: selected.recruiterEmail }]
                              : []),
                          ...(selected.employees?.filter(e => e.email) || []),
                        ].map(c => c.email).filter(Boolean);
                        const params = new URLSearchParams({
                          company:  selected.company,
                          jobTitle: selected.title,
                          ...(allEmails.length ? { to: allEmails.join(',') } : {}),
                          ...(selected.searchId ? { searchId: selected.searchId } : {}),
                        });
                        window.location.href = `/outreach-manager?${params}`;
                      }}
                      className="w-full py-2.5 rounded-xl text-sm font-semibold text-white flex items-center justify-center gap-2"
                      style={{ background: 'linear-gradient(135deg, #2563eb 0%, #7c3aed 100%)' }}
                    >
                      <Send className="w-4 h-4" /> Send Outreach
                    </button>
                  </motion.div>
                )}

                {activeTab === 'contacts' && (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">

                    {/* ── HR Emails ───────────────────────────── */}
                    <ContactsSection
                      title="HR Emails"
                      icon={Mail}
                      iconColor="text-blue-500"
                      items={
                        selected.allRecruiterContacts?.length > 0
                          ? selected.allRecruiterContacts
                          : selected.recruiterEmail
                            ? [{ email: selected.recruiterEmail, name: selected.recruiterName, confidence: selected.recruiterConfidence, source: selected.recruiterSource, status: selected.recruiterEmailStatus || 'unknown', linkedin: selected.recruiterLinkedIn }]
                            : []
                      }
                      emptyText="No HR emails found yet"
                      onOutreach={(contacts) => {
                        const params = new URLSearchParams({
                          company:  selected.company,
                          jobTitle: selected.title,
                          to:       contacts.map(c => c.email).join(','),
                          ...(selected.searchId ? { searchId: selected.searchId } : {}),
                        });
                        window.location.href = `/outreach-manager?${params}`;
                      }}
                    />

                    {/* ── Employees ───────────────────────────── */}
                    <ContactsSection
                      title="Employees"
                      icon={Users}
                      iconColor="text-violet-500"
                      items={(selected.employees || []).map(e => ({
                        email:      e.email,
                        name:       e.name,
                        title:      e.title,
                        linkedin:   e.linkedin,
                        source:     e.source || 'apollo',
                        status:     e.email ? 'verified' : 'unknown',
                        confidence: e.email ? 85 : 0,
                      }))}
                      emptyText="No employees found yet"
                      onOutreach={(contacts) => {
                        const params = new URLSearchParams({
                          company:  selected.company,
                          jobTitle: selected.title,
                          to:       contacts.filter(c => c.email).map(c => c.email).join(','),
                          ...(selected.searchId ? { searchId: selected.searchId } : {}),
                        });
                        window.location.href = `/outreach-manager?${params}`;
                      }}
                    />

                    {/* ── Action buttons ───────────────────────── */}
                    <div className="space-y-2 pt-1">
                      {isPro ? (
                        <>
                          <button
                            onClick={() => findHRContact(selected)}
                            disabled={hrLookup[selected._id]?.loading}
                            className="btn btn-secondary btn-sm w-full justify-center"
                          >
                            {hrLookup[selected._id]?.loading
                              ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Looking up HR…</>
                              : <><Search className="w-3.5 h-3.5" /> Find HR Emails</>}
                            <span className="ml-auto text-[10px] bg-gray-200 text-gray-600 font-semibold px-1.5 py-0.5 rounded-full">15 cr</span>
                          </button>
                          <button
                            onClick={() => findEmployees(selected)}
                            disabled={hrLookup[`emp_${selected._id}`]?.loading}
                            className="btn btn-secondary btn-sm w-full justify-center"
                          >
                            {hrLookup[`emp_${selected._id}`]?.loading
                              ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Finding employees…</>
                              : <><Users className="w-3.5 h-3.5" /> Find Employees</>}
                            <span className="ml-auto text-[10px] bg-gray-200 text-gray-600 font-semibold px-1.5 py-0.5 rounded-full">10 cr</span>
                          </button>
                        </>
                      ) : (
                        <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-700">
                          Upgrade to Pro to find HR emails &amp; employees
                          <Link to="/billing" className="block font-semibold mt-1 text-amber-800 hover:underline">Upgrade Now →</Link>
                        </div>
                      )}

                      {/* Send to all contacts */}
                      {(selected.recruiterEmail || selected.allRecruiterContacts?.length > 0) && (
                        <button
                          onClick={() => {
                            const allEmails = [
                              ...(selected.allRecruiterContacts?.length > 0 ? selected.allRecruiterContacts : selected.recruiterEmail ? [{ email: selected.recruiterEmail }] : []),
                              ...(selected.employees?.filter(e => e.email) || []),
                            ].map(c => c.email).filter(Boolean);
                            const params = new URLSearchParams({
                              company:  selected.company,
                              jobTitle: selected.title,
                              to:       allEmails.join(','),
                              ...(selected.searchId ? { searchId: selected.searchId } : {}),
                            });
                            window.location.href = `/outreach-manager?${params}`;
                          }}
                          className="w-full py-2.5 rounded-xl text-sm font-semibold text-white flex items-center justify-center gap-2"
                          style={{ background: 'linear-gradient(135deg, #2563eb 0%, #7c3aed 100%)' }}
                        >
                          <Send className="w-4 h-4" /> Send Outreach to All Contacts
                        </button>
                      )}
                    </div>
                  </motion.div>
                )}

                {activeTab === 'status' && (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-3">
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Track Your Application</p>
                    <div className="grid grid-cols-2 gap-2">
                      {STATUSES.map(s => (
                        <button
                          key={s}
                          onClick={() => updateStatus(selected._id, s)}
                          className={cn(
                            'px-3 py-2.5 rounded-xl text-xs font-semibold border-2 transition-all',
                            selected.status === s
                              ? 'border-blue-500 bg-blue-50 text-blue-700 shadow-sm'
                              : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
                          )}
                        >
                          {JOB_STATUS_LABELS[s]}
                        </button>
                      ))}
                    </div>
                  </motion.div>
                )}

                {activeTab === 'ai' && (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
                    <MatchExplainer job={selected} />
                    <div className="border-t border-gray-100 pt-4">
                      <CompanyResearch jobId={selected._id} company={selected.company} />
                    </div>
                  </motion.div>
                )}

                {activeTab === 'eval' && (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
                    {selected.deepEval ? (
                      <DeepEvalReport eval={selected.deepEval} />
                    ) : (
                      <div className="text-center py-6 space-y-3">
                        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-violet-100 to-indigo-100 flex items-center justify-center mx-auto">
                          <Sparkles className="w-7 h-7 text-violet-600" />
                        </div>
                        <div>
                          <p className="font-semibold text-gray-800 text-sm">Deep Job Evaluation</p>
                          <p className="text-xs text-gray-400 mt-1">A-F score · CV gap analysis · salary verdict · red flags</p>
                        </div>
                        {isPro ? (
                          <button
                            onClick={() => runDeepEval(selected)}
                            disabled={evalLoading}
                            className="btn btn-primary w-full justify-center"
                          >
                            {evalLoading
                              ? <><Loader2 className="w-4 h-4 animate-spin" /> Evaluating…</>
                              : <><Sparkles className="w-4 h-4" /> Run Deep Evaluation</>}
                            <span className="ml-auto text-[10px] bg-blue-500 px-1.5 py-0.5 rounded-full">5 cr</span>
                          </button>
                        ) : (
                          <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-700">
                            Upgrade to Pro to unlock deep evaluation
                            <Link to="/billing" className="block font-semibold mt-1 text-amber-800 hover:underline">Upgrade Now →</Link>
                          </div>
                        )}
                      </div>
                    )}
                    {selected.deepEval && (
                      <button
                        onClick={() => runDeepEval(selected)}
                        disabled={evalLoading}
                        className="btn btn-secondary btn-sm w-full justify-center"
                      >
                        {evalLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                        Refresh Evaluation
                      </button>
                    )}
                  </motion.div>
                )}

                {activeTab === 'prep' && (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
                    {selected.interviewPrep ? (
                      <InterviewPrepPanel prep={selected.interviewPrep} />
                    ) : (
                      <div className="text-center py-6 space-y-3">
                        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-100 to-teal-100 flex items-center justify-center mx-auto">
                          <Users className="w-7 h-7 text-emerald-600" />
                        </div>
                        <div>
                          <p className="font-semibold text-gray-800 text-sm">Interview Prep</p>
                          <p className="text-xs text-gray-400 mt-1">6 tailored questions with STAR hints · company tips</p>
                        </div>
                        <button
                          onClick={() => runInterviewPrep(selected)}
                          disabled={prepLoading}
                          className="btn btn-primary w-full justify-center"
                          style={{ background: 'linear-gradient(135deg, #059669, #0d9488)' }}
                        >
                          {prepLoading
                            ? <><Loader2 className="w-4 h-4 animate-spin" /> Generating…</>
                            : <><Sparkles className="w-4 h-4" /> Generate Interview Prep</>}
                          <span className="ml-auto text-[10px] bg-emerald-500 px-1.5 py-0.5 rounded-full">5 cr</span>
                        </button>
                      </div>
                    )}
                    {selected.interviewPrep && (
                      <button
                        onClick={() => runInterviewPrep(selected)}
                        disabled={prepLoading}
                        className="btn btn-secondary btn-sm w-full justify-center"
                      >
                        {prepLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                        Regenerate
                      </button>
                    )}
                  </motion.div>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Deep Eval Score badge helper ─────────────────────────────────
function ScoreGrade({ score }) {
  // Normalize: AI returns 0-5 scale, matchScore uses 0-100. Detect and convert.
  const normalized = score <= 5 ? Math.round(score * 20) : score;
  const grade = normalized >= 85 ? 'A' : normalized >= 70 ? 'B' : normalized >= 55 ? 'C' : normalized >= 40 ? 'D' : 'F';
  const style  =
    grade === 'A' ? 'bg-emerald-100 text-emerald-700 border-emerald-300' :
    grade === 'B' ? 'bg-blue-100 text-blue-700 border-blue-300' :
    grade === 'C' ? 'bg-amber-100 text-amber-700 border-amber-300' :
    grade === 'D' ? 'bg-orange-100 text-orange-700 border-orange-300' :
                    'bg-red-100 text-red-600 border-red-300';
  return (
    <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-base font-black border ${style}`}>
      {grade} <span className="text-xs font-semibold opacity-70">({normalized})</span>
    </span>
  );
}

// ── Deep Evaluation Report ────────────────────────────────────────
function DeepEvalReport({ eval: ev }) {
  return (
    <div className="space-y-4">
      {/* Score header */}
      <div className="flex items-center justify-between p-4 bg-gradient-to-r from-violet-50 to-indigo-50 rounded-2xl border border-violet-100">
        <div>
          <p className="text-xs text-violet-500 font-semibold uppercase tracking-wide mb-1">Overall Score</p>
          <ScoreGrade score={ev.score} />
        </div>
        {ev.archetype && (
          <div className="text-right">
            <p className="text-xs text-gray-400 mb-1">Role Type</p>
            <span className="text-xs font-bold text-violet-700 bg-violet-100 px-2.5 py-1 rounded-full">{ev.archetype}</span>
          </div>
        )}
      </div>

      {/* Summary */}
      {ev.summary && (
        <div className="p-3 bg-gray-50 rounded-xl border border-gray-100">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Verdict</p>
          <p className="text-sm text-gray-700 leading-relaxed">{ev.summary}</p>
        </div>
      )}

      {/* Salary */}
      {ev.salaryRange && (
        <div className="flex items-center justify-between p-3 bg-emerald-50 rounded-xl border border-emerald-100">
          <p className="text-xs font-semibold text-emerald-700">Salary Range</p>
          <p className="text-sm font-bold text-emerald-800">{ev.salaryRange}</p>
        </div>
      )}

      {/* CV Gaps */}
      {ev.cvGaps?.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2 flex items-center gap-1.5">
            <AlertCircle className="w-3.5 h-3.5 text-orange-500" /> CV Gaps
          </p>
          <ul className="space-y-1.5">
            {ev.cvGaps.map((gap, i) => (
              <li key={i} className="flex items-start gap-2 text-xs text-gray-600">
                <span className="w-1.5 h-1.5 rounded-full bg-orange-400 flex-shrink-0 mt-1.5" />
                {gap}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Top CV Changes */}
      {ev.topCvChanges?.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2 flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-blue-500" /> Recommended CV Changes
          </p>
          <ul className="space-y-1.5">
            {ev.topCvChanges.map((change, i) => (
              <li key={i} className="flex items-start gap-2 text-xs text-gray-600">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-400 flex-shrink-0 mt-1.5" />
                {change}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Interview Questions preview */}
      {ev.interviewQs?.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2 flex items-center gap-1.5">
            <HelpCircle className="w-3.5 h-3.5 text-violet-500" /> Likely Interview Questions
          </p>
          <ul className="space-y-1.5">
            {ev.interviewQs.slice(0, 3).map((q, i) => (
              <li key={i} className="text-xs text-gray-600 bg-violet-50 rounded-lg px-3 py-2 border border-violet-100">
                {q}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

// ── Interview Prep Panel ──────────────────────────────────────────
function InterviewPrepPanel({ prep }) {
  const [open, setOpen] = useState(null);
  const typeColor = (type) =>
    type === 'technical'   ? 'bg-blue-100 text-blue-700' :
    type === 'behavioral'  ? 'bg-violet-100 text-violet-700' :
    type === 'situational' ? 'bg-amber-100 text-amber-700' :
    type === 'culture'     ? 'bg-emerald-100 text-emerald-700' :
    'bg-gray-100 text-gray-600';

  return (
    <div className="space-y-4">
      {/* Questions */}
      <div>
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Practice Questions</p>
        <div className="space-y-2">
          {prep.questions?.map((q, i) => (
            <div key={i} className="border border-gray-100 rounded-xl overflow-hidden">
              <button
                onClick={() => setOpen(open === i ? null : i)}
                className="w-full flex items-start gap-2.5 p-3 text-left hover:bg-gray-50 transition-colors"
              >
                <span className="w-5 h-5 rounded-full bg-gray-100 text-gray-600 font-bold text-[10px] flex items-center justify-center flex-shrink-0 mt-0.5">
                  {i + 1}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-gray-800 leading-snug">{q.question}</p>
                  {q.type && (
                    <span className={`inline-block mt-1.5 text-[10px] font-semibold px-1.5 py-0.5 rounded-full capitalize ${typeColor(q.type)}`}>
                      {q.type}
                    </span>
                  )}
                </div>
                <span className="text-gray-300 flex-shrink-0">{open === i ? '▲' : '▼'}</span>
              </button>
              {open === i && q.starHint && (
                <div className="px-4 pb-3 bg-blue-50 border-t border-blue-100">
                  <p className="text-[11px] font-semibold text-blue-600 uppercase tracking-wide mt-2 mb-1">STAR Hint</p>
                  <p className="text-xs text-blue-700 leading-relaxed">{q.starHint}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Company research tips */}
      {prep.companyResearchTips?.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2 flex items-center gap-1.5">
            <Building className="w-3.5 h-3.5 text-indigo-500" /> Research Before Interview
          </p>
          <ul className="space-y-1.5">
            {prep.companyResearchTips.map((tip, i) => (
              <li key={i} className="flex items-start gap-2 text-xs text-gray-600">
                <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 flex-shrink-0 mt-1.5" />
                {tip}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Keywords to mention */}
      {prep.keywordsToMention?.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Keywords to Use</p>
          <div className="flex flex-wrap gap-1.5">
            {prep.keywordsToMention.map((kw, i) => (
              <span key={i} className="text-[11px] font-medium px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full">
                {kw}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Questions to ask */}
      {prep.questionsToAsk?.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2 flex items-center gap-1.5">
            <HelpCircle className="w-3.5 h-3.5 text-violet-500" /> Questions to Ask Them
          </p>
          <ul className="space-y-1.5">
            {prep.questionsToAsk.map((q, i) => (
              <li key={i} className="text-xs text-gray-600 bg-violet-50 rounded-lg px-3 py-2 border border-violet-100 italic">
                "{q}"
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

// ── Email status badge ────────────────────────────────────────────
function StatusBadge({ status }) {
  if (status === 'verified') return (
    <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700">
      <ShieldCheck className="w-3 h-3" /> Verified
    </span>
  );
  if (status === 'predicted') return (
    <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700">
      <HelpCircle className="w-3 h-3" /> Predicted
    </span>
  );
  if (status === 'invalid') return (
    <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-red-100 text-red-600">
      <AlertCircle className="w-3 h-3" /> Invalid
    </span>
  );
  return null;
}

// ── Contacts section (HR emails or Employees) ─────────────────────
function ContactsSection({ title, icon: Icon, iconColor, items, emptyText, onOutreach }) {
  const [copied, setCopied] = useState('');

  const copy = async (email) => {
    await navigator.clipboard.writeText(email);
    setCopied(email);
    setTimeout(() => setCopied(''), 2000);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-1.5">
          <Icon className={`w-3.5 h-3.5 ${iconColor}`} />
          {title} {items.length > 0 && <span className="text-gray-400 font-normal">({items.length})</span>}
        </p>
        {items.length > 0 && onOutreach && (
          <button
            onClick={() => onOutreach(items.filter(i => i.email))}
            className="text-[10px] text-blue-600 font-semibold hover:underline flex items-center gap-0.5"
          >
            Outreach all <Send className="w-3 h-3" />
          </button>
        )}
      </div>

      {items.length === 0 ? (
        <p className="text-xs text-gray-400 italic py-2">{emptyText}</p>
      ) : (
        <div className="space-y-2">
          {items.map((item, i) => (
            <div key={i} className="flex items-start gap-2.5 p-2.5 bg-gray-50 rounded-xl border border-gray-100">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-100 to-indigo-100 flex items-center justify-center text-blue-700 font-bold text-xs flex-shrink-0">
                {item.name?.[0]?.toUpperCase() || '?'}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-900 truncate">{item.name || 'Contact'}</p>
                {item.title && <p className="text-xs text-gray-400 truncate">{item.title}</p>}
                {item.email ? (
                  <p className="text-xs text-blue-600 font-mono truncate mt-0.5">{item.email}</p>
                ) : (
                  <p className="text-xs text-gray-300 italic">No email</p>
                )}
                <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                  <StatusBadge status={item.status} />
                  {item.confidence > 0 && (
                    <span className="text-[10px] text-gray-400">{item.confidence}%</span>
                  )}
                  {item.source && (
                    <span className="text-[10px] text-gray-400 capitalize">{item.source}</span>
                  )}
                </div>
              </div>
              <div className="flex flex-col gap-1 flex-shrink-0">
                {item.email && (
                  <button
                    onClick={() => copy(item.email)}
                    className="p-1.5 rounded-lg bg-white border border-gray-200 hover:border-blue-300 text-gray-400 hover:text-blue-600 transition-colors"
                    title="Copy email"
                  >
                    {copied === item.email
                      ? <Check className="w-3.5 h-3.5 text-emerald-500" />
                      : <Copy className="w-3.5 h-3.5" />}
                  </button>
                )}
                {item.linkedin && (
                  <a
                    href={item.linkedin}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-1.5 rounded-lg bg-white border border-gray-200 hover:border-blue-300 text-gray-400 hover:text-blue-600 transition-colors"
                    title="LinkedIn"
                  >
                    <Linkedin className="w-3.5 h-3.5" />
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
