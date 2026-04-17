import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Users, Search, Mail, ExternalLink, Loader2,
  Copy, CheckCheck, Building, Linkedin, Clock,
  ChevronRight, RefreshCw, History, Trash2, Sparkles, X
} from 'lucide-react';
import { api }      from '@utils/axios';
import { useToast } from '@hooks/useToast';
import { cn }       from '@utils/helpers';
import { fAgo }     from '@utils/formatters';

const confidenceColor = (score) =>
  score >= 70 ? 'bg-emerald-100 text-emerald-700' :
  score >= 40 ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-600';

const sourceLabel = (src) =>
  src === 'hunter' ? 'Hunter.io' : src === 'apollo' ? 'Apollo.io' : 'Pattern';

const sourceCls = (src) =>
  src === 'hunter' ? 'bg-emerald-100 text-emerald-700' :
  src === 'apollo' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600';

const fadeUp = {
  hidden: { opacity: 0, y: 12 },
  show:   { opacity: 1, y: 0, transition: { duration: 0.35 } },
};
const stagger = { show: { transition: { staggerChildren: 0.06 } } };

export default function Recruiters() {
  const toast = useToast();
  const [company,     setCompany]     = useState('');
  const [loading,     setLoading]     = useState(false);
  const [result,      setResult]      = useState(null);
  const [copied,      setCopied]      = useState('');
  const [history,     setHistory]     = useState([]);
  const [histLoading, setHistLoading] = useState(true);
  const [histPage,    setHistPage]    = useState(1);
  const [histTotal,   setHistTotal]   = useState(0);
  const [histSearch,  setHistSearch]  = useState('');
  const [selected,    setSelected]    = useState(null);
  const [historyOpen, setHistoryOpen] = useState(false);

  const HIST_LIMIT = 15;

  const fetchHistory = useCallback(async (page = 1) => {
    setHistLoading(true);
    try {
      const { data } = await api.get(`/recruiters?page=${page}&limit=${HIST_LIMIT}`);
      const rows = data.data || [];
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
          const seen = new Set();
          return merged.filter(j => { const k = j.company?.toLowerCase(); if (seen.has(k)) return false; seen.add(k); return true; });
        });
      }
      setHistTotal(data.pagination?.total || 0);
      setHistPage(page);
    } catch {} finally { setHistLoading(false); }
  }, []);

  useEffect(() => { fetchHistory(1); }, [fetchHistory]);

  const handleLookup = async (usePattern = false) => {
    if (!company.trim()) { toast.error('Enter a company name'); return; }
    setLoading(true); setResult(null); setSelected(null);
    try {
      const endpoint = usePattern ? '/recruiters/pattern' : '/recruiters/lookup';
      const { data } = await api.post(endpoint, { company: company.trim() });
      setResult({ ...data.data, lookedUpAt: new Date() });
      setTimeout(() => fetchHistory(1), 800);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Lookup failed');
    } finally { setLoading(false); }
  };

  const copyEmail = async (email) => {
    await navigator.clipboard.writeText(email);
    setCopied(email); setTimeout(() => setCopied(''), 2000);
    toast.success('Copied!');
  };

  const openHistory = (entry) => {
    setSelected(entry); setResult(null); setCompany(entry.company);
  };

  const deleteHistory = async (e, entry) => {
    e.stopPropagation();
    if (!entry._fromLookup) { toast.error('Job-linked contacts can only be removed by deleting the job'); return; }
    try {
      await api.delete(`/recruiters/lookup-history/${entry._id}`);
      setHistory(prev => prev.filter(h => h._id !== entry._id));
      if (selected?._id === entry._id) { setSelected(null); setResult(null); }
      toast.success('Removed from history');
    } catch { toast.error('Failed to remove'); }
  };

  const filteredHistory = history.filter(h =>
    !histSearch ||
    h.company?.toLowerCase().includes(histSearch.toLowerCase()) ||
    h.recruiterEmail?.toLowerCase().includes(histSearch.toLowerCase())
  );

  const display = result || (selected ? {
    company:        selected.company,
    source:         selected.recruiterSource || selected.source,
    domain:         selected.domain || null,
    careerPageUrl:  selected.careerPageUrl,
    linkedinUrl:    selected.linkedinUrl,
    employeeSearch: selected.employeeSearch,
    emails: selected.allEmails?.length > 0
      ? selected.allEmails
      : selected.recruiterEmail ? [{ email: selected.recruiterEmail, name: selected.recruiterName, confidence: selected.recruiterConfidence, linkedin: selected.recruiterLinkedIn }]
      : [],
  } : null);

  return (
    <motion.div variants={stagger} initial="hidden" animate="show" className="flex gap-5">

      {/* Mobile history overlay */}
      {historyOpen && (
        <div className="fixed inset-0 bg-black/40 z-40 lg:hidden" onClick={() => setHistoryOpen(false)} />
      )}

      {/* ── LEFT ─────────────────────────────────────────────── */}
      <div className="flex-1 min-w-0 space-y-4">

        <motion.div variants={fadeUp} className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold text-gray-900">HR Contact Finder</h1>
            <p className="text-sm text-gray-400 mt-0.5">Find verified HR emails at any company</p>
          </div>
          <button
            onClick={() => setHistoryOpen(true)}
            className="lg:hidden flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors flex-shrink-0"
          >
            <History className="w-4 h-4 text-gray-400" />
            History
            {histTotal > 0 && <span className="text-xs bg-blue-100 text-blue-700 font-semibold px-1.5 py-0.5 rounded-full">{histTotal}</span>}
          </button>
        </motion.div>

        {/* Lookup card */}
        <motion.div
          variants={fadeUp}
          className="bg-white rounded-2xl border border-gray-100 overflow-hidden"
          style={{ boxShadow: '0 4px 24px -4px rgba(0,0,0,0.08)' }}
        >
          <div className="h-0.5 w-full bg-gradient-to-r from-blue-500 via-violet-500 to-indigo-500" />
          <div className="p-5 space-y-4">
            <div className="relative">
              <Building className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={company}
                onChange={e => setCompany(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleLookup(false)}
                placeholder="Company name — e.g. Infosys, Razorpay"
                className="input pl-10 py-3 rounded-xl text-sm"
              />
            </div>
            <div className="flex gap-2">
              <motion.button
                onClick={() => handleLookup(false)}
                disabled={loading}
                whileHover={{ scale: loading ? 1 : 1.01 }}
                whileTap={{ scale: loading ? 1 : 0.99 }}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white flex items-center justify-center gap-2"
                style={{ background: loading ? '#93c5fd' : 'linear-gradient(135deg, #2563eb 0%, #7c3aed 100%)' }}
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                Find HR Emails
                <span className="text-xs bg-white/20 px-2 py-0.5 rounded-full ml-1">15 cr</span>
              </motion.button>
              <button
                onClick={() => handleLookup(true)}
                disabled={loading}
                className="px-4 py-2.5 rounded-xl text-sm font-semibold text-gray-700 bg-gray-50 hover:bg-gray-100 border border-gray-200 transition-colors flex items-center gap-2"
              >
                Pattern
                <span className="text-xs bg-emerald-100 text-emerald-700 font-semibold px-1.5 py-0.5 rounded-full">Free</span>
              </button>
            </div>
          </div>
        </motion.div>

        {/* Loading */}
        {loading && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="bg-white rounded-2xl border border-gray-100 p-5 space-y-3"
          >
            <div className="skeleton h-5 w-1/2 rounded-lg" />
            <div className="skeleton h-3.5 w-1/3 rounded-lg" />
            <div className="skeleton h-14 w-full rounded-xl mt-2" />
            <div className="skeleton h-14 w-full rounded-xl" />
          </motion.div>
        )}

        {/* Result */}
        <AnimatePresence>
          {!loading && display && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-3"
            >
              {/* Company header */}
              <div className="bg-white rounded-2xl border border-gray-100 p-5" style={{ boxShadow: '0 2px 16px -2px rgba(0,0,0,0.07)' }}>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-blue-100 to-indigo-100 flex items-center justify-center text-blue-700 font-black text-lg flex-shrink-0">
                      {display.company?.[0]?.toUpperCase()}
                    </div>
                    <div>
                      <h2 className="font-bold text-gray-900">{display.company}</h2>
                      {display.domain && <p className="text-sm text-gray-400">{display.domain}</p>}
                    </div>
                  </div>
                  <div className="flex gap-2 flex-wrap justify-end">
                    {display.source && (
                      <span className={cn('text-xs font-semibold px-2 py-1 rounded-full', sourceCls(display.source))}>
                        ✓ {sourceLabel(display.source)}
                      </span>
                    )}
                    <span className="text-xs font-semibold px-2 py-1 rounded-full bg-gray-100 text-gray-600">
                      {display.emails?.length || 0} email{display.emails?.length !== 1 ? 's' : ''}
                    </span>
                    {result && (
                      <span className="text-xs font-semibold px-2 py-1 rounded-full bg-emerald-100 text-emerald-700 flex items-center gap-1">
                        <Clock className="w-3 h-3" /> Just now
                      </span>
                    )}
                  </div>
                </div>
                {(display.careerPageUrl || display.linkedinUrl || display.employeeSearch) && (
                  <div className="flex gap-2 flex-wrap mt-4 pt-4 border-t border-gray-100">
                    {display.careerPageUrl && (
                      <a href={display.careerPageUrl} target="_blank" rel="noopener noreferrer" className="btn btn-secondary btn-sm">
                        <ExternalLink className="w-3 h-3" /> Careers
                      </a>
                    )}
                    {display.linkedinUrl && (
                      <a href={display.linkedinUrl} target="_blank" rel="noopener noreferrer" className="btn btn-secondary btn-sm">
                        <Linkedin className="w-3 h-3" /> LinkedIn
                      </a>
                    )}
                    {display.employeeSearch && (
                      <a href={display.employeeSearch} target="_blank" rel="noopener noreferrer" className="btn btn-secondary btn-sm">
                        <Users className="w-3 h-3" /> Employees
                      </a>
                    )}
                  </div>
                )}
              </div>

              {/* Email contacts */}
              {display.emails?.length > 0 ? (
                <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden" style={{ boxShadow: '0 2px 16px -2px rgba(0,0,0,0.07)' }}>
                  <div className="px-5 py-3.5 border-b border-gray-100">
                    <h3 className="font-semibold text-gray-900 text-sm">HR Email Contacts</h3>
                  </div>
                  <div className="divide-y divide-gray-50">
                    {display.emails.map((email, i) => (
                      <motion.div
                        key={i}
                        initial={{ opacity: 0, x: -8 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.05 }}
                        className="flex items-center gap-3 px-5 py-4"
                      >
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-100 to-indigo-100 flex items-center justify-center text-blue-700 font-bold text-sm flex-shrink-0">
                          {email.name?.[0]?.toUpperCase() || 'H'}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-gray-900 text-sm">{email.name || 'HR Contact'}</p>
                          <p className="text-blue-600 text-sm font-mono truncate">{email.email}</p>
                          {email.title && <p className="text-xs text-gray-400 mt-0.5">{email.title}</p>}
                          {email.linkedin && (
                            <a href={email.linkedin} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-500 hover:underline flex items-center gap-1 mt-0.5">
                              <Linkedin className="w-3 h-3" /> LinkedIn
                            </a>
                          )}
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <span className={cn('text-xs font-semibold px-2 py-0.5 rounded-full', confidenceColor(email.confidence || 0))}>
                            {email.confidence || 0}%
                          </span>
                          <button onClick={() => copyEmail(email.email)} className="p-2 rounded-xl bg-gray-50 hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors border border-gray-200">
                            {copied === email.email ? <CheckCheck className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                          </button>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="bg-white rounded-2xl border border-gray-100 p-10 text-center">
                  <div className="w-12 h-12 rounded-2xl bg-gray-100 flex items-center justify-center mx-auto mb-3">
                    <Mail className="w-5 h-5 text-gray-300" />
                  </div>
                  <p className="text-gray-500 text-sm font-medium">No contacts found</p>
                  <p className="text-xs text-gray-400 mt-1">Try a verified lookup for real emails</p>
                </div>
              )}

              {display.source === 'pattern' && (
                <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4">
                  <p className="text-sm text-amber-700">
                    <strong>Note:</strong> Pattern-generated emails (hr@, careers@). Upgrade to Pro for verified Hunter.io results.
                  </p>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Empty tips */}
        {!loading && !display && (
          <motion.div
            variants={fadeUp}
            className="bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-100 rounded-2xl p-5"
          >
            <div className="flex items-center gap-2 mb-3">
              <Sparkles className="w-4 h-4 text-blue-600" />
              <h3 className="text-sm font-semibold text-blue-800">How it works</h3>
            </div>
            <ul className="text-sm text-blue-700 space-y-2">
              <li className="flex items-start gap-2"><span className="w-5 h-5 rounded-full bg-blue-200 text-blue-700 text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5">1</span>Enter a company name above</li>
              <li className="flex items-start gap-2"><span className="w-5 h-5 rounded-full bg-blue-200 text-blue-700 text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5">2</span><strong>Pattern</strong> generates common HR emails — free</li>
              <li className="flex items-start gap-2"><span className="w-5 h-5 rounded-full bg-blue-200 text-blue-700 text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5">3</span><strong>Find HR Emails</strong> searches Hunter.io for verified contacts (15 cr)</li>
              <li className="flex items-start gap-2"><span className="w-5 h-5 rounded-full bg-blue-200 text-blue-700 text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5">4</span>All contacts auto-saved — click history to view again</li>
            </ul>
          </motion.div>
        )}
      </div>

      {/* ── RIGHT: history ────────────────────────────────────── */}
      <div className={cn(
        'w-72 flex-shrink-0',
        // Mobile: fixed drawer from right; Desktop: static column
        'fixed lg:static inset-y-0 right-0 z-50 lg:z-auto',
        'transition-transform duration-300 ease-in-out',
        historyOpen ? 'translate-x-0' : 'translate-x-full lg:translate-x-0'
      )}>
        <div
          className="bg-white rounded-none lg:rounded-2xl border-l lg:border border-gray-100 h-full lg:h-auto lg:sticky lg:top-0 flex flex-col overflow-hidden w-72"
          style={{ maxHeight: 'calc(100vh - 5rem)', boxShadow: '0 4px 24px -4px rgba(0,0,0,0.08)' }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3.5 border-b border-gray-100 flex-shrink-0">
            <div className="flex items-center gap-2">
              <History className="w-4 h-4 text-gray-400" />
              <p className="font-semibold text-gray-900 text-sm">History</p>
              {histTotal > 0 && (
                <span className="text-xs bg-blue-100 text-blue-700 font-semibold px-2 py-0.5 rounded-full">{histTotal}</span>
              )}
            </div>
            <div className="flex items-center gap-1">
              <button onClick={() => fetchHistory(1)} disabled={histLoading} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 transition-colors">
                <RefreshCw className={cn('w-3.5 h-3.5', histLoading && 'animate-spin')} />
              </button>
              <button onClick={() => setHistoryOpen(false)} className="lg:hidden p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Search */}
          <div className="p-3 border-b border-gray-100 flex-shrink-0">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
              <input
                type="text"
                value={histSearch}
                onChange={e => setHistSearch(e.target.value)}
                placeholder="Filter companies…"
                className="input pl-8 py-1.5 text-xs"
              />
            </div>
          </div>

          {/* List */}
          <div className="overflow-y-auto flex-1">
            {histLoading && history.length === 0 ? (
              <div className="p-4 space-y-3">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="flex items-center gap-2.5">
                    <div className="skeleton w-9 h-9 rounded-xl" />
                    <div className="flex-1 space-y-1">
                      <div className="skeleton h-3.5 w-2/3 rounded" />
                      <div className="skeleton h-2.5 w-1/2 rounded" />
                    </div>
                  </div>
                ))}
              </div>
            ) : filteredHistory.length === 0 ? (
              <div className="p-6 text-center">
                <Users className="w-8 h-8 text-gray-200 mx-auto mb-2" />
                <p className="text-xs text-gray-400">
                  {histSearch ? 'No matches' : 'No contacts yet — run a lookup'}
                </p>
              </div>
            ) : (
              <div className="divide-y divide-gray-50">
                {filteredHistory.map((entry) => (
                  <div
                    key={entry._id}
                    onClick={() => openHistory(entry)}
                    className={cn(
                      'flex items-center gap-2.5 px-3 py-3 hover:bg-gray-50 cursor-pointer transition-colors group/entry',
                      selected?._id === entry._id && !result ? 'bg-blue-50 border-l-2 border-blue-500' : ''
                    )}
                  >
                    <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-100 to-indigo-100 flex items-center justify-center text-blue-700 font-bold text-sm flex-shrink-0">
                      {entry.company?.[0]?.toUpperCase() || '?'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1">
                        <p className="text-sm font-semibold text-gray-900 truncate">{entry.company}</p>
                        {entry._fromLookup && (
                          <span className="text-[10px] bg-blue-100 text-blue-600 font-semibold px-1 py-0.5 rounded flex-shrink-0">Manual</span>
                        )}
                      </div>
                      {(entry.recruiterEmail || entry.email) ? (
                        <p className="text-xs text-blue-600 truncate font-mono">{entry.recruiterEmail || entry.email}</p>
                      ) : (
                        <p className="text-xs text-gray-400">No email</p>
                      )}
                      <div className="flex items-center gap-1 mt-0.5">
                        {(entry.recruiterSource || entry.source) && (
                          <span className={cn('text-[10px] font-semibold px-1.5 py-0.5 rounded-full', sourceCls(entry.recruiterSource || entry.source))}>
                            {sourceLabel(entry.recruiterSource || entry.source)}
                          </span>
                        )}
                        {entry.createdAt && <span className="text-[10px] text-gray-400">{fAgo(entry.createdAt)}</span>}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      {entry._fromLookup && (
                        <button
                          onClick={(e) => deleteHistory(e, entry)}
                          className="p-1 rounded hover:bg-red-100 text-gray-300 hover:text-red-500 transition-colors opacity-0 group-hover/entry:opacity-100"
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

            {filteredHistory.length < histTotal && !histSearch && (
              <div className="p-3 border-t border-gray-100">
                <button
                  onClick={() => fetchHistory(histPage + 1)}
                  disabled={histLoading}
                  className="btn btn-secondary btn-sm w-full justify-center text-xs"
                >
                  {histLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : `Load more (${histTotal - filteredHistory.length})`}
                </button>
              </div>
            )}
          </div>

          {/* Footer stats */}
          {history.length > 0 && (
            <div className="px-4 py-3 border-t border-gray-100 bg-gray-50/50 flex-shrink-0 grid grid-cols-2 gap-2 text-center">
              <div>
                <p className="text-base font-black text-gray-900">{histTotal}</p>
                <p className="text-[11px] text-gray-400">Total</p>
              </div>
              <div>
                <p className="text-base font-black text-emerald-600">
                  {history.filter(h => h.recruiterSource === 'hunter' || h.recruiterSource === 'apollo').length}
                </p>
                <p className="text-[11px] text-gray-400">Verified</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}
