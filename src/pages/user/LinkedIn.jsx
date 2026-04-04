import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Linkedin, Plus, Search, Mail, Users, ExternalLink,
  Loader2, Trash2, Copy, Check, RefreshCw, Zap,
  MapPin, Building, Star, AlertCircle
} from 'lucide-react';
import { api }      from '@utils/axios';
import { useAuth }  from '@hooks/useAuth';
import { useToast } from '@hooks/useToast';
import { fAgo }     from '@utils/formatters';
import { cn }       from '@utils/helpers';

const STATUS_STYLES = {
  new:     'badge-blue',
  saved:   'badge-amber',
  applied: 'badge-green',
  ignored: 'badge-gray',
};

export default function LinkedIn() {
  const { user } = useAuth();
  const toast    = useToast();
  const isPro    = user?.plan === 'pro' || user?.plan === 'team';

  const [jobs,        setJobs]        = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [selected,    setSelected]    = useState(null);
  const [showAdd,     setShowAdd]     = useState(false);
  const [finding,     setFinding]     = useState('');
  const [copied,      setCopied]      = useState('');
  const [fetchLoading,setFetchLoading]= useState(false);
  const [fetchResult, setFetchResult] = useState(null);
  const [addLoading,  setAddLoading]  = useState(false);
  const [statusFilter,setStatusFilter]= useState('');

  // Manual add form
  const [form, setForm] = useState({
    title: '', company: '', location: '', url: '',
    description: '', salary: '', remote: false,
  });

  // Fetch config for manual fetch
  const [fetchConfig, setFetchConfig] = useState({
    role:     user?.profile?.targetRole || '',
    location: user?.profile?.preferredLocations?.[0] || 'India',
    workType: user?.profile?.workType   || 'any',
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

  // ── Auto-fetch from LinkedIn ──────────────────────────────────
  const handleFetchAlerts = async () => {
    setFetchLoading(true);
    setFetchResult(null);
    try {
      const { data } = await api.post('/linkedin/fetch', fetchConfig);
      setFetchResult(data.data);
      if (data.data.saved > 0) {
        toast.success(`Fetched ${data.data.saved} new LinkedIn jobs!`);
        fetchJobs();
      } else {
        toast.info(data.message || 'No new jobs found');
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Fetch failed');
    } finally {
      setFetchLoading(false);
    }
  };

  // ── Add job manually ──────────────────────────────────────────
  const addJob = async () => {
    if (!form.title || !form.company) { toast.error('Title and company required'); return; }
    setAddLoading(true);
    try {
      const { data } = await api.post('/linkedin/jobs', form);
      toast.success('Job added! Auto-finding HR email...');
      setForm({ title: '', company: '', location: '', url: '', description: '', salary: '', remote: false });
      setShowAdd(false);
      fetchJobs();
    } catch (err) { toast.error(err.response?.data?.message || 'Failed'); }
    finally { setAddLoading(false); }
  };

  // ── Find HR contacts ──────────────────────────────────────────
  const findHR = async (jobId) => {
    setFinding(jobId);
    try {
      const { data } = await api.post(`/linkedin/jobs/${jobId}/find-hr`);
      toast.success(
        `Found ${data.data.emails?.length || 0} HR emails + ${data.data.employees?.length || 0} employees!`
      );
      fetchJobs();
      if (selected?._id === jobId) {
        const res = await api.get(`/linkedin/jobs/${jobId}`);
        setSelected(res.data.data);
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed');
    } finally {
      setFinding('');
    }
  };

  // ── Update status ─────────────────────────────────────────────
  const updateStatus = async (jobId, status) => {
    try {
      await api.patch(`/linkedin/jobs/${jobId}/status`, { status });
      setJobs(prev => prev.map(j => j._id === jobId ? { ...j, status } : j));
      if (selected?._id === jobId) setSelected(prev => ({ ...prev, status }));
    } catch { toast.error('Failed to update status'); }
  };

  // ── Delete job ────────────────────────────────────────────────
  const deleteJob = async (jobId) => {
    if (!confirm('Delete this job?')) return;
    try {
      await api.delete(`/linkedin/jobs/${jobId}`);
      setJobs(prev => prev.filter(j => j._id !== jobId));
      if (selected?._id === jobId) setSelected(null);
      toast.success('Deleted');
    } catch { toast.error('Failed to delete'); }
  };

  // ── Copy to clipboard ─────────────────────────────────────────
  const copy = async (text) => {
    await navigator.clipboard.writeText(text);
    setCopied(text);
    setTimeout(() => setCopied(''), 2000);
    toast.success('Copied!');
  };

  const withEmail = jobs.filter(j => j.recruiterEmail).length;

  return (
    <div className="max-w-6xl mx-auto space-y-6">

      {/* ── Header ───────────────────────────────────────────── */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Linkedin className="w-6 h-6 text-blue-700" />
            LinkedIn Job Alerts
          </h1>
          <p className="text-gray-500 text-sm mt-0.5">
            {jobs.length} jobs saved · {withEmail} HR emails found
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleFetchAlerts}
            disabled={fetchLoading}
            className="btn btn-primary"
          >
            {fetchLoading
              ? <><Loader2 className="w-4 h-4 animate-spin" /> Fetching...</>
              : <><RefreshCw className="w-4 h-4" /> Fetch from LinkedIn</>
            }
          </button>
          <button
            onClick={() => setShowAdd(!showAdd)}
            className="btn btn-secondary"
          >
            <Plus className="w-4 h-4" /> Add Manually
          </button>
        </div>
      </div>

      {/* ── Fetch result banner ───────────────────────────────── */}
      {fetchResult && (
        <div className={cn(
          'card card-body',
          fetchResult.saved > 0 ? 'bg-green-50 border-green-200' : 'bg-amber-50 border-amber-200'
        )}>
          <div className="flex items-center justify-between gap-3">
            <div>
              {fetchResult.saved > 0 ? (
                <>
                  <p className="font-semibold text-green-800">
                    ✅ Fetched {fetchResult.saved} new jobs from LinkedIn
                  </p>
                  <p className="text-sm text-green-600 mt-0.5">
                    Role: <strong>{fetchResult.role}</strong> ·
                    Location: <strong>{fetchResult.location}</strong>
                    {fetchResult.emailsFound > 0 && (
                      <> · <strong>{fetchResult.emailsFound}</strong> HR emails found</>
                    )}
                  </p>
                </>
              ) : (
                <p className="font-medium text-amber-800">
                  No new jobs found for "{fetchResult.role}" in "{fetchResult.location}"
                  {fetchResult.fetched > 0 && ` (${fetchResult.fetched} already saved)`}
                </p>
              )}
            </div>
            <button
              onClick={() => setFetchResult(null)}
              className="text-gray-400 hover:text-gray-600 text-xl font-bold flex-shrink-0"
            >
              ×
            </button>
          </div>
        </div>
      )}

      {/* ── Fetch config ──────────────────────────────────────── */}
      <div className="card card-body bg-blue-50 border-blue-200">
        <div className="flex items-center gap-2 mb-3">
          <Zap className="w-4 h-4 text-blue-600" />
          <h3 className="font-semibold text-blue-800 text-sm">
            Auto-Fetch Settings
          </h3>
          <span className="text-xs text-blue-500">
            (Pre-filled from your profile — edit if needed)
          </span>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="label text-blue-700">Role</label>
            <input
              value={fetchConfig.role}
              onChange={e => setFetchConfig(p => ({ ...p, role: e.target.value }))}
              placeholder="React Developer"
              className="input bg-white text-sm"
            />
          </div>
          <div>
            <label className="label text-blue-700">Location</label>
            <input
              value={fetchConfig.location}
              onChange={e => setFetchConfig(p => ({ ...p, location: e.target.value }))}
              placeholder="India"
              className="input bg-white text-sm"
            />
          </div>
          <div>
            <label className="label text-blue-700">Work Type</label>
            <select
              value={fetchConfig.workType}
              onChange={e => setFetchConfig(p => ({ ...p, workType: e.target.value }))}
              className="input bg-white text-sm"
            >
              <option value="any">Any</option>
              <option value="remote">Remote</option>
              <option value="hybrid">Hybrid</option>
              <option value="onsite">On-site</option>
            </select>
          </div>
        </div>

        {/* Pro scheduler info */}
        {isPro ? (
          <p className="text-xs text-blue-600 mt-2 flex items-center gap-1">
            <Zap className="w-3 h-3" />
            Pro: Auto-fetches every hour automatically. Last manual fetch shown above.
          </p>
        ) : (
          <p className="text-xs text-amber-600 mt-2 flex items-center gap-1">
            <AlertCircle className="w-3 h-3" />
            Free: Manual fetch only. Upgrade to Pro for automatic hourly fetching.
          </p>
        )}
      </div>

{/* Gmail Connect Section */}
<GmailAlertSection onFetched={fetchJobs} />

      {/* ── Manual add form ───────────────────────────────────── */}
      {showAdd && (
        <div className="card card-body space-y-4">
          <h2 className="font-semibold text-gray-900">Add Job Manually</h2>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Job Title *</label>
              <input
                value={form.title}
                onChange={e => setForm(p => ({ ...p, title: e.target.value }))}
                placeholder="Senior React Developer"
                className="input"
              />
            </div>
            <div>
              <label className="label">Company *</label>
              <input
                value={form.company}
                onChange={e => setForm(p => ({ ...p, company: e.target.value }))}
                placeholder="Infosys"
                className="input"
              />
            </div>
            <div>
              <label className="label">Location</label>
              <input
                value={form.location}
                onChange={e => setForm(p => ({ ...p, location: e.target.value }))}
                placeholder="Mumbai, India"
                className="input"
              />
            </div>
            <div>
              <label className="label">Salary</label>
              <input
                value={form.salary}
                onChange={e => setForm(p => ({ ...p, salary: e.target.value }))}
                placeholder="₹15-20 LPA"
                className="input"
              />
            </div>
            <div className="col-span-2">
              <label className="label">Job URL</label>
              <input
                value={form.url}
                onChange={e => setForm(p => ({ ...p, url: e.target.value }))}
                placeholder="https://linkedin.com/jobs/view/..."
                className="input"
              />
            </div>
            <div className="col-span-2">
              <label className="label">Description</label>
              <textarea
                value={form.description}
                onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
                rows={3}
                placeholder="Paste job description here..."
                className="input resize-none"
              />
            </div>
            <div className="col-span-2 flex items-center gap-2">
              <input
                type="checkbox"
                id="remote"
                checked={form.remote}
                onChange={e => setForm(p => ({ ...p, remote: e.target.checked }))}
                className="w-4 h-4 text-blue-600"
              />
              <label htmlFor="remote" className="text-sm text-gray-700">Remote position</label>
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={addJob} disabled={addLoading} className="btn btn-primary">
              {addLoading
                ? <Loader2 className="w-4 h-4 animate-spin" />
                : <Plus className="w-4 h-4" />
              }
              Add Job
            </button>
            <button onClick={() => setShowAdd(false)} className="btn btn-secondary">
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* ── Filter bar ───────────────────────────────────────── */}
      <div className="flex gap-2 flex-wrap">
        {['', 'new', 'saved', 'applied', 'ignored'].map(s => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={cn(
              'btn btn-sm capitalize',
              statusFilter === s ? 'btn-primary' : 'btn-secondary'
            )}
          >
            {s || 'All'} {s === '' && `(${jobs.length})`}
          </button>
        ))}
      </div>

      {/* ── Jobs list + detail panel ──────────────────────────── */}
      <div className="flex gap-6">

        {/* Jobs list */}
        <div className="flex-1 min-w-0 space-y-2">
          {loading ? (
            [...Array(5)].map((_, i) => (
              <div key={i} className="card card-body">
                <div className="skeleton h-4 w-2/3 mb-2" />
                <div className="skeleton h-3 w-1/3" />
              </div>
            ))
          ) : jobs.length === 0 ? (
            <div className="card card-body text-center py-12">
              <Linkedin className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500 font-medium">No LinkedIn jobs yet</p>
              <p className="text-gray-400 text-sm mt-1 mb-4">
                Click <strong>Fetch from LinkedIn</strong> to auto-import jobs
              </p>
              <button
                onClick={handleFetchAlerts}
                disabled={fetchLoading}
                className="btn btn-primary btn-sm mx-auto"
              >
                {fetchLoading
                  ? <><Loader2 className="w-4 h-4 animate-spin" /> Fetching...</>
                  : <><RefreshCw className="w-4 h-4" /> Fetch Now</>
                }
              </button>
            </div>
          ) : (
            jobs.map(job => (
              <div
                key={job._id}
                onClick={() => setSelected(job)}
                className={cn(
                  'card card-body cursor-pointer hover:border-blue-300 hover:shadow-md transition-all',
                  selected?._id === job._id ? 'border-blue-400 bg-blue-50/30 shadow-md' : ''
                )}
              >
                <div className="flex items-start gap-3">
                  {/* Company avatar */}
                  <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center text-blue-700 font-bold text-sm flex-shrink-0">
                    {job.company?.[0]?.toUpperCase() || 'L'}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <h3 className="font-semibold text-gray-900 text-sm truncate">
                          {job.title}
                        </h3>
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
                            <span className="badge badge-green text-xs">Remote</span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 flex-shrink-0">
                        {job.matchScore > 0 && (
                          <div className={cn(
                            'flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold',
                            job.matchScore >= 75 ? 'bg-green-100 text-green-800' :
                            job.matchScore >= 50 ? 'bg-amber-100 text-amber-800' :
                                                   'bg-gray-100 text-gray-600'
                          )}>
                            <Star className="w-3 h-3" />
                            {job.matchScore}%
                          </div>
                        )}
                        <span className={cn('badge text-xs', STATUS_STYLES[job.status])}>
                          {job.status}
                        </span>
                        {job.recruiterEmail && (
                          <span className="badge badge-green text-xs flex items-center gap-1">
                            <Mail className="w-3 h-3" /> HR
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 mt-1.5">
                      <span className="text-xs text-gray-400">{job.source?.replace(/_/g, ' ')}</span>
                      {job.salary && (
                        <span className="text-xs text-gray-500">· {job.salary}</span>
                      )}
                      <span className="text-xs text-gray-400">· {fAgo(job.createdAt)}</span>
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* ── Detail panel ─────────────────────────────────── */}
        {selected && (
          <div className="w-96 flex-shrink-0">
            <div
              className="card sticky top-0 overflow-y-auto"
              style={{ maxHeight: 'calc(100vh - 2rem)' }}
            >
              <div className="card-header flex items-center justify-between">
                <h3 className="font-semibold text-gray-900 text-sm">Job Details</h3>
                <button
                  onClick={() => setSelected(null)}
                  className="w-6 h-6 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-400 hover:text-gray-600"
                >
                  ×
                </button>
              </div>

              <div className="p-4 space-y-4">

                {/* Title & meta */}
                <div>
                  <h2 className="font-bold text-gray-900 text-lg leading-tight">
                    {selected.title}
                  </h2>
                  <p className="text-gray-600 text-sm mt-0.5 font-medium">{selected.company}</p>
                  {selected.location && (
                    <p className="text-gray-500 text-xs mt-0.5 flex items-center gap-1">
                      <MapPin className="w-3 h-3" /> {selected.location}
                    </p>
                  )}
                  <div className="flex items-center gap-2 mt-2 flex-wrap">
                    {selected.remote && <span className="badge badge-green text-xs">Remote</span>}
                    {selected.salary && (
                      <span className="badge badge-gray text-xs">{selected.salary}</span>
                    )}
                    <span className={cn('badge text-xs', STATUS_STYLES[selected.status])}>
                      {selected.status}
                    </span>
                    {selected.matchScore > 0 && (
                      <span className={cn(
                        'badge text-xs',
                        selected.matchScore >= 75 ? 'badge-green' :
                        selected.matchScore >= 50 ? 'badge-amber' : 'badge-gray'
                      )}>
                        <Star className="w-3 h-3 mr-1" />
                        {selected.matchScore}% match
                      </span>
                    )}
                  </div>
                </div>

                {/* HR Contact */}
                {selected.recruiterEmail ? (
                  <div className="bg-green-50 border border-green-200 rounded-xl p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-semibold text-green-700 uppercase tracking-wide">
                        HR Contact Found ✓
                      </p>
                    </div>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-semibold text-green-900">
                          {selected.recruiterName || 'HR Contact'}
                        </p>
                        <p className="text-sm text-blue-600 font-mono">{selected.recruiterEmail}</p>
                      </div>
                      <button
                        onClick={() => copy(selected.recruiterEmail)}
                        className="p-1.5 text-gray-400 hover:text-gray-600"
                      >
                        {copied === selected.recruiterEmail
                          ? <Check className="w-4 h-4 text-green-500" />
                          : <Copy className="w-4 h-4" />
                        }
                      </button>
                    </div>
                    {selected.recruiterLinkedIn && (
                      <a
                        href={selected.recruiterLinkedIn}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700"
                      >
                        <Linkedin className="w-3 h-3" /> HR LinkedIn Profile
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
                        ? <><Loader2 className="w-4 h-4 animate-spin" /> Finding...</>
                        : <><Search className="w-4 h-4" /> Find HR + Employees</>
                      }
                      {!isPro && (
                        <span className="badge badge-amber text-xs ml-1">Pro</span>
                      )}
                    </button>
                  </div>
                )}

                {/* Employees */}
                {selected.employees?.length > 0 && (
                  <div>
                    <h4 className="text-sm font-semibold text-gray-900 mb-2 flex items-center gap-1">
                      <Users className="w-4 h-4" />
                      Employees ({selected.employees.length})
                    </h4>
                    <div className="space-y-2">
                      {selected.employees.map((emp, i) => (
                        <div key={i} className="flex items-center gap-2 p-2 bg-gray-50 rounded-lg">
                          <div className="w-7 h-7 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 text-xs font-bold flex-shrink-0">
                            {emp.name?.[0]?.toUpperCase() || '?'}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium text-gray-900 truncate">{emp.name}</p>
                            <p className="text-xs text-gray-500 truncate">{emp.title}</p>
                          </div>
                          <div className="flex gap-1 flex-shrink-0">
                            {emp.linkedin && (
                              <a
                                href={emp.linkedin}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="p-1 text-blue-600 hover:text-blue-700"
                                title="LinkedIn"
                              >
                                <Linkedin className="w-3.5 h-3.5" />
                              </a>
                            )}
                            {emp.email && (
                              <button
                                onClick={() => copy(emp.email)}
                                className="p-1 text-gray-400 hover:text-gray-600"
                                title={emp.email}
                              >
                                {copied === emp.email
                                  ? <Check className="w-3.5 h-3.5 text-green-500" />
                                  : <Copy className="w-3.5 h-3.5" />
                                }
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
                    <p className="text-xs text-gray-600 leading-relaxed line-clamp-6">
                      {selected.description}
                    </p>
                  </div>
                )}

                {/* Status tracker */}
                <div>
                  <h4 className="text-sm font-semibold text-gray-900 mb-2">Update Status</h4>
                  <div className="grid grid-cols-2 gap-1.5">
                    {['new', 'saved', 'applied', 'ignored'].map(s => (
                      <button
                        key={s}
                        onClick={() => updateStatus(selected._id, s)}
                        className={cn(
                          'py-1.5 px-2 rounded-lg text-xs font-medium border capitalize transition-colors',
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
                <div className="flex flex-col gap-2">
                  {selected.url && (
                    <a
                      href={selected.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn btn-primary w-full justify-center"
                    >
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
                      <Mail className="w-4 h-4" /> Send Outreach Email
                    </button>
                  )}

                  {!selected.recruiterEmail && (
                    <button
                      onClick={() => findHR(selected._id)}
                      disabled={finding === selected._id}
                      className="btn btn-secondary w-full justify-center"
                    >
                      {finding === selected._id
                        ? <><Loader2 className="w-4 h-4 animate-spin" /> Finding HR...</>
                        : <><Users className="w-4 h-4" /> Find HR + Employees</>
                      }
                      {!isPro && <span className="badge badge-amber text-xs ml-1">Pro</span>}
                    </button>
                  )}

                  <button
                    onClick={() => deleteJob(selected._id)}
                    className="btn btn-danger w-full justify-center"
                  >
                    <Trash2 className="w-4 h-4" /> Delete Job
                  </button>
                </div>

              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function GmailAlertSection({ onFetched }) {
  const toast = useToast();
  const [status,       setStatus]       = useState(null);
  const [fetchLoading, setFetchLoading] = useState(false);
  const [fetchResult,  setFetchResult]  = useState(null);

  useEffect(() => {
    api.get('/linkedin/gmail/status')
      .then(r => setStatus(r.data.data))
      .catch(() => setStatus({ connected: false }));

    // Check URL params for callback result
    const params = new URLSearchParams(window.location.search);
    if (params.get('gmail') === 'connected') {
      toast.success('Gmail connected successfully!');
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
      setStatus({ connected: false });
      toast.success('Gmail disconnected');
    } catch { toast.error('Failed'); }
  };

  const fetchFromGmail = async () => {
    setFetchLoading(true);
    setFetchResult(null);
    try {
      const { data } = await api.post('/linkedin/gmail/fetch');
      setFetchResult(data.data);
      if (data.data.saved > 0) {
        toast.success(`Fetched ${data.data.saved} jobs from your Gmail!`);
        onFetched();
      } else {
        toast.info('No new LinkedIn alert emails found');
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Fetch failed');
    } finally {
      setFetchLoading(false);
    }
  };

  return (
    <div className={cn(
      'card card-body border-2',
      status?.connected ? 'border-green-200 bg-green-50' : 'border-dashed border-gray-300'
    )}>
      <div className="flex items-start gap-3">
        <div className={cn(
          'w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0',
          status?.connected ? 'bg-green-100' : 'bg-gray-100'
        )}>
          <Mail className={cn('w-5 h-5', status?.connected ? 'text-green-600' : 'text-gray-400')} />
        </div>
        <div className="flex-1">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <h3 className="font-semibold text-gray-900">
                Fetch Jobs from Gmail Alerts
                {status?.connected && (
                  <span className="badge badge-green text-xs ml-2">Connected</span>
                )}
              </h3>
              <p className="text-sm text-gray-500 mt-0.5">
                {status?.connected
                  ? `Connected: ${status.email} — auto-parses your LinkedIn alert emails`
                  : 'Connect Gmail to auto-import jobs from your LinkedIn alert emails'
                }
              </p>
            </div>
            <div className="flex gap-2 flex-shrink-0">
              {status?.connected ? (
                <>
                  <button
                    onClick={fetchFromGmail}
                    disabled={fetchLoading}
                    className="btn btn-primary btn-sm"
                  >
                    {fetchLoading
                      ? <><Loader2 className="w-4 h-4 animate-spin" /> Fetching...</>
                      : <><Mail className="w-4 h-4" /> Fetch from Gmail</>
                    }
                  </button>
                  <button onClick={disconnect} className="btn btn-danger btn-sm">
                    Disconnect
                  </button>
                </>
              ) : (
                <button onClick={connectGmail} className="btn btn-primary btn-sm">
                  <Mail className="w-4 h-4" /> Connect Gmail
                </button>
              )}
            </div>
          </div>

          {/* Fetch result */}
          {fetchResult && (
            <div className="mt-3 p-3 bg-white rounded-xl border border-green-200">
              {fetchResult.saved > 0 ? (
                <p className="text-sm text-green-700">
                  ✅ <strong>{fetchResult.saved}</strong> new jobs ·
                  <strong> {fetchResult.emailsFound}</strong> HR emails ·
                  <strong> {fetchResult.employeesFound}</strong> employees found
                </p>
              ) : (
                <p className="text-sm text-amber-700">
                  No new jobs found. {fetchResult.fetched > 0 ? `(${fetchResult.fetched} already saved)` : 'Check your LinkedIn email alerts are set up.'}
                </p>
              )}
            </div>
          )}

          {/* How it works */}
          {!status?.connected && (
            <div className="mt-3 grid grid-cols-3 gap-2 text-xs text-gray-500">
              <div className="flex items-start gap-1">
                <span className="font-bold text-blue-500">1.</span>
                Connect your Gmail account
              </div>
              <div className="flex items-start gap-1">
                <span className="font-bold text-blue-500">2.</span>
                We read LinkedIn alert emails only
              </div>
              <div className="flex items-start gap-1">
                <span className="font-bold text-blue-500">3.</span>
                Jobs + HR emails auto-imported
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}