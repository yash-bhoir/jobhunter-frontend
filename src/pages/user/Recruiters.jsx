import { useState, useEffect, useCallback } from 'react';
import {
  Users, Search, Mail, ExternalLink, Loader2,
  Copy, CheckCheck, Building, Linkedin, Clock,
  ChevronRight, RefreshCw, History, Trash2
} from 'lucide-react';
import { api }      from '@utils/axios';
import { useToast } from '@hooks/useToast';
import { cn }       from '@utils/helpers';
import { fAgo }     from '@utils/formatters';

// ── helpers ───────────────────────────────────────────────────────
const confidenceColor = (score) =>
  score >= 70 ? 'badge-green' : score >= 40 ? 'badge-amber' : 'badge-gray';

const sourceLabel = (src) =>
  src === 'hunter' ? '✓ Hunter.io' :
  src === 'apollo' ? '✓ Apollo.io' : 'Pattern';

const sourceBadge = (src) =>
  src === 'hunter' ? 'badge-green' :
  src === 'apollo' ? 'badge-blue'  : 'badge-gray';

export default function Recruiters() {
  const toast = useToast();

  // ── lookup state ─────────────────────────────────────────────────
  const [company,  setCompany]  = useState('');
  const [loading,  setLoading]  = useState(false);
  const [result,   setResult]   = useState(null);
  const [copied,   setCopied]   = useState('');

  // ── history state ─────────────────────────────────────────────────
  const [history,      setHistory]      = useState([]);
  const [histLoading,  setHistLoading]  = useState(true);
  const [histPage,     setHistPage]     = useState(1);
  const [histTotal,    setHistTotal]    = useState(0);
  const [histSearch,   setHistSearch]   = useState('');
  const [selected,     setSelected]     = useState(null); // selected history entry

  const HIST_LIMIT = 15;

  // ── fetch history ─────────────────────────────────────────────────
  const fetchHistory = useCallback(async (page = 1) => {
    setHistLoading(true);
    try {
      const { data } = await api.get(`/recruiters?page=${page}&limit=${HIST_LIMIT}`);
      const rows = data.data || [];

      // Deduplicate by company — keep highest confidence per company
      const companyMap = {};
      for (const job of rows) {
        const key = job.company?.toLowerCase();
        if (!companyMap[key] || (job.recruiterConfidence || 0) > (companyMap[key].recruiterConfidence || 0)) {
          companyMap[key] = job;
        }
      }

      if (page === 1) {
        setHistory(Object.values(companyMap));
      } else {
        setHistory(prev => {
          const merged = [...prev, ...Object.values(companyMap)];
          const seen   = new Set();
          return merged.filter(j => {
            const k = j.company?.toLowerCase();
            if (seen.has(k)) return false;
            seen.add(k);
            return true;
          });
        });
      }

      setHistTotal(data.pagination?.total || 0);
      setHistPage(page);
    } catch {
      // silently fail — history is non-critical
    } finally {
      setHistLoading(false);
    }
  }, []);

  useEffect(() => { fetchHistory(1); }, [fetchHistory]);

  // ── lookup ────────────────────────────────────────────────────────
  const handleLookup = async (usePattern = false) => {
    if (!company.trim()) { toast.error('Enter a company name'); return; }
    setLoading(true);
    setResult(null);
    setSelected(null);
    try {
      const endpoint = usePattern ? '/recruiters/pattern' : '/recruiters/lookup';
      const { data } = await api.post(endpoint, { company: company.trim() });
      setResult({ ...data.data, lookedUpAt: new Date() });
      // Refresh history to include new result
      setTimeout(() => fetchHistory(1), 800);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Lookup failed');
    } finally {
      setLoading(false);
    }
  };

  const copyEmail = async (email) => {
    await navigator.clipboard.writeText(email);
    setCopied(email);
    setTimeout(() => setCopied(''), 2000);
    toast.success('Copied!');
  };

  // ── select from history ───────────────────────────────────────────
  const openHistory = (entry) => {
    setSelected(entry);
    setResult(null);
    setCompany(entry.company);
  };

  const deleteHistory = async (e, entry) => {
    e.stopPropagation();
    if (!entry._fromLookup) {
      toast.error('Job-linked contacts can only be removed by deleting the job');
      return;
    }
    try {
      await api.delete(`/recruiters/lookup-history/${entry._id}`);
      setHistory(prev => prev.filter(h => h._id !== entry._id));
      if (selected?._id === entry._id) { setSelected(null); setResult(null); }
      toast.success('Removed from history');
    } catch {
      toast.error('Failed to remove');
    }
  };

  // ── filtered history ──────────────────────────────────────────────
  const filteredHistory = history.filter(h =>
    !histSearch ||
    h.company?.toLowerCase().includes(histSearch.toLowerCase()) ||
    h.recruiterEmail?.toLowerCase().includes(histSearch.toLowerCase())
  );

  // ── active display (lookup result OR history entry) ───────────────
  const display = result || (selected
    ? {
        company:        selected.company,
        source:         selected.recruiterSource || selected.source,
        domain:         selected.domain || null,
        careerPageUrl:  selected.careerPageUrl,
        linkedinUrl:    selected.linkedinUrl,
        employeeSearch: selected.employeeSearch,
        // Use allEmails from lookup records when available, else build from single-contact fields
        emails: selected.allEmails?.length > 0
          ? selected.allEmails
          : selected.recruiterEmail ? [{
              email:      selected.recruiterEmail,
              name:       selected.recruiterName,
              confidence: selected.recruiterConfidence,
              linkedin:   selected.recruiterLinkedIn,
            }]
          : [],
      }
    : null);

  return (
    <div className="flex gap-6 max-w-6xl mx-auto">

      {/* ── LEFT — search + result ──────────────────────────────── */}
      <div className="flex-1 min-w-0 space-y-5">

        <div>
          <h1 className="text-2xl font-bold text-gray-900">HR Contact Finder</h1>
          <p className="text-gray-500 mt-1 text-sm">
            Find verified HR emails and recruiter contacts at any company
          </p>
        </div>

        {/* Lookup form */}
        <div className="card card-body space-y-4">
          <div>
            <label className="label">Company Name</label>
            <div className="relative">
              <Building className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={company}
                onChange={e => setCompany(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleLookup(false)}
                placeholder="e.g. Infosys, Razorpay, Swiggy"
                className="input pl-9"
              />
            </div>
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => handleLookup(false)}
              disabled={loading}
              className="btn btn-primary flex-1"
            >
              {loading
                ? <Loader2 className="w-4 h-4 animate-spin" />
                : <Search className="w-4 h-4" />
              }
              Find HR Emails
              <span className="badge bg-white/20 text-white text-xs ml-1">15 credits</span>
            </button>
            <button
              onClick={() => handleLookup(true)}
              disabled={loading}
              className="btn btn-secondary"
            >
              Pattern Only
              <span className="badge badge-green text-xs ml-1">Free</span>
            </button>
          </div>
        </div>

        {/* Loading skeleton */}
        {loading && (
          <div className="card card-body space-y-3">
            <div className="skeleton h-5 w-1/2" />
            <div className="skeleton h-3 w-1/4" />
            <div className="skeleton h-12 w-full mt-2" />
            <div className="skeleton h-12 w-full" />
          </div>
        )}

        {/* Result / selected history display */}
        {!loading && display && (
          <div className="space-y-4">

            {/* Header */}
            <div className="card card-body">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="font-semibold text-gray-900">{display.company}</h2>
                  {display.domain && (
                    <p className="text-sm text-gray-500">{display.domain}</p>
                  )}
                </div>
                <div className="flex gap-2 flex-wrap justify-end">
                  {display.source && (
                    <span className={cn('badge', sourceBadge(display.source))}>
                      {sourceLabel(display.source)}
                    </span>
                  )}
                  <span className="badge badge-gray">
                    {display.emails?.length || 0} email{display.emails?.length !== 1 ? 's' : ''}
                  </span>
                  {result && (
                    <span className="badge badge-green text-xs flex items-center gap-1">
                      <Clock className="w-3 h-3" /> Just now
                    </span>
                  )}
                </div>
              </div>

              {/* Action links */}
              {(display.careerPageUrl || display.linkedinUrl || display.employeeSearch) && (
                <div className="flex gap-2 flex-wrap mt-3">
                  {display.careerPageUrl && (
                    <a href={display.careerPageUrl} target="_blank" rel="noopener noreferrer"
                      className="btn btn-secondary btn-sm">
                      <ExternalLink className="w-3 h-3" /> Careers Page
                    </a>
                  )}
                  {display.linkedinUrl && (
                    <a href={display.linkedinUrl} target="_blank" rel="noopener noreferrer"
                      className="btn btn-secondary btn-sm">
                      <Linkedin className="w-3 h-3" /> LinkedIn
                    </a>
                  )}
                  {display.employeeSearch && (
                    <a href={display.employeeSearch} target="_blank" rel="noopener noreferrer"
                      className="btn btn-secondary btn-sm">
                      <Users className="w-3 h-3" /> Find Employees
                    </a>
                  )}
                </div>
              )}
            </div>

            {/* Emails list */}
            {display.emails?.length > 0 ? (
              <div className="card">
                <div className="card-header">
                  <h3 className="font-semibold text-gray-900">HR Email Contacts</h3>
                </div>
                <div className="divide-y divide-gray-100">
                  {display.emails.map((email, i) => (
                    <div key={i} className="p-4 flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-semibold text-sm flex-shrink-0">
                        {email.name?.[0]?.toUpperCase() || 'H'}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-gray-900 text-sm">{email.name || 'HR Contact'}</p>
                        <p className="text-blue-600 text-sm truncate font-mono">{email.email}</p>
                        {email.title && (
                          <p className="text-xs text-gray-400">{email.title}</p>
                        )}
                        {email.linkedin && (
                          <a href={email.linkedin} target="_blank" rel="noopener noreferrer"
                            className="text-xs text-blue-500 hover:underline flex items-center gap-1 mt-0.5">
                            <Linkedin className="w-3 h-3" /> View LinkedIn
                          </a>
                        )}
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span className={cn('badge text-xs', confidenceColor(email.confidence || 0))}>
                          {email.confidence || 0}%
                        </span>
                        <button
                          onClick={() => copyEmail(email.email)}
                          className="btn btn-secondary btn-sm p-1.5"
                          title="Copy email"
                        >
                          {copied === email.email
                            ? <CheckCheck className="w-4 h-4 text-green-600" />
                            : <Copy className="w-4 h-4" />
                          }
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="card card-body text-center py-8">
                <Mail className="w-10 h-10 text-gray-300 mx-auto mb-2" />
                <p className="text-gray-500 text-sm">No email contacts found for this company</p>
                {display.source === 'pattern' && (
                  <p className="text-xs text-gray-400 mt-1">
                    Upgrade to Pro for verified Hunter.io emails
                  </p>
                )}
              </div>
            )}

            {/* Pattern disclaimer */}
            {display.source === 'pattern' && (
              <div className="card card-body bg-amber-50 border-amber-200">
                <p className="text-sm text-amber-700">
                  <strong>Note:</strong> Pattern-generated emails (hr@, careers@).
                  Upgrade to Pro for verified Hunter.io emails.
                </p>
              </div>
            )}
          </div>
        )}

        {/* Empty state / tips */}
        {!loading && !display && (
          <div className="card card-body bg-blue-50 border-blue-100">
            <h3 className="text-sm font-semibold text-blue-800 mb-2">💡 How it works</h3>
            <ul className="text-sm text-blue-700 space-y-1.5">
              <li>• <strong>Pattern emails</strong> — generates common HR emails (hr@, careers@) — free</li>
              <li>• <strong>Pro lookup</strong> — searches Hunter.io for verified, real HR emails (15 credits)</li>
              <li>• All contacts you find are saved to history automatically</li>
              <li>• Click any history entry to view their contact details again</li>
            </ul>
          </div>
        )}
      </div>

      {/* ── RIGHT — history panel ────────────────────────────────── */}
      <div className="w-80 flex-shrink-0">
        <div className="card sticky top-0" style={{ maxHeight: 'calc(100vh - 2rem)', display: 'flex', flexDirection: 'column' }}>

          {/* Header */}
          <div className="card-header flex items-center justify-between flex-shrink-0">
            <div className="flex items-center gap-2">
              <History className="w-4 h-4 text-gray-500" />
              <h3 className="font-semibold text-gray-900 text-sm">Recruiter History</h3>
              {histTotal > 0 && (
                <span className="badge badge-blue text-xs">{histTotal}</span>
              )}
            </div>
            <button
              onClick={() => fetchHistory(1)}
              disabled={histLoading}
              className="btn btn-ghost btn-sm p-1"
              title="Refresh"
            >
              <RefreshCw className={cn('w-3.5 h-3.5', histLoading && 'animate-spin')} />
            </button>
          </div>

          {/* Search history */}
          <div className="p-3 border-b border-gray-100 flex-shrink-0">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
              <input
                type="text"
                value={histSearch}
                onChange={e => setHistSearch(e.target.value)}
                placeholder="Filter companies..."
                className="input pl-8 py-1.5 text-xs"
              />
            </div>
          </div>

          {/* List */}
          <div className="overflow-y-auto flex-1">
            {histLoading && history.length === 0 ? (
              <div className="p-4 space-y-3">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <div className="skeleton w-8 h-8 rounded-full" />
                    <div className="flex-1 space-y-1">
                      <div className="skeleton h-3 w-2/3" />
                      <div className="skeleton h-2.5 w-1/2" />
                    </div>
                  </div>
                ))}
              </div>
            ) : filteredHistory.length === 0 ? (
              <div className="p-6 text-center">
                <Users className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                <p className="text-xs text-gray-400">
                  {histSearch
                    ? 'No matches found'
                    : 'No recruiter contacts yet. Run a search or do a manual lookup.'
                  }
                </p>
              </div>
            ) : (
              <div className="divide-y divide-gray-50">
                {filteredHistory.map((entry) => (
                  <div
                    key={entry._id}
                    onClick={() => openHistory(entry)}
                    className={cn(
                      'w-full text-left p-3 hover:bg-gray-50 transition-colors flex items-center gap-2.5 cursor-pointer group/entry',
                      selected?._id === entry._id && !result ? 'bg-blue-50 border-l-2 border-blue-500' : ''
                    )}
                  >
                    {/* Avatar */}
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-100 to-indigo-100 flex items-center justify-center text-blue-600 font-bold text-xs flex-shrink-0">
                      {entry.company?.[0]?.toUpperCase() || '?'}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1">
                        <p className="text-sm font-medium text-gray-900 truncate">{entry.company}</p>
                        {entry._fromLookup && (
                          <span className="badge badge-blue text-xs py-0 flex-shrink-0">Manual</span>
                        )}
                      </div>
                      {(entry.recruiterEmail || entry.email) ? (
                        <p className="text-xs text-blue-600 truncate font-mono">
                          {entry.recruiterEmail || entry.email}
                        </p>
                      ) : (
                        <p className="text-xs text-gray-400">No email found</p>
                      )}
                      <div className="flex items-center gap-1.5 mt-0.5">
                        {(entry.recruiterSource || entry.source) && (
                          <span className={cn('badge text-xs py-0', sourceBadge(entry.recruiterSource || entry.source))}>
                            {sourceLabel(entry.recruiterSource || entry.source)}
                          </span>
                        )}
                        {(entry.recruiterConfidence || entry.confidence) > 0 && (
                          <span className={cn('badge text-xs py-0', confidenceColor(entry.recruiterConfidence || entry.confidence))}>
                            {entry.recruiterConfidence || entry.confidence}%
                          </span>
                        )}
                        {entry.createdAt && (
                          <span className="text-xs text-gray-400 truncate">
                            {fAgo(entry.createdAt)}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-1 flex-shrink-0">
                      {entry._fromLookup && (
                        <button
                          onClick={(e) => deleteHistory(e, entry)}
                          className="p-1 rounded hover:bg-red-100 text-gray-300 hover:text-red-500 transition-colors opacity-0 group-hover/entry:opacity-100"
                          title="Remove from history"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      )}
                      <ChevronRight className="w-3.5 h-3.5 text-gray-300" />
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Load more */}
            {filteredHistory.length < histTotal && !histSearch && (
              <div className="p-3 border-t border-gray-100">
                <button
                  onClick={() => fetchHistory(histPage + 1)}
                  disabled={histLoading}
                  className="btn btn-secondary btn-sm w-full justify-center text-xs"
                >
                  {histLoading
                    ? <Loader2 className="w-3 h-3 animate-spin" />
                    : `Load more (${histTotal - filteredHistory.length} left)`
                  }
                </button>
              </div>
            )}
          </div>

          {/* Footer stats */}
          {history.length > 0 && (
            <div className="p-3 border-t border-gray-100 bg-gray-50 flex-shrink-0">
              <div className="grid grid-cols-2 gap-2 text-center">
                <div>
                  <p className="text-sm font-bold text-gray-900">{histTotal}</p>
                  <p className="text-xs text-gray-500">Total Contacts</p>
                </div>
                <div>
                  <p className="text-sm font-bold text-green-600">
                    {history.filter(h => h.recruiterSource === 'hunter' || h.recruiterSource === 'apollo').length}
                  </p>
                  <p className="text-xs text-gray-500">Verified</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
