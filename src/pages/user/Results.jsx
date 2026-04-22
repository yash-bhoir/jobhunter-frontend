import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  MapPin, Bookmark, BookmarkCheck,
  Search, Download, Building, Wifi, Star, Mail, Send,
  Loader2, ChevronLeft, ChevronRight, Clock,
  RefreshCw, X, SlidersHorizontal,
  Sparkles, Lock, Zap, Linkedin, Inbox
} from 'lucide-react';
import { api }  from '@utils/axios';
import { logJobRankingEvent } from '@utils/rankingFeedback';
import { cn }   from '@utils/helpers';
import { JOB_STATUS_BADGE_VARIANT, JOB_STATUS_LABELS } from '@utils/constants';
import { Badge } from '@components/ui';
import { useToast } from '@hooks/useToast';
import { useAuth }  from '@hooks/useAuth';
import JobDetailPanel, { SourceBadge, getPlatformMeta } from '../../components/jobs/JobDetailPanel';

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

const LockedJobCard = () => (
  <div className="relative overflow-hidden rounded-2xl border-2 border-dashed border-gray-200 bg-gray-50/60 p-4 select-none">
    <div className="blur-sm pointer-events-none opacity-60">
      <div className="flex items-start gap-3">
        <div className="w-11 h-11 rounded-xl flex-shrink-0 bg-gray-300" />
        <div className="flex-1 space-y-2">
          <div className="h-4 bg-gray-200 rounded-lg w-3/5" />
          <div className="h-3 bg-gray-200 rounded-lg w-2/5" />
          <div className="h-3 bg-gray-200 rounded-lg w-1/3" />
        </div>
        <div className="w-12 h-6 bg-gray-200 rounded-full" />
      </div>
    </div>
    <div className="absolute inset-0 flex items-center justify-center">
      <div className="flex items-center gap-2 bg-white/90 backdrop-blur-sm border border-gray-200 rounded-xl px-3 py-2 shadow-sm">
        <Lock className="w-3.5 h-3.5 text-gray-500" />
        <span className="text-xs font-semibold text-gray-600">Pro only</span>
      </div>
    </div>
  </div>
);

const listVariants = { hidden: {}, show: { transition: { staggerChildren: 0.04 } } };
const cardVariant  = { hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0, transition: { duration: 0.25, ease: 'easeOut' } } };

export default function Results() {
  const toast    = useToast();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const searchId = searchParams.get('searchId');

  const [jobs,          setJobs]          = useState([]);
  const [allSources,    setAllSources]    = useState([]);
  const [platformBreak, setPlatformBreak] = useState({});
  const [loading,       setLoading]       = useState(true);
  const [selected,      setSelected]      = useState(null);
  const [filter,        setFilter]        = useState({ status: '', source: '', remote: '' });
  const [sort,          setSort]          = useState('matchScore');
  const [search,        setSearch]        = useState('');
  const [page,          setPage]          = useState(1);
  const [total,         setTotal]         = useState(0);
  const [searchMeta,    setSearchMeta]    = useState(null);
  const [outreachLoading, setOutreachLoading] = useState(false);
  const [showFilters,   setShowFilters]   = useState(false);
  const [sourceTab,     setSourceTab]     = useState('search'); // 'search' | 'linkedin' | 'email' | 'map'
  const [tabCounts,     setTabCounts]     = useState({ search: 0, linkedin: 0, email: 0, map: 0 });

  useEffect(() => {
    if (!searchId) return;
    api.get(`/search/${searchId}`).then(({ data }) => {
      const meta = data.data;
      setSearchMeta(meta);
      const pb = meta?.platformBreakdown;
      if (pb && typeof pb === 'object') {
        const obj = pb instanceof Map ? Object.fromEntries(pb) : { ...pb };
        setPlatformBreak(obj);
        setAllSources((prev) => [...new Set([...prev, ...Object.keys(obj).filter(Boolean)])].sort());
      }
    }).catch(() => {});
  }, [searchId]);

  // Fetch counts for all tabs on mount (for badges)
  useEffect(() => {
    Promise.all([
      api.get('/jobs?limit=1&excludeSource=map-search').then(r => r.data.pagination?.total || 0).catch(() => 0),
      api.get('/linkedin/jobs?limit=1&sourceType=linkedin').then(r => r.data.pagination?.total || 0).catch(() => 0),
      api.get('/linkedin/gmail/jobs?limit=1').then(r => r.data.pagination?.total || 0).catch(() => 0),
      api.get('/jobs?limit=1&source=map-search').then(r => r.data.pagination?.total || 0).catch(() => 0),
    ]).then(([search, linkedin, email, map]) => setTabCounts({ search, linkedin, email, map }));
  }, []);

  const fetchJobs = async () => {
    setLoading(true);
    try {
      if (sourceTab === 'linkedin') {
        const params = new URLSearchParams({ page, limit: 20, sourceType: 'linkedin' });
        if (filter.status) params.set('status', filter.status);
        const { data } = await api.get(`/linkedin/jobs?${params}`);
        setJobs(data.data || []);
        setTotal(data.pagination?.total || 0);
      } else if (sourceTab === 'email') {
        const params = new URLSearchParams({ page, limit: 20 });
        if (filter.status) params.set('status', filter.status);
        const { data } = await api.get(`/linkedin/gmail/jobs?${params}`);
        setJobs(data.data || []);
        setTotal(data.pagination?.total || 0);
      } else {
        let data;
        if (sourceTab === 'search' && searchId) {
          const params = new URLSearchParams({
            page: String(page),
            limit: '20',
            sort,
            ...(filter.status && { status: filter.status }),
            ...(filter.source && { source: filter.source }),
            ...(filter.remote && { remote: filter.remote }),
          });
          ({ data } = await api.get(`/search/${searchId}/jobs?${params}`));
        } else {
          const params = new URLSearchParams({
            page, limit: 20, sort,
            ...(sourceTab === 'map'
              ? { source: 'map-search' }
              : { excludeSource: 'map-search' }),
            ...(filter.status && { status: filter.status }),
            ...(sourceTab === 'search' && filter.source && { source: filter.source }),
            ...(filter.remote && { remote: filter.remote }),
          });
          ({ data } = await api.get(`/jobs?${params}`));
        }

        const loadedJobs = data.data || [];
        setJobs(loadedJobs);
        setTotal(data.pagination?.total || 0);
        if (sourceTab === 'search') {
          if (data.pagination?.platformBreakdown) {
            const pb = data.pagination.platformBreakdown;
            setPlatformBreak(pb);
            setAllSources((prev) => [...new Set([...prev, ...Object.keys(pb).filter(Boolean)])].sort());
          } else if (!filter.source && !searchId) {
            setAllSources((prev) => [...new Set([...prev, ...loadedJobs.map((j) => j.source).filter(Boolean)])].sort());
          }
        }
      }
    } catch { toast.error('Failed to load jobs'); }
    finally  { setLoading(false); }
  };

  useEffect(() => { fetchJobs(); }, [page, sort, filter, sourceTab, searchId]);

  const switchTab = (tab) => {
    setSourceTab(tab);
    setPage(1);
    setSelected(null);
    setSearch('');
    setFilter({ status: '', source: '', remote: '' });
  };

  const saveJob = async (job) => {
    try {
      await api.post(job.status === 'saved' ? `/jobs/${job._id}/unsave` : `/jobs/${job._id}/save`);
      const ns = job.status === 'saved' ? 'found' : 'saved';
      logJobRankingEvent(job._id, ns === 'saved' ? 'save' : 'unsave', { source: 'results_list' });
      setJobs(prev => prev.map(j => j._id === job._id ? { ...j, status: ns } : j));
      if (selected?._id === job._id) setSelected(prev => ({ ...prev, status: ns }));
    } catch { toast.error('Failed'); }
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

  const filtered      = jobs.filter(j => !search || j.title?.toLowerCase().includes(search.toLowerCase()) || j.company?.toLowerCase().includes(search.toLowerCase()));
  const jobsWithEmail = jobs.filter(j => j.recruiterEmail).length;
  const isPro         = user?.plan === 'pro' || user?.plan === 'team';

  return (
    <div className="flex gap-5 max-w-7xl mx-auto relative min-h-0">

      {/* ── Left — job list ─────────────────────────────────────── */}
      <div className="flex-1 min-w-0 space-y-4">

        {/* Header */}
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold text-gray-900">Job Results</h1>
            <p className="text-gray-400 text-sm mt-0.5">
              {loading ? '…' : total} jobs
              {jobsWithEmail > 0 && ` · ${jobsWithEmail} HR emails`}
              {sourceTab === 'search' && !filter.source && Object.keys(platformBreak).length > 0 && ` · ${Object.keys(platformBreak).length} platforms`}
            </p>
          </div>
          <div className="flex gap-2">
            {sourceTab === 'search' && searchId && (
              <button onClick={() => navigate('/results')} className="btn btn-secondary btn-sm">
                <RefreshCw className="w-3.5 h-3.5" /> All
              </button>
            )}
            <button onClick={() => setShowFilters(v => !v)} className={cn('btn btn-sm', showFilters ? 'btn-primary' : 'btn-secondary')}>
              <SlidersHorizontal className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Filters</span>
            </button>
            {(sourceTab === 'search') && (
              <button onClick={exportExcel} className="btn btn-secondary btn-sm">
                <Download className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Export</span>
              </button>
            )}
          </div>
        </div>

        {/* ── Source tabs ──────────────────────────────────────────── */}
        <div className="flex gap-1 bg-gray-100 rounded-xl p-1 overflow-x-auto">
          {[
            { id: 'search',   label: 'Job Search',  icon: Search,   count: tabCounts.search   },
            { id: 'linkedin', label: 'LinkedIn',    icon: Linkedin, count: tabCounts.linkedin  },
            { id: 'email',    label: 'Email Jobs',  icon: Inbox,    count: tabCounts.email     },
            { id: 'map',      label: 'Map Saves',   icon: MapPin,   count: tabCounts.map       },
          ].map(({ id, label, icon: Icon, count }) => (
            <button
              key={id}
              onClick={() => switchTab(id)}
              className={cn(
                'flex-1 flex items-center justify-center gap-1.5 py-2 px-2 sm:px-3 rounded-lg text-xs font-semibold transition-all whitespace-nowrap',
                sourceTab === id
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              )}
            >
              <Icon className="w-3.5 h-3.5 flex-shrink-0" />
              <span className="hidden sm:inline">{label}</span>
              <span className="sm:hidden">{id === 'search' ? 'Search' : id === 'linkedin' ? 'LI' : id === 'email' ? 'Email' : 'Map'}</span>
              {count > 0 && (
                <span className={cn(
                  'px-1.5 py-0.5 rounded-full text-[10px] font-bold',
                  sourceTab === id ? 'bg-blue-100 text-blue-700' : 'bg-gray-200 text-gray-500'
                )}>{count}</span>
              )}
            </button>
          ))}
        </div>

        {/* Platform quick-filter chips (search tab only) */}
        {sourceTab === 'search' && !loading && Object.keys(platformBreak).length > 1 && (
          <div className="flex items-center gap-1.5 flex-wrap">
            {Object.entries(platformBreak)
              .sort((a, b) => b[1] - a[1])
              .slice(0, 8)
              .map(([src, count]) => {
                const isActive = filter.source === src;
                const meta = getPlatformMeta(src);
                return (
                  <button
                    key={src}
                    onClick={() => setFilter(p => ({ ...p, source: isActive ? '' : src }))}
                    className={cn(
                      'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border transition-all',
                      isActive ? meta.cls + ' ring-2 ring-offset-1 ring-current' : 'bg-white text-gray-500 border-gray-200 hover:border-gray-300'
                    )}
                  >
                    {meta.label}
                    <span className={cn('px-1 rounded-full text-[9px]', isActive ? 'bg-white/40' : 'bg-gray-100')}>{count}</span>
                  </button>
                );
              })}
          </div>
        )}

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
            <div className="relative flex items-center justify-between gap-3 flex-wrap">
              <div className="min-w-0">
                <p className="font-bold flex items-center gap-2 text-sm sm:text-base">
                  <Sparkles className="w-4 h-4 flex-shrink-0" />
                  {jobsWithEmail} HR emails ready
                </p>
                <p className="text-blue-100 text-xs sm:text-sm mt-0.5">AI-powered emails · 7 credits each</p>
              </div>
              <button
                onClick={handleManageOutreach}
                disabled={outreachLoading}
                className="btn bg-white text-blue-700 hover:bg-blue-50 flex-shrink-0 font-bold text-sm"
              >
                {outreachLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                Outreach
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
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <select value={filter.status} onChange={e => setFilter(p => ({ ...p, status: e.target.value }))} className="input text-sm">
                    <option value="">All Status</option>
                    {STATUSES.map(s => <option key={s} value={s}>{JOB_STATUS_LABELS[s]}</option>)}
                  </select>
                  <select value={filter.source} onChange={e => setFilter(p => ({ ...p, source: e.target.value }))} className="input text-sm">
                    <option value="">All Platforms</option>
                    {allSources.map(s => <option key={s} value={s}>{getPlatformMeta(s).label}</option>)}
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
                {(filter.status || filter.source || filter.remote) && (
                  <div className="flex items-center gap-2 flex-wrap pt-1">
                    <span className="text-xs text-gray-400">Active:</span>
                    {filter.source && (
                      <button onClick={() => setFilter(p => ({ ...p, source: '' }))}
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-blue-100 text-blue-700 hover:bg-blue-200 transition-colors">
                        {getPlatformMeta(filter.source).label} <X className="w-3 h-3" />
                      </button>
                    )}
                    {filter.status && (
                      <button onClick={() => setFilter(p => ({ ...p, status: '' }))}
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors">
                        {JOB_STATUS_LABELS[filter.status]} <X className="w-3 h-3" />
                      </button>
                    )}
                    {filter.remote && (
                      <button onClick={() => setFilter(p => ({ ...p, remote: '' }))}
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors">
                        {filter.remote === 'true' ? 'Remote' : 'On-site'} <X className="w-3 h-3" />
                      </button>
                    )}
                    <button onClick={() => setFilter({ status: '', source: '', remote: '' })}
                      className="text-xs text-red-400 hover:text-red-600 transition-colors ml-1">Clear all</button>
                  </div>
                )}
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
          <motion.div variants={listVariants} initial="hidden" animate="show" className="space-y-2.5">
            {filtered.map((job, idx) => {
              const isLocked = !isPro && idx >= FREE_JOB_LIMIT;
              if (isLocked) return <motion.div key={job._id} variants={cardVariant}><LockedJobCard /></motion.div>;

              return (
                <motion.div
                  key={job._id}
                  variants={cardVariant}
                  onClick={() => setSelected(job)}
                  className={cn(
                    'group bg-white rounded-2xl border-2 p-4 cursor-pointer transition-all duration-200',
                    'hover:shadow-md hover:-translate-y-0.5',
                    selected?._id === job._id
                      ? 'border-blue-400 shadow-md bg-blue-50/20'
                      : 'border-gray-100 hover:border-blue-200'
                  )}
                >
                  <div className="flex items-start gap-3">
                    <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 text-white font-black text-base shadow-sm"
                      style={{ background: `hsl(${(job.company?.charCodeAt(0) || 65) * 5 % 360}, 65%, 55%)` }}>
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
                        {job.remote && (
                          <Badge variant="green">
                            <Wifi className="h-3 w-3 shrink-0" aria-hidden /> Remote
                          </Badge>
                        )}
                        {job.recruiterEmail && (
                          <Badge variant="blue">
                            <Mail className="h-3 w-3 shrink-0" aria-hidden /> HR Email
                          </Badge>
                        )}
                        <Badge variant={JOB_STATUS_BADGE_VARIANT[job.status] || 'gray'}>
                          {JOB_STATUS_LABELS[job.status]}
                        </Badge>
                        {job.liveness === 'expired' && (
                          <Badge variant="critical" size="sm">
                            Possibly Closed
                          </Badge>
                        )}
                        {job.liveness === 'uncertain' && (
                          <Badge variant="warning" size="sm">
                            Unverified
                          </Badge>
                        )}
                        {job.followUpDate && new Date(job.followUpDate) <= new Date() && (
                          <Badge variant="violet" size="sm">
                            Follow Up Due
                          </Badge>
                        )}
                        {job.salary && job.salary !== 'Not specified' && (
                          <span className="text-xs text-gray-400 font-medium">{job.salary}</span>
                        )}
                        <SourceBadge source={job.source} className="ml-auto" />
                      </div>
                    </div>
                  </div>
                </motion.div>
              );
            })}

            {/* Free plan paywall */}
            {!isPro && filtered.length > FREE_JOB_LIMIT && (
              <motion.div variants={cardVariant}
                className="rounded-2xl border-2 border-blue-200 bg-gradient-to-br from-blue-50 to-violet-50 p-6 text-center">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center mx-auto mb-3 shadow-lg">
                  <Zap className="w-6 h-6 text-white" />
                </div>
                <h3 className="font-bold text-gray-900 mb-1">{filtered.length - FREE_JOB_LIMIT} more jobs locked</h3>
                <p className="text-sm text-gray-500 mb-4">
                  Upgrade to Pro to unlock all {filtered.length} jobs, HR emails, deep evaluation &amp; more
                </p>
                <a href="/settings?tab=billing"
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-violet-600 text-white font-bold text-sm shadow-md hover:shadow-lg hover:scale-105 transition-all duration-200">
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

      {/* ── Job detail — overlay slide-in from right ─────────────── */}
      <AnimatePresence>
        {selected && (
          <>
            <motion.div
              key="backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
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
                mode={sourceTab === 'linkedin' || sourceTab === 'email' ? 'linkedin' : 'results'}
                onClose={() => setSelected(null)}
                onJobUpdate={(patch) => {
                  if (patch._deleted) { setSelected(null); if (sourceTab === 'linkedin' || sourceTab === 'email') fetchJobs(); return; }
                  setJobs(prev => prev.map(j => j._id === selected._id ? { ...j, ...patch } : j));
                  setSelected(prev => prev ? { ...prev, ...patch } : prev);
                }}
              />
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
