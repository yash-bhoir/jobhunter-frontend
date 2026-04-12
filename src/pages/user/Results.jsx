import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Briefcase, MapPin, ExternalLink, Bookmark, BookmarkCheck,
  Search, Download, Building, Wifi, Star, Mail, Send,
  Loader2, ChevronLeft, ChevronRight, Users, Clock,
  RefreshCw, CheckCircle2, X, Filter, SlidersHorizontal,
  Sparkles, Target, TrendingUp, ArrowUpRight
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

  useEffect(() => {
    if (!searchId) return;
    api.get(`/search/${searchId}`).then(({ data }) => setSearchMeta(data.data)).catch(() => {});
  }, [searchId]);

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
        const patch = { recruiterEmail: top.email, recruiterName: top.name || null, recruiterConfidence: top.confidence || null };
        setJobs(prev => prev.map(j => j._id === jobId ? { ...j, ...patch } : j));
        setSelected(prev => prev?._id === jobId ? { ...prev, ...patch } : prev);
      }
    } catch (err) {
      const msg = err.response?.data?.message || 'Lookup failed';
      setHrLookup(p => ({ ...p, [jobId]: { loading: false, error: msg } }));
      toast.error(msg);
    }
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
    <div className="flex gap-5 h-full max-w-7xl mx-auto">

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
                <div className="grid grid-cols-3 gap-2">
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
            {filtered.map(job => (
              <motion.div
                key={job._id}
                variants={cardVariant}
                onClick={() => { setSelected(job); setActiveTab('details'); }}
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
                      {job.salary && job.salary !== 'Not specified' && (
                        <span className="text-xs text-gray-400 font-medium">{job.salary}</span>
                      )}
                      <span className="text-xs text-gray-300 ml-auto">{job.source}</span>
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
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
      <AnimatePresence>
        {selected && (
          <motion.div
            initial={{ opacity: 0, x: 24 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 24 }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
            className="w-[380px] flex-shrink-0 hidden lg:block"
          >
            <div className="bg-white rounded-3xl border border-gray-100 sticky top-4 overflow-hidden"
              style={{ maxHeight: 'calc(100vh - 5rem)', display: 'flex', flexDirection: 'column', boxShadow: '0 8px 32px -4px rgba(0,0,0,0.1)' }}
            >
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
              <div className="flex border-b border-gray-100 flex-shrink-0 px-1">
                {['details', 'hr', 'status', 'ai'].map(tab => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={cn(
                      'flex-1 py-3 text-xs font-semibold capitalize transition-colors border-b-2',
                      activeTab === tab
                        ? 'border-blue-600 text-blue-700'
                        : 'border-transparent text-gray-400 hover:text-gray-600'
                    )}
                  >
                    {tab === 'hr' ? 'HR Email' : tab === 'ai' ? 'AI Tools' : tab}
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
                    <a
                      href={selected.applyUrl || selected.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn btn-primary w-full justify-center"
                    >
                      <ArrowUpRight className="w-4 h-4" /> Apply Now
                    </a>
                  </motion.div>
                )}

                {activeTab === 'hr' && (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
                    {selected.recruiterEmail ? (
                      <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl">
                        <p className="text-xs font-semibold text-emerald-700 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                          <CheckCircle2 className="w-3.5 h-3.5" /> HR Contact Found
                        </p>
                        <p className="font-bold text-gray-900">{selected.recruiterName || 'HR Contact'}</p>
                        <p className="text-sm text-gray-600 mt-0.5">{selected.recruiterEmail}</p>
                        {selected.recruiterConfidence && (
                          <div className="mt-2 flex items-center gap-2">
                            <div className="h-1.5 flex-1 bg-emerald-200 rounded-full overflow-hidden">
                              <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${selected.recruiterConfidence}%` }} />
                            </div>
                            <span className="text-xs text-emerald-600 font-semibold">{selected.recruiterConfidence}% confidence</span>
                          </div>
                        )}
                        <a
                          href={`mailto:${selected.recruiterEmail}`}
                          className="btn btn-success btn-sm mt-3 w-full justify-center"
                        >
                          <Mail className="w-3.5 h-3.5" /> Email HR
                        </a>
                      </div>
                    ) : (
                      <div className="text-center py-4">
                        <div className="w-12 h-12 rounded-2xl bg-gray-100 flex items-center justify-center mx-auto mb-3">
                          <Users className="w-6 h-6 text-gray-300" />
                        </div>
                        <p className="text-sm font-semibold text-gray-700 mb-1">No HR email yet</p>
                        <p className="text-xs text-gray-400 mb-4">Find the hiring manager's contact</p>
                        {isPro ? (
                          <button
                            onClick={() => findHRContact(selected)}
                            disabled={hrLookup[selected._id]?.loading}
                            className="btn btn-primary btn-sm w-full justify-center"
                          >
                            {hrLookup[selected._id]?.loading
                              ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Looking up...</>
                              : <><Search className="w-3.5 h-3.5" /> Find HR Contact</>}
                          </button>
                        ) : (
                          <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-700">
                            Upgrade to Pro to manually lookup HR emails
                            <Link to="/billing" className="block font-semibold mt-1 hover:underline">Upgrade Now →</Link>
                          </div>
                        )}
                        {hrLookup[selected._id]?.error && (
                          <p className="text-xs text-red-500 mt-2">{hrLookup[selected._id].error}</p>
                        )}
                      </div>
                    )}
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
                      <CompanyResearch job={selected} />
                    </div>
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
