import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Briefcase, MapPin, ExternalLink, Bookmark, BookmarkCheck,
  Search, Download, Building, Wifi, Star, Mail, Send,
  Loader2, ChevronLeft, ChevronRight, Users, Clock, RefreshCw,
  SearchCheck, CheckCircle2
} from 'lucide-react';
import { api }  from '@utils/axios';
import { cn }   from '@utils/helpers';
import { truncate } from '@utils/formatters';
import { JOB_STATUS_STYLES, JOB_STATUS_LABELS } from '@utils/constants';
import { useToast } from '@hooks/useToast';
import { useAuth }  from '@hooks/useAuth';
import MatchExplainer from '../../components/jobs/MatchExplainer'
import CompanyResearch  from '../../components/jobs/CompanyResearch'


const STATUSES  = ['found', 'saved', 'applied', 'interview', 'offer', 'rejected'];
const SORT_OPTS = [
  { value: 'matchScore', label: 'Match Score' },
  { value: 'date',       label: 'Date'        },
];

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
  const [autoOutreachLoading, setAutoOutreachLoading] = useState(false);
  const [hrLookup,   setHrLookup]   = useState({}); // jobId -> { loading, result, error }

  // Load search metadata when viewing a specific past search
  useEffect(() => {
    if (!searchId) return;
    api.get(`/search/${searchId}`)
      .then(({ data }) => setSearchMeta(data.data))
      .catch(() => {});
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
    } catch {
      toast.error('Failed to load jobs');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchJobs(); }, [page, sort, filter]);

  const updateStatus = async (jobId, status) => {
    try {
      await api.patch(`/jobs/${jobId}/status`, { status });
      setJobs(prev => prev.map(j => j._id === jobId ? { ...j, status } : j));
      if (selected?._id === jobId) setSelected(prev => ({ ...prev, status }));
      toast.success(`Marked as ${status}`);
    } catch {
      toast.error('Failed to update status');
    }
  };

  const saveJob = async (job) => {
    try {
      const endpoint = job.status === 'saved'
        ? `/jobs/${job._id}/unsave`
        : `/jobs/${job._id}/save`;
      await api.post(endpoint);
      const newStatus = job.status === 'saved' ? 'found' : 'saved';
      setJobs(prev => prev.map(j => j._id === job._id ? { ...j, status: newStatus } : j));
      if (selected?._id === job._id) setSelected(prev => ({ ...prev, status: newStatus }));
    } catch {
      toast.error('Failed to save job');
    }
  };

  const findHRContact = async (job) => {
    const jobId = job._id;
    setHrLookup(p => ({ ...p, [jobId]: { loading: true, result: null, error: null } }));
    try {
      const { data } = await api.post('/recruiters/lookup', {
        company: job.company,
        jobId,
      });
      const result = data.data;
      setHrLookup(p => ({ ...p, [jobId]: { loading: false, result, error: null } }));

      // If a top email was found, update the job in state so the green block shows
      const top = result.emails?.[0];
      if (top?.email) {
        const patch = {
          recruiterEmail:      top.email,
          recruiterName:       top.name       || null,
          recruiterConfidence: top.confidence || null,
          recruiterSource:     result.source  || 'hunter',
          careerPageUrl:       result.careerPageUrl || null,
        };
        setJobs(prev => prev.map(j => j._id === jobId ? { ...j, ...patch } : j));
        setSelected(prev => prev?._id === jobId ? { ...prev, ...patch } : prev);
      }
    } catch (err) {
      const msg = err.response?.data?.message || 'Lookup failed';
      setHrLookup(p => ({ ...p, [jobId]: { loading: false, result: null, error: msg } }));
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
      document.body.appendChild(link);
      link.click();
      link.remove();
      toast.success('Excel downloaded!');
    } catch {
      toast.error('Export failed');
    }
  };

  const handleManageOutreach = async () => {
    setAutoOutreachLoading(true);
    try {
      const { data } = await api.get('/search/history?limit=1');
      const searchId = data.data?.[0]?._id;
      if (searchId) {
        navigate(`/outreach-manager?searchId=${searchId}`);
      } else {
        toast.error('No recent search found. Run a search first.');
      }
    } catch {
      toast.error('Failed to load search history');
    } finally {
      setAutoOutreachLoading(false);
    }
  };

  const filtered = jobs.filter(j =>
    !search ||
    j.title?.toLowerCase().includes(search.toLowerCase()) ||
    j.company?.toLowerCase().includes(search.toLowerCase())
  );

  const jobsWithEmail = jobs.filter(j => j.recruiterEmail).length;
  const isPro = user?.plan === 'pro' || user?.plan === 'team';

  return (
    <div className="flex gap-6 h-full max-w-7xl mx-auto">

      {/* ── Left — job list ───────────────────────────────────── */}
      <div className="flex-1 min-w-0 space-y-4">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Job Results</h1>
            <p className="text-gray-500 text-sm mt-0.5">
              {total} jobs · {jobsWithEmail} HR emails found
            </p>
          </div>
          <div className="flex gap-2">
            {searchId && (
              <button
                onClick={() => navigate('/results')}
                className="btn btn-secondary btn-sm"
              >
                <RefreshCw className="w-4 h-4" /> All Jobs
              </button>
            )}
            <button onClick={exportExcel} className="btn btn-secondary btn-sm">
              <Download className="w-4 h-4" /> Export Excel
            </button>
          </div>
        </div>

        {/* Past search context banner */}
        {searchId && searchMeta && (
          <div className="card card-body bg-amber-50 border-amber-200 py-3">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-amber-600 flex-shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-amber-800">
                    Viewing past search — "{searchMeta.query?.role}"
                  </p>
                  <p className="text-xs text-amber-600 mt-0.5">
                    {searchMeta.query?.location && `${searchMeta.query.location} · `}
                    Searched on {new Date(searchMeta.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                    {' · '}{searchMeta.totalFound} jobs found
                  </p>
                </div>
              </div>
              <button
                onClick={() => navigate('/search')}
                className="btn btn-sm bg-amber-500 text-white hover:bg-amber-600 flex-shrink-0"
              >
                New Search
              </button>
            </div>
          </div>
        )}

        {/* Pro — Outreach Manager banner */}
        {isPro && jobsWithEmail > 0 && (
          <div className="card card-body bg-gradient-to-r from-blue-600 to-indigo-600 text-white">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="font-semibold">
                  🚀 {jobsWithEmail} HR emails found — ready for outreach
                </p>
                <p className="text-blue-100 text-sm mt-0.5">
                  View all contacts, generate AI emails and send in bulk
                  <span className="ml-2 bg-white/20 px-2 py-0.5 rounded text-xs">
                    7 credits/email
                  </span>
                </p>
              </div>
              <button
                onClick={handleManageOutreach}
                disabled={autoOutreachLoading}
                className="btn bg-white text-blue-600 hover:bg-blue-50 flex-shrink-0"
              >
                {autoOutreachLoading
                  ? <><Loader2 className="w-4 h-4 animate-spin" /> Loading...</>
                  : <><Users className="w-4 h-4" /> Manage Outreach</>
                }
              </button>
            </div>
          </div>
        )}

        {/* Free user — upgrade hint */}
        {!isPro && jobsWithEmail > 0 && (
          <div className="card card-body bg-amber-50 border-amber-200">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm text-amber-800">
                <strong>💡 {jobsWithEmail} HR emails auto-found.</strong>{' '}
                Upgrade to Pro to send AI outreach emails to all recruiters in one click.
              </p>
              <a href="/billing" className="btn btn-sm bg-amber-500 text-white hover:bg-amber-600 flex-shrink-0">
                Upgrade
              </a>
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="card card-body py-3">
          <div className="flex flex-wrap gap-3">
            <div className="relative flex-1 min-w-48">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search by title or company..."
                className="input pl-9 py-2 text-sm"
              />
            </div>
            <select
              value={filter.status}
              onChange={e => setFilter(p => ({ ...p, status: e.target.value }))}
              className="input py-2 text-sm w-36"
            >
              <option value="">All Status</option>
              {STATUSES.map(s => (
                <option key={s} value={s}>{JOB_STATUS_LABELS[s]}</option>
              ))}
            </select>
            <select
              value={filter.remote}
              onChange={e => setFilter(p => ({ ...p, remote: e.target.value }))}
              className="input py-2 text-sm w-32"
            >
              <option value="">All Types</option>
              <option value="true">Remote</option>
              <option value="false">On-site</option>
            </select>
            <select
              value={sort}
              onChange={e => setSort(e.target.value)}
              className="input py-2 text-sm w-36"
            >
              {SORT_OPTS.map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Jobs list */}
        {loading ? (
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="card card-body">
                <div className="skeleton h-4 w-2/3 mb-2" />
                <div className="skeleton h-3 w-1/3 mb-3" />
                <div className="skeleton h-3 w-full" />
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="card card-body text-center py-12">
            <Search className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500 font-medium">No jobs found</p>
            <p className="text-gray-400 text-sm mt-1">Run a search to see results here</p>
            <a href="/search" className="btn btn-primary btn-sm mt-4 inline-flex">
              Search Jobs
            </a>
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map(job => (
              <div
                key={job._id}
                onClick={() => setSelected(job)}
                className={cn(
                  'card card-body cursor-pointer hover:border-blue-300 hover:shadow-md transition-all',
                  selected?._id === job._id ? 'border-blue-400 shadow-md bg-blue-50/30' : ''
                )}
              >
                <div className="flex items-start gap-3">

                  {/* Company avatar */}
                  <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0 text-gray-500 font-bold text-sm">
                    {job.company?.[0]?.toUpperCase() || '?'}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <h3 className="font-semibold text-gray-900 text-sm truncate">{job.title}</h3>
                        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                          <span className="text-xs text-gray-600 flex items-center gap-1">
                            <Building className="w-3 h-3" /> {job.company}
                          </span>
                          {job.location && (
                            <span className="text-xs text-gray-500 flex items-center gap-1">
                              <MapPin className="w-3 h-3" /> {job.location}
                            </span>
                          )}
                          {job.remote && (
                            <span className="badge badge-green text-xs">
                              <Wifi className="w-3 h-3 mr-1" /> Remote
                            </span>
                          )}
                          {job.recruiterEmail && (
                            <span className="badge badge-blue text-xs flex items-center gap-1">
                              <Mail className="w-3 h-3" /> HR Email
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 flex-shrink-0">
                        <div className={cn(
                          'flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold',
                          job.matchScore >= 75 ? 'bg-green-100 text-green-800' :
                          job.matchScore >= 50 ? 'bg-amber-100 text-amber-800' :
                                                 'bg-gray-100 text-gray-600'
                        )}>
                          <Star className="w-3 h-3" />
                          {job.matchScore}%
                        </div>
                        <button
                          onClick={e => { e.stopPropagation(); saveJob(job); }}
                          className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
                        >
                          {job.status === 'saved'
                            ? <BookmarkCheck className="w-4 h-4 text-blue-600" />
                            : <Bookmark className="w-4 h-4 text-gray-400" />
                          }
                        </button>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 mt-2 flex-wrap">
                      <span className="text-xs text-gray-500">{job.source}</span>
                      {job.salary && job.salary !== 'Not specified' && (
                        <span className="text-xs text-gray-500">· {job.salary}</span>
                      )}
                      <span className={cn('badge text-xs', JOB_STATUS_STYLES[job.status])}>
                        {JOB_STATUS_LABELS[job.status]}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Pagination */}
        {total > 20 && (
          <div className="flex items-center justify-center gap-2">
            <button
              disabled={page === 1}
              onClick={() => setPage(p => p - 1)}
              className="btn btn-secondary btn-sm"
            >
              <ChevronLeft className="w-4 h-4" /> Previous
            </button>
            <span className="text-sm text-gray-600">
              Page {page} of {Math.ceil(total / 20)}
            </span>
            <button
              disabled={page * 20 >= total}
              onClick={() => setPage(p => p + 1)}
              className="btn btn-secondary btn-sm"
            >
              Next <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>

      {/* ── Right — job detail drawer ─────────────────────────── */}
      {selected && (
        <div className="w-96 flex-shrink-0">
          <div className="card sticky top-0 overflow-y-auto" style={{ maxHeight: 'calc(100vh - 2rem)' }}>
            <div className="card-header flex items-center justify-between">
              <h3 className="font-semibold text-gray-900 text-sm">Job Details</h3>
              <button
                onClick={() => setSelected(null)}
                className="w-6 h-6 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
              >
                ×
              </button>
            </div>

            <div className="p-4 space-y-4">

              {/* Title */}
              <div>
                <h2 className="font-bold text-gray-900 text-lg leading-tight">{selected.title}</h2>
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  <span className="text-gray-600 text-sm font-medium">{selected.company}</span>
                  {selected.location && (
                    <span className="text-gray-500 text-sm flex items-center gap-1">
                      <MapPin className="w-3 h-3" /> {selected.location}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 mt-2 flex-wrap">
                  {selected.remote && <span className="badge badge-green text-xs">Remote</span>}
                  {selected.salary && selected.salary !== 'Not specified' && (
                    <span className="badge badge-gray text-xs">{selected.salary}</span>
                  )}
                  <span className="badge badge-blue text-xs">{selected.source}</span>
                  <span className={cn('badge text-xs', JOB_STATUS_STYLES[selected.status])}>
                    {JOB_STATUS_LABELS[selected.status]}
                  </span>
                </div>
              </div>

              {/* Match score */}
              <div className="bg-gray-50 rounded-xl p-3">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-sm text-gray-600 font-medium">Match Score</span>
                  <span className={cn(
                    'text-xl font-bold',
                    selected.matchScore >= 75 ? 'text-green-600' :
                    selected.matchScore >= 50 ? 'text-amber-600' : 'text-gray-600'
                  )}>
                    {selected.matchScore}%
                  </span>
                </div>
                <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                  <div
                    className={cn(
                      'h-full rounded-full transition-all',
                      selected.matchScore >= 75 ? 'bg-green-500' :
                      selected.matchScore >= 50 ? 'bg-amber-500' : 'bg-gray-400'
                    )}
                    style={{ width: `${selected.matchScore}%` }}
                  />
                </div>
              </div>
{/* Match explanation button */}
<MatchExplainer jobId={selected._id} matchScore={selected.matchScore} />

              {/* HR Contact */}
              {selected.recruiterEmail ? (
                <div className="bg-green-50 border border-green-200 rounded-xl p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold text-green-700 uppercase tracking-wide">
                      HR Contact Found ✓
                    </p>
                    <span className={cn(
                      'badge text-xs',
                      selected.recruiterSource === 'hunter' ? 'badge-green' :
                      selected.recruiterSource === 'apollo' ? 'badge-blue' : 'badge-gray'
                    )}>
                      {selected.recruiterSource === 'hunter' ? '✓ Verified' :
                       selected.recruiterSource === 'apollo' ? '✓ Apollo'   : 'Pattern'}
                    </span>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-green-900">
                      {selected.recruiterName || 'HR Contact'}
                    </p>
                    <p className="text-sm text-blue-600 font-mono">{selected.recruiterEmail}</p>
                    {selected.recruiterConfidence && (
                      <p className="text-xs text-green-500 mt-0.5">
                        {selected.recruiterConfidence}% confidence
                      </p>
                    )}
                  </div>
                  {selected.careerPageUrl && (
                    <a
                      href={selected.careerPageUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-blue-600 hover:text-blue-700 flex items-center gap-1"
                    >
                      <ExternalLink className="w-3 h-3" /> View Careers Page
                    </a>
                  )}
                </div>
              ) : (
                <div className="bg-gray-50 border border-gray-200 rounded-xl p-3 space-y-2">
                  {(() => {
                    const lookup = hrLookup[selected._id];

                    if (lookup?.loading) {
                      return (
                        <div className="flex items-center gap-2 text-sm text-blue-600">
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Searching for HR contacts at {selected.company}…
                        </div>
                      );
                    }

                    if (lookup?.result) {
                      const { emails, source, domain, careerPageUrl } = lookup.result;
                      if (!emails?.length) {
                        return (
                          <>
                            <p className="text-xs font-medium text-gray-500">No HR email found for {selected.company}</p>
                            {domain && <p className="text-xs text-gray-400">Domain: {domain}</p>}
                            {careerPageUrl && (
                              <a href={careerPageUrl} target="_blank" rel="noopener noreferrer"
                                className="text-xs text-blue-600 flex items-center gap-1">
                                <ExternalLink className="w-3 h-3" /> View Careers Page
                              </a>
                            )}
                          </>
                        );
                      }

                      return (
                        <>
                          <div className="flex items-center justify-between">
                            <p className="text-xs font-semibold text-green-700 flex items-center gap-1">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              {emails.length} contact{emails.length > 1 ? 's' : ''} found
                            </p>
                            <span className="badge badge-green text-xs">{source}</span>
                          </div>
                          <div className="space-y-2">
                            {emails.map((e, i) => (
                              <div key={i} className="bg-white border border-green-200 rounded-lg p-2">
                                <div className="flex items-start justify-between gap-1">
                                  <div className="min-w-0">
                                    {e.name && <p className="text-xs font-semibold text-gray-800 truncate">{e.name}</p>}
                                    {e.title && <p className="text-xs text-gray-500 truncate">{e.title}</p>}
                                    <p className="text-xs text-blue-600 font-mono break-all">{e.email}</p>
                                  </div>
                                  {e.confidence && (
                                    <span className="badge badge-green text-xs flex-shrink-0">{e.confidence}%</span>
                                  )}
                                </div>
                                {e.linkedin && (
                                  <a href={e.linkedin} target="_blank" rel="noopener noreferrer"
                                    className="text-xs text-blue-500 flex items-center gap-0.5 mt-1">
                                    LinkedIn →
                                  </a>
                                )}
                              </div>
                            ))}
                          </div>
                          {careerPageUrl && (
                            <a href={careerPageUrl} target="_blank" rel="noopener noreferrer"
                              className="text-xs text-blue-600 flex items-center gap-1">
                              <ExternalLink className="w-3 h-3" /> View Careers Page
                            </a>
                          )}
                        </>
                      );
                    }

                    return (
                      <>
                        <p className="text-xs font-medium text-gray-500">No HR email auto-found</p>
                        <button
                          onClick={() => findHRContact(selected)}
                          className="btn btn-sm bg-blue-600 text-white hover:bg-blue-700 w-full justify-center mt-1"
                        >
                          <SearchCheck className="w-3.5 h-3.5" />
                          Auto-find HR Contact
                        </button>
                        {lookup?.error && (
                          <p className="text-xs text-red-500">{lookup.error}</p>
                        )}
                      </>
                    );
                  })()}
                </div>
              )}

{/* Company research */}
<CompanyResearch jobId={selected._id} company={selected.company} />
              {/* Description */}
              {selected.description && (
                <div>
                  <h4 className="text-sm font-semibold text-gray-900 mb-2">Description</h4>
                  <p className="text-sm text-gray-600 leading-relaxed whitespace-pre-wrap">
                    {truncate(selected.description, 400)}
                  </p>
                </div>
              )}

              {/* Status tracker */}
              <div>
                <h4 className="text-sm font-semibold text-gray-900 mb-2">Update Status</h4>
                <div className="grid grid-cols-3 gap-1.5">
                  {STATUSES.map(s => (
                    <button
                      key={s}
                      onClick={() => updateStatus(selected._id, s)}
                      className={cn(
                        'py-1.5 px-2 rounded-lg text-xs font-medium border transition-colors',
                        selected.status === s
                          ? 'bg-blue-600 text-white border-blue-600'
                          : 'bg-white text-gray-600 border-gray-200 hover:border-blue-300'
                      )}
                    >
                      {JOB_STATUS_LABELS[s]}
                    </button>
                  ))}
                </div>
              </div>

              {/* Actions */}
              <div className="flex flex-col gap-2 pt-1">
                {selected.url && (
                  <a
                    href={selected.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn btn-primary w-full justify-center"
                  >
                    <ExternalLink className="w-4 h-4" />
                    Apply Now
                  </a>
                )}

                {/* Outreach button — shows for all if HR email exists */}
                {selected.recruiterEmail && (
                  <button
                    onClick={() => navigate(
                      `/outreach-manager?searchId=${selected.searchId || searchId || ''}&to=${encodeURIComponent(selected.recruiterEmail)}&company=${encodeURIComponent(selected.company)}&jobTitle=${encodeURIComponent(selected.title)}`
                    )}
                    className="btn btn-secondary w-full justify-center"
                  >
                    <Mail className="w-4 h-4" />
                    Send Outreach Email
                  </button>
                )}

                <button
                  onClick={() => saveJob(selected)}
                  className="btn btn-secondary w-full justify-center"
                >
                  {selected.status === 'saved'
                    ? <><BookmarkCheck className="w-4 h-4 text-blue-600" /> Saved</>
                    : <><Bookmark className="w-4 h-4" /> Save Job</>
                  }
                </button>
              </div>

            </div>
          </div>
        </div>
      )}
    </div>
  );
}