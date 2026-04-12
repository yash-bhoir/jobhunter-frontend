import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Linkedin, Plus, Search, Mail, Users, ExternalLink,
  Loader2, Trash2, Copy, Check, RefreshCw, Zap,
  MapPin, Building, Star, AlertCircle, X, ChevronRight
} from 'lucide-react';
import { api }      from '@utils/axios';
import { useAuth }  from '@hooks/useAuth';
import { useToast } from '@hooks/useToast';
import { fAgo }     from '@utils/formatters';
import { cn }       from '@utils/helpers';

const STATUS_CONFIG = {
  new:     { label: 'New',     cls: 'bg-blue-100 text-blue-700'    },
  saved:   { label: 'Saved',   cls: 'bg-amber-100 text-amber-700'  },
  applied: { label: 'Applied', cls: 'bg-emerald-100 text-emerald-700' },
  ignored: { label: 'Ignored', cls: 'bg-gray-100 text-gray-500'    },
};

const fadeUp = {
  hidden: { opacity: 0, y: 12 },
  show:   { opacity: 1, y: 0, transition: { duration: 0.3, ease: 'easeOut' } },
};
const stagger = { show: { transition: { staggerChildren: 0.06 } } };

function CompanyAvatar({ name, size = 'md' }) {
  const char = name?.[0]?.toUpperCase() || 'L';
  const hue  = ((name?.charCodeAt(0) || 76) * 5) % 360;
  const sz   = size === 'sm' ? 'w-8 h-8 text-xs' : 'w-10 h-10 text-sm';
  return (
    <div className={cn('rounded-xl flex items-center justify-center font-bold flex-shrink-0', sz)}
      style={{ background: `hsl(${hue},65%,92%)`, color: `hsl(${hue},65%,35%)` }}>
      {char}
    </div>
  );
}

export default function LinkedIn() {
  const { user } = useAuth();
  const toast    = useToast();
  const isPro    = user?.plan === 'pro' || user?.plan === 'team';

  const [jobs,         setJobs]         = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [selected,     setSelected]     = useState(null);
  const [showAdd,      setShowAdd]      = useState(false);
  const [finding,      setFinding]      = useState('');
  const [copied,       setCopied]       = useState('');
  const [fetchLoading, setFetchLoading] = useState(false);
  const [fetchResult,  setFetchResult]  = useState(null);
  const [addLoading,   setAddLoading]   = useState(false);
  const [statusFilter, setStatusFilter] = useState('');
  const [fetchConfig,  setFetchConfig]  = useState({
    role:     user?.profile?.targetRole || '',
    location: user?.profile?.preferredLocations?.[0] || 'India',
    workType: user?.profile?.workType || 'any',
  });

  const [form, setForm] = useState({
    title: '', company: '', location: '', url: '', description: '', salary: '', remote: false,
  });

  useEffect(() => { fetchJobs(); }, [statusFilter]);

  const fetchJobs = async () => {
    setLoading(true);
    try {
      const params = statusFilter ? `?status=${statusFilter}` : '';
      const { data } = await api.get(`/linkedin/jobs${params}`);
      setJobs(data.data || []);
    } catch { toast.error('Failed to load jobs'); }
    finally { setLoading(false); }
  };

  const handleFetchAlerts = async () => {
    setFetchLoading(true); setFetchResult(null);
    try {
      const { data } = await api.post('/linkedin/fetch', fetchConfig);
      setFetchResult(data.data);
      if (data.data.saved > 0) { toast.success(`Fetched ${data.data.saved} new jobs!`); fetchJobs(); }
      else toast.info(data.message || 'No new jobs found');
    } catch (err) { toast.error(err.response?.data?.message || 'Fetch failed'); }
    finally { setFetchLoading(false); }
  };

  const addJob = async () => {
    if (!form.title || !form.company) { toast.error('Title and company required'); return; }
    setAddLoading(true);
    try {
      await api.post('/linkedin/jobs', form);
      toast.success('Job added!');
      setForm({ title: '', company: '', location: '', url: '', description: '', salary: '', remote: false });
      setShowAdd(false); fetchJobs();
    } catch (err) { toast.error(err.response?.data?.message || 'Failed'); }
    finally { setAddLoading(false); }
  };

  const findHR = async (jobId) => {
    setFinding(jobId);
    try {
      const { data } = await api.post(`/linkedin/jobs/${jobId}/find-hr`);
      toast.success(`Found ${data.data.emails?.length || 0} HR emails + ${data.data.employees?.length || 0} employees!`);
      fetchJobs();
      if (selected?._id === jobId) {
        const res = await api.get(`/linkedin/jobs/${jobId}`);
        setSelected(res.data.data);
      }
    } catch (err) { toast.error(err.response?.data?.message || 'Failed'); }
    finally { setFinding(''); }
  };

  const updateStatus = async (jobId, status) => {
    try {
      await api.patch(`/linkedin/jobs/${jobId}/status`, { status });
      setJobs(prev => prev.map(j => j._id === jobId ? { ...j, status } : j));
      if (selected?._id === jobId) setSelected(prev => ({ ...prev, status }));
    } catch { toast.error('Failed to update status'); }
  };

  const deleteJob = async (jobId) => {
    if (!confirm('Delete this job?')) return;
    try {
      await api.delete(`/linkedin/jobs/${jobId}`);
      setJobs(prev => prev.filter(j => j._id !== jobId));
      if (selected?._id === jobId) setSelected(null);
      toast.success('Deleted');
    } catch { toast.error('Failed to delete'); }
  };

  const copy = async (text) => {
    await navigator.clipboard.writeText(text);
    setCopied(text); setTimeout(() => setCopied(''), 2000); toast.success('Copied!');
  };

  const withEmail = jobs.filter(j => j.recruiterEmail).length;

  return (
    <motion.div variants={stagger} initial="hidden" animate="show" className="space-y-4">

      {/* Header */}
      <motion.div variants={fadeUp} className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <Linkedin className="w-5 h-5 text-blue-700" />
            LinkedIn Job Alerts
          </h1>
          <p className="text-sm text-gray-400 mt-0.5">
            {jobs.length} saved · {withEmail} HR emails found
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={handleFetchAlerts} disabled={fetchLoading} className="btn btn-primary btn-sm">
            {fetchLoading ? <><Loader2 className="w-4 h-4 animate-spin" /> Fetching…</> : <><RefreshCw className="w-4 h-4" /> Fetch from LinkedIn</>}
          </button>
          <button onClick={() => setShowAdd(!showAdd)} className="btn btn-secondary btn-sm">
            <Plus className="w-4 h-4" /> Add
          </button>
        </div>
      </motion.div>

      {/* Fetch result */}
      <AnimatePresence>
        {fetchResult && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className={cn('rounded-2xl p-4 flex items-center justify-between gap-3 border',
              fetchResult.saved > 0 ? 'bg-emerald-50 border-emerald-200' : 'bg-amber-50 border-amber-200'
            )}
          >
            <div>
              {fetchResult.saved > 0 ? (
                <>
                  <p className="font-semibold text-emerald-800 text-sm">✅ {fetchResult.saved} new jobs fetched</p>
                  <p className="text-xs text-emerald-600 mt-0.5">
                    {fetchResult.role} · {fetchResult.location}
                    {fetchResult.emailsFound > 0 && ` · ${fetchResult.emailsFound} HR emails`}
                  </p>
                </>
              ) : (
                <p className="text-sm font-medium text-amber-800">
                  No new jobs for "{fetchResult.role}" in "{fetchResult.location}"
                  {fetchResult.fetched > 0 && ` (${fetchResult.fetched} already saved)`}
                </p>
              )}
            </div>
            <button onClick={() => setFetchResult(null)} className="text-gray-400 hover:text-gray-600 flex-shrink-0">
              <X className="w-4 h-4" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Fetch config */}
      <motion.div variants={fadeUp} className="bg-blue-50 border border-blue-200 rounded-2xl p-4">
        <div className="flex items-center gap-2 mb-3">
          <Zap className="w-4 h-4 text-blue-600" />
          <p className="font-semibold text-blue-800 text-sm">Auto-Fetch Settings</p>
          <span className="text-xs text-blue-400">(pre-filled from profile)</span>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="label text-blue-700 text-xs">Role</label>
            <input value={fetchConfig.role} onChange={e => setFetchConfig(p => ({ ...p, role: e.target.value }))} placeholder="React Developer" className="input bg-white text-sm" />
          </div>
          <div>
            <label className="label text-blue-700 text-xs">Location</label>
            <input value={fetchConfig.location} onChange={e => setFetchConfig(p => ({ ...p, location: e.target.value }))} placeholder="India" className="input bg-white text-sm" />
          </div>
          <div>
            <label className="label text-blue-700 text-xs">Work Type</label>
            <select value={fetchConfig.workType} onChange={e => setFetchConfig(p => ({ ...p, workType: e.target.value }))} className="input bg-white text-sm">
              <option value="any">Any</option>
              <option value="remote">Remote</option>
              <option value="hybrid">Hybrid</option>
              <option value="onsite">On-site</option>
            </select>
          </div>
        </div>
        <p className={cn('text-xs mt-2.5 flex items-center gap-1', isPro ? 'text-blue-600' : 'text-amber-600')}>
          {isPro ? <Zap className="w-3 h-3" /> : <AlertCircle className="w-3 h-3" />}
          {isPro ? 'Pro: auto-fetches every hour automatically' : 'Free: manual only — upgrade Pro for hourly auto-fetch'}
        </p>
      </motion.div>

      {/* Gmail section */}
      <motion.div variants={fadeUp}>
        <GmailAlertSection onFetched={fetchJobs} />
      </motion.div>

      {/* Add manually */}
      <AnimatePresence>
        {showAdd && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="bg-white rounded-2xl border border-gray-100 p-5 space-y-4" style={{ boxShadow: '0 2px 16px -2px rgba(0,0,0,0.07)' }}>
              <h2 className="font-semibold text-gray-900 text-sm">Add Job Manually</h2>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="label">Job Title *</label><input value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} placeholder="Senior React Developer" className="input" /></div>
                <div><label className="label">Company *</label><input value={form.company} onChange={e => setForm(p => ({ ...p, company: e.target.value }))} placeholder="Infosys" className="input" /></div>
                <div><label className="label">Location</label><input value={form.location} onChange={e => setForm(p => ({ ...p, location: e.target.value }))} placeholder="Mumbai, India" className="input" /></div>
                <div><label className="label">Salary</label><input value={form.salary} onChange={e => setForm(p => ({ ...p, salary: e.target.value }))} placeholder="₹15-20 LPA" className="input" /></div>
                <div className="col-span-2"><label className="label">Job URL</label><input value={form.url} onChange={e => setForm(p => ({ ...p, url: e.target.value }))} placeholder="https://linkedin.com/jobs/view/..." className="input" /></div>
                <div className="col-span-2"><label className="label">Description</label><textarea value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} rows={3} placeholder="Paste job description..." className="input resize-none" /></div>
                <div className="col-span-2 flex items-center gap-2">
                  <input type="checkbox" id="remote" checked={form.remote} onChange={e => setForm(p => ({ ...p, remote: e.target.checked }))} className="w-4 h-4 text-blue-600 rounded" />
                  <label htmlFor="remote" className="text-sm text-gray-700">Remote position</label>
                </div>
              </div>
              <div className="flex gap-2">
                <button onClick={addJob} disabled={addLoading} className="btn btn-primary">
                  {addLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} Add Job
                </button>
                <button onClick={() => setShowAdd(false)} className="btn btn-secondary">Cancel</button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Status filter */}
      <div className="flex gap-2 flex-wrap">
        {['', 'new', 'saved', 'applied', 'ignored'].map(s => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={cn('px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all capitalize',
              statusFilter === s
                ? 'bg-blue-600 text-white border-blue-600'
                : 'bg-white text-gray-600 border-gray-200 hover:border-blue-300'
            )}
          >
            {s || 'All'} {s === '' && `(${jobs.length})`}
          </button>
        ))}
      </div>

      {/* Jobs list + detail */}
      <div className="flex gap-5">

        {/* List */}
        <div className="flex-1 min-w-0 space-y-2">
          {loading ? (
            [...Array(4)].map((_, i) => (
              <div key={i} className="bg-white rounded-2xl border border-gray-100 p-4 flex items-center gap-3">
                <div className="skeleton w-10 h-10 rounded-xl flex-shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="skeleton h-4 w-2/3 rounded" />
                  <div className="skeleton h-3 w-1/3 rounded" />
                </div>
              </div>
            ))
          ) : jobs.length === 0 ? (
            <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center" style={{ boxShadow: '0 2px 12px -2px rgba(0,0,0,0.06)' }}>
              <div className="w-14 h-14 rounded-2xl bg-blue-50 flex items-center justify-center mx-auto mb-3">
                <Linkedin className="w-6 h-6 text-blue-400" />
              </div>
              <p className="text-gray-700 font-semibold">No jobs yet</p>
              <p className="text-gray-400 text-sm mt-1 mb-4">Click <strong>Fetch from LinkedIn</strong> to import</p>
              <button onClick={handleFetchAlerts} disabled={fetchLoading} className="btn btn-primary btn-sm mx-auto">
                {fetchLoading ? <><Loader2 className="w-4 h-4 animate-spin" /> Fetching…</> : <><RefreshCw className="w-4 h-4" /> Fetch Now</>}
              </button>
            </div>
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
                        ? 'border-blue-300 shadow-md'
                        : 'border-gray-100 hover:border-blue-200 hover:shadow-sm'
                    )}
                    style={{ boxShadow: selected?._id === job._id ? '0 4px 20px -2px rgba(37,99,235,0.12)' : '' }}
                  >
                    <div className="flex items-start gap-3">
                      <CompanyAvatar name={job.company} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <h3 className="font-semibold text-gray-900 text-sm truncate">{job.title}</h3>
                            <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                              <span className="text-xs text-gray-500 flex items-center gap-1">
                                <Building className="w-3 h-3" /> {job.company}
                              </span>
                              {job.location && (
                                <span className="text-xs text-gray-400 flex items-center gap-1">
                                  <MapPin className="w-3 h-3" /> {job.location}
                                </span>
                              )}
                              {job.remote && <span className="text-xs bg-emerald-100 text-emerald-700 font-semibold px-1.5 py-0.5 rounded-full">Remote</span>}
                            </div>
                          </div>
                          <div className="flex items-center gap-1.5 flex-shrink-0">
                            {job.matchScore > 0 && (
                              <span className={cn('flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold',
                                job.matchScore >= 75 ? 'bg-emerald-100 text-emerald-700' :
                                job.matchScore >= 50 ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-500'
                              )}>
                                <Star className="w-3 h-3" /> {job.matchScore}%
                              </span>
                            )}
                            <span className={cn('text-xs font-semibold px-2 py-0.5 rounded-full', sc.cls)}>{sc.label}</span>
                            {job.recruiterEmail && (
                              <span className="text-xs bg-emerald-100 text-emerald-700 font-semibold px-1.5 py-0.5 rounded-full flex items-center gap-1">
                                <Mail className="w-3 h-3" /> HR
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 mt-1.5">
                          <span className="text-xs text-gray-400">{job.source?.replace(/_/g, ' ')}</span>
                          {job.salary && <span className="text-xs text-gray-400">· {job.salary}</span>}
                          <span className="text-xs text-gray-300">· {fAgo(job.createdAt)}</span>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </motion.div>
          )}
        </div>

        {/* Detail panel */}
        <AnimatePresence>
          {selected && (
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="w-88 flex-shrink-0"
              style={{ width: '22rem' }}
            >
              <div
                className="bg-white rounded-2xl border border-gray-100 sticky top-0 overflow-y-auto"
                style={{ maxHeight: 'calc(100vh - 5rem)', boxShadow: '0 4px 24px -4px rgba(0,0,0,0.1)' }}
              >
                <div className="flex items-center justify-between px-4 py-3.5 border-b border-gray-100">
                  <h3 className="font-semibold text-gray-900 text-sm">Job Details</h3>
                  <button onClick={() => setSelected(null)} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600">
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="p-4 space-y-4">
                  {/* Title */}
                  <div>
                    <div className="flex items-start gap-3 mb-2">
                      <CompanyAvatar name={selected.company} />
                      <div>
                        <h2 className="font-bold text-gray-900 leading-tight">{selected.title}</h2>
                        <p className="text-gray-500 text-sm font-medium">{selected.company}</p>
                        {selected.location && (
                          <p className="text-gray-400 text-xs mt-0.5 flex items-center gap-1">
                            <MapPin className="w-3 h-3" /> {selected.location}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {selected.remote && <span className="text-xs bg-emerald-100 text-emerald-700 font-semibold px-2 py-0.5 rounded-full">Remote</span>}
                      {selected.salary && <span className="text-xs bg-gray-100 text-gray-600 font-medium px-2 py-0.5 rounded-full">{selected.salary}</span>}
                      <span className={cn('text-xs font-semibold px-2 py-0.5 rounded-full', (STATUS_CONFIG[selected.status] || STATUS_CONFIG.new).cls)}>
                        {(STATUS_CONFIG[selected.status] || STATUS_CONFIG.new).label}
                      </span>
                      {selected.matchScore > 0 && (
                        <span className={cn('text-xs font-semibold px-2 py-0.5 rounded-full flex items-center gap-1',
                          selected.matchScore >= 75 ? 'bg-emerald-100 text-emerald-700' :
                          selected.matchScore >= 50 ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-500'
                        )}>
                          <Star className="w-3 h-3" /> {selected.matchScore}% match
                        </span>
                      )}
                    </div>
                  </div>

                  {/* HR Contact */}
                  {selected.recruiterEmail ? (
                    <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 space-y-2">
                      <p className="text-xs font-semibold text-emerald-700 uppercase tracking-wide">HR Contact ✓</p>
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-semibold text-gray-900">{selected.recruiterName || 'HR Contact'}</p>
                          <p className="text-sm text-blue-600 font-mono">{selected.recruiterEmail}</p>
                        </div>
                        <button onClick={() => copy(selected.recruiterEmail)} className="p-1.5 text-gray-400 hover:text-gray-600">
                          {copied === selected.recruiterEmail ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                        </button>
                      </div>
                      {selected.recruiterLinkedIn && (
                        <a href={selected.recruiterLinkedIn} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-xs text-blue-600 hover:underline">
                          <Linkedin className="w-3 h-3" /> LinkedIn Profile
                        </a>
                      )}
                    </div>
                  ) : (
                    <div className="bg-gray-50 border border-gray-200 rounded-xl p-3">
                      <p className="text-xs text-gray-500 mb-2">No HR email found yet</p>
                      <button
                        onClick={() => findHR(selected._id)}
                        disabled={finding === selected._id}
                        className="btn btn-secondary btn-sm w-full justify-center"
                      >
                        {finding === selected._id
                          ? <><Loader2 className="w-4 h-4 animate-spin" /> Finding…</>
                          : <><Search className="w-4 h-4" /> Find HR + Employees</>}
                        {!isPro && <span className="text-xs bg-amber-100 text-amber-600 font-semibold px-1.5 py-0.5 rounded-full ml-1">Pro</span>}
                      </button>
                    </div>
                  )}

                  {/* Employees */}
                  {selected.employees?.length > 0 && (
                    <div>
                      <h4 className="text-sm font-semibold text-gray-900 mb-2 flex items-center gap-1">
                        <Users className="w-4 h-4" /> Employees ({selected.employees.length})
                      </h4>
                      <div className="space-y-1.5">
                        {selected.employees.map((emp, i) => (
                          <div key={i} className="flex items-center gap-2 p-2 bg-gray-50 rounded-lg">
                            <div className="w-7 h-7 rounded-lg bg-blue-100 flex items-center justify-center text-blue-600 text-xs font-bold flex-shrink-0">
                              {emp.name?.[0]?.toUpperCase() || '?'}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-semibold text-gray-900 truncate">{emp.name}</p>
                              <p className="text-xs text-gray-500 truncate">{emp.title}</p>
                            </div>
                            <div className="flex gap-1">
                              {emp.linkedin && (
                                <a href={emp.linkedin} target="_blank" rel="noopener noreferrer" className="p-1 text-blue-600 hover:text-blue-700">
                                  <Linkedin className="w-3.5 h-3.5" />
                                </a>
                              )}
                              {emp.email && (
                                <button onClick={() => copy(emp.email)} className="p-1 text-gray-400 hover:text-gray-600">
                                  {copied === emp.email ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                                </button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Description */}
                  {selected.description && (
                    <div>
                      <h4 className="text-sm font-semibold text-gray-900 mb-1">Description</h4>
                      <p className="text-xs text-gray-500 leading-relaxed line-clamp-6">{selected.description}</p>
                    </div>
                  )}

                  {/* Status */}
                  <div>
                    <h4 className="text-sm font-semibold text-gray-900 mb-2">Update Status</h4>
                    <div className="grid grid-cols-2 gap-1.5">
                      {['new', 'saved', 'applied', 'ignored'].map(s => (
                        <button
                          key={s}
                          onClick={() => updateStatus(selected._id, s)}
                          className={cn('py-1.5 rounded-lg text-xs font-semibold border capitalize transition-colors',
                            selected.status === s
                              ? 'bg-blue-600 text-white border-blue-600'
                              : 'bg-white text-gray-600 border-gray-200 hover:border-blue-300'
                          )}
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex flex-col gap-2 pt-1">
                    {selected.url && (
                      <a href={selected.url} target="_blank" rel="noopener noreferrer" className="btn btn-primary w-full justify-center">
                        <ExternalLink className="w-4 h-4" /> View on LinkedIn
                      </a>
                    )}
                    {selected.recruiterEmail && (
                      <button
                        onClick={() => {
                          window.location.href =
                            `/outreach?to=${encodeURIComponent(selected.recruiterEmail)}` +
                            `&company=${encodeURIComponent(selected.company)}` +
                            `&jobTitle=${encodeURIComponent(selected.title)}`;
                        }}
                        className="btn btn-secondary w-full justify-center"
                      >
                        <Mail className="w-4 h-4" /> Send Outreach
                      </button>
                    )}
                    {!selected.recruiterEmail && (
                      <button onClick={() => findHR(selected._id)} disabled={finding === selected._id} className="btn btn-secondary w-full justify-center">
                        {finding === selected._id ? <><Loader2 className="w-4 h-4 animate-spin" /> Finding…</> : <><Users className="w-4 h-4" /> Find HR + Employees</>}
                        {!isPro && <span className="text-xs bg-amber-100 text-amber-600 font-semibold px-1.5 py-0.5 rounded-full ml-1">Pro</span>}
                      </button>
                    )}
                    <button onClick={() => deleteJob(selected._id)} className="btn btn-danger w-full justify-center">
                      <Trash2 className="w-4 h-4" /> Delete
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

function GmailAlertSection({ onFetched }) {
  const toast = useToast();
  const [status,       setStatus]       = useState(null);
  const [fetchLoading, setFetchLoading] = useState(false);
  const [fetchResult,  setFetchResult]  = useState(null);

  useEffect(() => {
    api.get('/linkedin/gmail/status').then(r => setStatus(r.data.data)).catch(() => setStatus({ connected: false }));
    const params = new URLSearchParams(window.location.search);
    if (params.get('gmail') === 'connected') {
      toast.success('Gmail connected!');
      window.history.replaceState({}, '', '/linkedin');
      api.get('/linkedin/gmail/status').then(r => setStatus(r.data.data));
    }
    if (params.get('gmail') === 'error') {
      toast.error('Gmail connection failed. Try again.');
      window.history.replaceState({}, '', '/linkedin');
    }
  }, []);

  const connectGmail = async () => {
    try {
      const { data } = await api.get('/linkedin/gmail/connect');
      window.location.href = data.data.url;
    } catch { toast.error('Failed to connect Gmail'); }
  };

  const disconnect = async () => {
    if (!confirm('Disconnect Gmail?')) return;
    try {
      await api.delete('/linkedin/gmail/disconnect');
      setStatus({ connected: false }); toast.success('Disconnected');
    } catch { toast.error('Failed'); }
  };

  const fetchFromGmail = async () => {
    setFetchLoading(true); setFetchResult(null);
    try {
      const { data } = await api.post('/linkedin/gmail/fetch');
      setFetchResult(data.data);
      if (data.data.saved > 0) { toast.success(`Fetched ${data.data.saved} jobs from Gmail!`); onFetched(); }
      else toast.info('No new LinkedIn alert emails found');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Fetch failed');
    } finally { setFetchLoading(false); }
  };

  return (
    <div className={cn(
      'rounded-2xl border-2 p-4',
      status?.connected ? 'bg-emerald-50 border-emerald-200' : 'bg-white border-dashed border-gray-200'
    )}>
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-start gap-3">
          <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0',
            status?.connected ? 'bg-emerald-100' : 'bg-gray-100'
          )}>
            <Mail className={cn('w-5 h-5', status?.connected ? 'text-emerald-600' : 'text-gray-400')} />
          </div>
          <div>
            <p className="font-semibold text-gray-900 text-sm">
              Gmail Alerts
              {status?.connected && <span className="ml-2 text-xs bg-emerald-100 text-emerald-700 font-semibold px-2 py-0.5 rounded-full">Connected</span>}
            </p>
            <p className="text-xs text-gray-500 mt-0.5">
              {status?.connected
                ? `${status.email} — auto-parses LinkedIn alert emails`
                : 'Connect Gmail to auto-import from LinkedIn alerts'}
            </p>
          </div>
        </div>
        <div className="flex gap-2 flex-shrink-0">
          {status?.connected ? (
            <>
              <button onClick={fetchFromGmail} disabled={fetchLoading} className="btn btn-primary btn-sm">
                {fetchLoading ? <><Loader2 className="w-4 h-4 animate-spin" /> Fetching…</> : <><Mail className="w-4 h-4" /> Fetch from Gmail</>}
              </button>
              <button onClick={disconnect} className="btn btn-danger btn-sm">Disconnect</button>
            </>
          ) : (
            <button onClick={connectGmail} className="btn btn-primary btn-sm">
              <Mail className="w-4 h-4" /> Connect Gmail
            </button>
          )}
        </div>
      </div>

      {fetchResult && (
        <div className="mt-3 p-3 bg-white rounded-xl border border-emerald-100 text-sm">
          {fetchResult.saved > 0 ? (
            <p className="text-emerald-700">✅ <strong>{fetchResult.saved}</strong> new · <strong>{fetchResult.emailsFound}</strong> HR emails · <strong>{fetchResult.employeesFound}</strong> employees</p>
          ) : (
            <p className="text-amber-700">No new jobs. {fetchResult.fetched > 0 ? `(${fetchResult.fetched} already saved)` : 'Check your LinkedIn email alerts are set up.'}</p>
          )}
        </div>
      )}

      {!status?.connected && (
        <div className="mt-3 grid grid-cols-3 gap-2">
          {['Connect your Gmail', 'We read LinkedIn alert emails only', 'Jobs + HR emails auto-imported'].map((s, i) => (
            <div key={i} className="flex items-start gap-1.5 text-xs text-gray-500">
              <span className="w-4 h-4 rounded-full bg-blue-100 text-blue-600 text-[10px] font-bold flex items-center justify-center flex-shrink-0 mt-0.5">{i + 1}</span>
              {s}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
