/**
 * JobDetailPanel — shared job detail panel used by Results, LinkedIn, and Map Search.
 *
 * Props:
 *   job          — job object (Results Job, LinkedIn Job, or GeoJob)
 *   mode         — 'results' | 'linkedin' | 'geo'
 *   onClose      — called when user clicks close
 *   onJobUpdate  — called with patch object when job data changes locally
 *   showDragHandle — show mobile drag handle at top (default false)
 */

import { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  X, Star, Wifi, MapPin, Mail, Send, Users, Search,
  Loader2, ArrowUpRight, RefreshCw, Copy, Check,
  Linkedin, ShieldCheck, AlertCircle, HelpCircle,
  Sparkles, Lock, ExternalLink, Bookmark, BookmarkCheck,
  Trash2, Building,
} from 'lucide-react';
import { api }     from '@utils/axios';
import { logJobRankingEvent, logLinkedInRankingEvent } from '@utils/rankingFeedback';
import { cn }      from '@utils/helpers';
import { truncate } from '@utils/formatters';
import { useAuth }  from '@hooks/useAuth';
import { useToast } from '@hooks/useToast';
import MatchExplainer  from './MatchExplainer';
import CompanyResearch from './CompanyResearch';
import { JOB_STATUS_LABELS } from '@utils/constants';
import { Badge } from '@components/ui';

// ── Platform badge ────────────────────────────────────────────────
const PLATFORM_META = {
  LinkedIn:   { label: 'LinkedIn',    cls: 'bg-[#0077b5]/10 text-[#0077b5] border-[#0077b5]/20' },
  JSearch:    { label: 'JSearch',     cls: 'bg-violet-100 text-violet-700 border-violet-200' },
  Indeed:     { label: 'Indeed',      cls: 'bg-indigo-100 text-indigo-700 border-indigo-200' },
  Naukri:     { label: 'Naukri',      cls: 'bg-orange-100 text-orange-700 border-orange-200' },
  Glassdoor:  { label: 'Glassdoor',   cls: 'bg-green-100 text-green-700 border-green-200' },
  Adzuna:     { label: 'Adzuna',      cls: 'bg-blue-100 text-blue-700 border-blue-200' },
  Jooble:     { label: 'Jooble',      cls: 'bg-sky-100 text-sky-700 border-sky-200' },
  CareerJet:  { label: 'CareerJet',   cls: 'bg-red-100 text-red-700 border-red-200' },
  Reed:       { label: 'Reed',        cls: 'bg-rose-100 text-rose-700 border-rose-200' },
  RemoteOK:   { label: 'RemoteOK',    cls: 'bg-teal-100 text-teal-700 border-teal-200' },
  Remotive:   { label: 'Remotive',    cls: 'bg-cyan-100 text-cyan-700 border-cyan-200' },
  Jobicy:     { label: 'Jobicy',      cls: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  Himalayas:  { label: 'Himalayas',   cls: 'bg-purple-100 text-purple-700 border-purple-200' },
  Wellfound:  { label: 'Wellfound',   cls: 'bg-amber-100 text-amber-700 border-amber-200' },
  TheMuse:    { label: 'TheMuse',     cls: 'bg-pink-100 text-pink-700 border-pink-200' },
  FindWork:   { label: 'FindWork',    cls: 'bg-lime-100 text-lime-700 border-lime-200' },
  Arbeitnow:  { label: 'Arbeitnow',  cls: 'bg-yellow-100 text-yellow-700 border-yellow-200' },
  Greenhouse: { label: 'Greenhouse', cls: 'bg-green-100 text-green-800 border-green-300' },
  Ashby:      { label: 'Ashby',      cls: 'bg-slate-100 text-slate-700 border-slate-200' },
  Lever:      { label: 'Lever',      cls: 'bg-neutral-100 text-neutral-700 border-neutral-200' },
  Recruitee:  { label: 'Recruitee',  cls: 'bg-fuchsia-100 text-fuchsia-700 border-fuchsia-200' },
  SerpAPI:    { label: 'Google Jobs', cls: 'bg-red-100 text-red-600 border-red-200' },
};
export const getPlatformMeta = (source) =>
  PLATFORM_META[source] || { label: source || 'Unknown', cls: 'bg-gray-100 text-gray-500 border-gray-200' };

export function SourceBadge({ source, className = '' }) {
  if (!source) return null;
  const meta = getPlatformMeta(source);
  return (
    <span className={cn('inline-flex items-center px-1.5 py-0.5 rounded-md text-[10px] font-semibold border', meta.cls, className)}>
      {meta.label}
    </span>
  );
}

// ── Score helper ──────────────────────────────────────────────────
const SCORE_STYLE = (s) =>
  s >= 75 ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
  s >= 50 ? 'bg-amber-50 text-amber-700 border border-amber-200'       :
            'bg-gray-100 text-gray-500';

// ── Status configs per mode ───────────────────────────────────────
const RESULTS_STATUSES  = ['found','saved','applied','interview','offer','rejected'];
const LINKEDIN_STATUSES = ['new','saved','applied','ignored'];

const LINKEDIN_STATUS_LABELS  = { new: 'New', saved: 'Saved', applied: 'Applied', ignored: 'Ignored' };

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
function ContactsSection({ title, icon: Icon, iconColor, items, onOutreach, onRankingEmailClick }) {
  const [copied, setCopied] = useState('');
  const copy = async (email) => {
    if (email) onRankingEmailClick?.({ action: 'copy', section: title });
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
            onClick={() => {
              onRankingEmailClick?.({ action: 'outreach_all', section: title });
              onOutreach(items.filter((i) => i.email));
            }}
            className="text-[10px] text-blue-600 font-semibold hover:underline flex items-center gap-0.5"
          >
            Outreach all <Send className="w-3 h-3" />
          </button>
        )}
      </div>
      <div className="space-y-2">
        {items.map((item, i) => (
          <div key={i} className="flex items-start gap-2.5 p-2.5 bg-gray-50 rounded-xl border border-gray-100">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-100 to-indigo-100 flex items-center justify-center text-blue-700 font-bold text-xs flex-shrink-0">
              {item.name?.[0]?.toUpperCase() || '?'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-gray-900 truncate">{item.name || 'Contact'}</p>
              {item.title && <p className="text-xs text-gray-400 truncate">{item.title}</p>}
              {item.email
                ? <p className="text-xs text-blue-600 font-mono truncate mt-0.5">{item.email}</p>
                : <p className="text-xs text-gray-300 italic">No email</p>}
              <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                <StatusBadge status={item.status} />
                {item.confidence > 0 && <span className="text-[10px] text-gray-400">{item.confidence}%</span>}
                {item.source && <span className="text-[10px] text-gray-400 capitalize">{item.source}</span>}
              </div>
            </div>
            <div className="flex flex-col gap-1 flex-shrink-0">
              {item.email && (
                <button onClick={() => copy(item.email)}
                  className="p-1.5 rounded-lg bg-white border border-gray-200 hover:border-blue-300 text-gray-400 hover:text-blue-600 transition-colors" title="Copy email">
                  {copied === item.email ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              )}
              {item.linkedin && (
                <a href={item.linkedin} target="_blank" rel="noopener noreferrer"
                  className="p-1.5 rounded-lg bg-white border border-gray-200 hover:border-blue-300 text-gray-400 hover:text-blue-600 transition-colors" title="LinkedIn">
                  <Linkedin className="w-3.5 h-3.5" />
                </a>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Deep Eval helpers ─────────────────────────────────────────────
/** AI returns 0–5; older/cached payloads may already be 0–100. */
function deepEvalFitOutOf100(score) {
  const n = Number(score);
  if (!Number.isFinite(n) || n < 0) return 0;
  return n <= 5 ? Math.round(n * 20) : Math.min(100, Math.round(n));
}

function ScoreGrade({ score }) {
  const normalized = deepEvalFitOutOf100(score);
  const grade = normalized >= 85 ? 'A' : normalized >= 70 ? 'B' : normalized >= 55 ? 'C' : normalized >= 40 ? 'D' : 'F';
  const style =
    grade === 'A' ? 'bg-emerald-100 text-emerald-700 border-emerald-300' :
    grade === 'B' ? 'bg-blue-100 text-blue-700 border-blue-300'          :
    grade === 'C' ? 'bg-amber-100 text-amber-700 border-amber-300'       :
    grade === 'D' ? 'bg-orange-100 text-orange-700 border-orange-300'    :
                    'bg-red-100 text-red-600 border-red-300';
  return (
    <div className="flex flex-col gap-1">
      <span className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-base font-black border w-fit ${style}`}>
        <span>{grade}</span>
        <span className="text-xs font-bold opacity-90 tabular-nums border-l border-current/20 pl-2">
          {normalized}/100
        </span>
      </span>
      <p className="text-[11px] text-gray-500 leading-snug max-w-xs">
        <span className="font-semibold text-gray-600">Letter (A–F)</span> is a quick fit summary for this job vs your profile.
        <span className="font-semibold text-gray-600"> Number</span> is the same fit on a 0–100 scale (higher = stronger match).
      </p>
    </div>
  );
}

function DeepEvalReport({ eval: ev }) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between p-4 bg-gradient-to-r from-violet-50 to-indigo-50 rounded-2xl border border-violet-100">
        <div>
          <p className="text-xs text-violet-500 font-semibold uppercase tracking-wide mb-1">Overall fit</p>
          <ScoreGrade score={ev.score} />
        </div>
        {ev.archetype && (
          <div className="text-right">
            <p className="text-xs text-gray-400 mb-1">Role Type</p>
            <span className="text-xs font-bold text-violet-700 bg-violet-100 px-2.5 py-1 rounded-full">{ev.archetype}</span>
          </div>
        )}
      </div>
      {ev.summary && (
        <div className="p-3 bg-gray-50 rounded-xl border border-gray-100">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Verdict</p>
          <p className="text-sm text-gray-700 leading-relaxed">{ev.summary}</p>
        </div>
      )}
      {ev.salaryRange && (
        <div className="flex items-center justify-between p-3 bg-emerald-50 rounded-xl border border-emerald-100">
          <p className="text-xs font-semibold text-emerald-700">Salary Range</p>
          <p className="text-sm font-bold text-emerald-800">{ev.salaryRange}</p>
        </div>
      )}
      {ev.cvGaps?.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2 flex items-center gap-1.5">
            <AlertCircle className="w-3.5 h-3.5 text-orange-500" /> CV Gaps
          </p>
          <ul className="space-y-1.5">
            {ev.cvGaps.map((gap, i) => (
              <li key={i} className="flex items-start gap-2 text-xs text-gray-600">
                <span className="w-1.5 h-1.5 rounded-full bg-orange-400 flex-shrink-0 mt-1.5" />{gap}
              </li>
            ))}
          </ul>
        </div>
      )}
      {ev.topCvChanges?.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2 flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-blue-500" /> Recommended CV Changes
          </p>
          <ul className="space-y-1.5">
            {ev.topCvChanges.map((change, i) => (
              <li key={i} className="flex items-start gap-2 text-xs text-gray-600">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-400 flex-shrink-0 mt-1.5" />{change}
              </li>
            ))}
          </ul>
        </div>
      )}
      {ev.interviewQs?.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2 flex items-center gap-1.5">
            <HelpCircle className="w-3.5 h-3.5 text-violet-500" /> Likely Interview Questions
          </p>
          <ul className="space-y-1.5">
            {ev.interviewQs.slice(0, 3).map((q, i) => (
              <li key={i} className="text-xs text-gray-600 bg-violet-50 rounded-lg px-3 py-2 border border-violet-100">{q}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function InterviewPrepPanel({ prep }) {
  const [open, setOpen] = useState(null);
  const typeColor = (type) =>
    type === 'technical'   ? 'bg-blue-100 text-blue-700'    :
    type === 'behavioral'  ? 'bg-violet-100 text-violet-700' :
    type === 'situational' ? 'bg-amber-100 text-amber-700'   :
    type === 'culture'     ? 'bg-emerald-100 text-emerald-700' :
    'bg-gray-100 text-gray-600';

  return (
    <div className="space-y-4">
      <div>
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Practice Questions</p>
        <div className="space-y-2">
          {prep.questions?.map((q, i) => (
            <div key={i} className="border border-gray-100 rounded-xl overflow-hidden">
              <button onClick={() => setOpen(open === i ? null : i)}
                className="w-full flex items-start gap-2.5 p-3 text-left hover:bg-gray-50 transition-colors">
                <span className="w-5 h-5 rounded-full bg-gray-100 text-gray-600 font-bold text-[10px] flex items-center justify-center flex-shrink-0 mt-0.5">{i + 1}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-gray-800 leading-snug">{q.question}</p>
                  {q.type && (
                    <span className={`inline-block mt-1.5 text-[10px] font-semibold px-1.5 py-0.5 rounded-full capitalize ${typeColor(q.type)}`}>{q.type}</span>
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
      {prep.companyResearchTips?.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2 flex items-center gap-1.5">
            <Building className="w-3.5 h-3.5 text-indigo-500" /> Research Before Interview
          </p>
          <ul className="space-y-1.5">
            {prep.companyResearchTips.map((tip, i) => (
              <li key={i} className="flex items-start gap-2 text-xs text-gray-600">
                <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 flex-shrink-0 mt-1.5" />{tip}
              </li>
            ))}
          </ul>
        </div>
      )}
      {prep.keywordsToMention?.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Keywords to Use</p>
          <div className="flex flex-wrap gap-1.5">
            {prep.keywordsToMention.map((kw, i) => (
              <span key={i} className="text-[11px] font-medium px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full">{kw}</span>
            ))}
          </div>
        </div>
      )}
      {prep.questionsToAsk?.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2 flex items-center gap-1.5">
            <HelpCircle className="w-3.5 h-3.5 text-violet-500" /> Questions to Ask Them
          </p>
          <ul className="space-y-1.5">
            {prep.questionsToAsk.map((q, i) => (
              <li key={i} className="text-xs text-gray-600 bg-violet-50 rounded-lg px-3 py-2 border border-violet-100 italic">"{q}"</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────────────
export default function JobDetailPanel({
  job: initialJob,
  mode = 'results',     // 'results' | 'linkedin' | 'geo'
  onClose,
  onJobUpdate,
  showDragHandle = false,
  initialSaved   = false, // geo: initial saved state from parent
  onSaveToggle,           // geo: called with (jobId, newState) after save/unsave
  savedJobId     = null,  // geo: regular Job._id after geo job has been saved
}) {
  const toast      = useToast();
  const { user }   = useAuth();
  const navigate   = useNavigate();
  const isPro      = user?.plan === 'pro' || user?.plan === 'team';

  // Local copy of job so UI updates instantly without waiting for parent
  const [job, setJob]               = useState(initialJob);
  const [activeTab, setActiveTab]   = useState('details');
  const [hrLoading,   setHrLoading]   = useState(false);
  const [empLoading,  setEmpLoading]  = useState(false);
  const [evalLoading, setEvalLoading] = useState(false);
  const [prepLoading, setPrepLoading] = useState(false);
  const [livenessLoading, setLivenessLoading] = useState(false);
  const [saved,    setSaved]    = useState(initialSaved); // for geo mode
  const [saving,   setSaving]   = useState(false); // for geo mode
  const [deleting, setDeleting] = useState(false); // for linkedin mode
  const [descLoading, setDescLoading] = useState(false); // linkedin description fetch

  // Sync when parent job prop changes (e.g. user clicks different job)
  useEffect(() => {
    setJob(initialJob);
    setActiveTab('details');
    if (mode === 'geo') setSaved(initialSaved);
  }, [initialJob?._id]);

  useEffect(() => {
    if (!initialJob?._id) return;
    if (mode === 'results') logJobRankingEvent(initialJob._id, 'open_detail', { source: 'job_detail_panel' });
    if (mode === 'linkedin') logLinkedInRankingEvent(initialJob._id, 'open_detail', { source: 'job_detail_panel' });
  }, [initialJob?._id, mode]);

  const emitEmailRankingClick = useCallback((payload) => {
    if (mode === 'linkedin' && job?._id) {
      logLinkedInRankingEvent(job._id, 'email_click', payload);
      return;
    }
    const jobId = mode === 'geo' ? savedJobId : job._id;
    if ((mode === 'results' || (mode === 'geo' && savedJobId)) && jobId) {
      logJobRankingEvent(jobId, 'email_click', payload);
    }
  }, [mode, job?._id, savedJobId]);

  // Auto-fetch description for LinkedIn jobs that don't have one AND have a URL
  useEffect(() => {
    if (mode !== 'linkedin' || !initialJob?._id || initialJob?.description || !initialJob?.url) return;
    setDescLoading(true);
    api.get(`/linkedin/jobs/${initialJob._id}/description`)
      .then(({ data }) => {
        if (data.data?.description) updateJob({ description: data.data.description });
      })
      .catch(() => {})
      .finally(() => setDescLoading(false));
  }, [initialJob?._id, mode]);

  const retryFetchDescription = () => {
    if (!job?._id || !job?.url) return;
    setDescLoading(true);
    api.get(`/linkedin/jobs/${job._id}/description`)
      .then(({ data }) => {
        if (data.data?.description) updateJob({ description: data.data.description });
      })
      .catch(() => {})
      .finally(() => setDescLoading(false));
  };

  // Fetch fresh contacts on mount (Results and LinkedIn modes)
  useEffect(() => {
    if (mode === 'geo' || !job?._id) return;
    const endpoint = mode === 'linkedin'
      ? `/linkedin/jobs/${job._id}`
      : `/jobs/${job._id}/contacts`;

    if (mode === 'results') {
      api.get(`/jobs/${job._id}/contacts`)
        .then(({ data }) => {
          const { hrContacts, employees, careerPageUrl, linkedinUrl, employeeSearch } = data.data;
          const patch = {};
          if (employees?.length > 0)  patch.employees = employees;
          if (hrContacts?.length > 0) {
            patch.allRecruiterContacts = hrContacts;
            patch.recruiterEmail = hrContacts[0]?.email;
            patch.recruiterName  = hrContacts[0]?.name;
          }
          if (careerPageUrl)  patch.careerPageUrl  = careerPageUrl;
          if (linkedinUrl)    patch.linkedinUrl    = linkedinUrl;
          if (employeeSearch) patch.employeeSearch = employeeSearch;
          if (Object.keys(patch).length) updateJob(patch);
        })
        .catch(() => {});
    }
  }, [job?._id, mode]);

  // ── Helpers ───────────────────────────────────────────────────
  const updateJob = (patch) => {
    setJob(prev => ({ ...prev, ...patch }));
    onJobUpdate?.(patch);
  };

  // ── Tab config — all tabs for all modes ──────────────────────
  const tabs = ['details', 'contacts', 'status', 'ai', 'eval', 'prep'];

  const TAB_LABELS = {
    details:  'Details',
    contacts: `Contacts${contactCount(job) > 0 ? ` (${contactCount(job)})` : ''}`,
    status:   'Status',
    ai:       'AI Tools',
    eval:     'Deep Eval',
    prep:     'Prep',
  };

  function contactCount(j) {
    return j?.allRecruiterContacts?.length || (j?.recruiterEmail ? 1 : 0);
  }

  // ── Actions ───────────────────────────────────────────────────

  // Find HR emails
  const findHR = async () => {
    setHrLoading(true);
    try {
      if (mode === 'linkedin') {
        const { data } = await api.post(`/linkedin/jobs/${job._id}/find-hr`);
        const emails    = data.data.emails    || [];
        const employees = data.data.employees || [];
        const patch = {
          ...(data.data.careerPageUrl  && { careerPageUrl:  data.data.careerPageUrl  }),
          ...(data.data.linkedinUrl    && { linkedinUrl:    data.data.linkedinUrl    }),
          ...(data.data.employeeSearch && { employeeSearch: data.data.employeeSearch }),
        };
        if (emails.length > 0) {
          patch.recruiterEmail       = emails[0].email;
          patch.recruiterName        = emails[0].name;
          patch.allRecruiterContacts = emails;
        }
        if (employees.length > 0) patch.employees = employees;
        updateJob(patch);
        const msg = emails.length > 0
          ? `Found ${emails.length} HR emails · ${employees.length} employees`
          : data.data.careerPageUrl
            ? 'No verified emails — career page & LinkedIn links added'
            : 'No HR contacts found for this company';
        toast.success(msg);
      } else {
        // Results or Geo — use universal recruiter lookup
        const { data }  = await api.post('/recruiters/lookup', { company: job.company, jobId: job._id });
        const result     = data.data;
        const top        = result.emails?.[0];
        const patch = {
          ...(result.careerPageUrl  && { careerPageUrl:  result.careerPageUrl }),
          ...(result.linkedinUrl    && { linkedinUrl:    result.linkedinUrl }),
          ...(result.employeeSearch && { employeeSearch: result.employeeSearch }),
        };
        if (top?.email) Object.assign(patch, {
          recruiterEmail:       top.email,
          recruiterName:        top.name       || null,
          recruiterConfidence:  top.confidence || null,
          recruiterEmailStatus: top.status     || 'unknown',
          allRecruiterContacts: result.emails  || [],
        });
        if (Object.keys(patch).length) updateJob(patch);
        if (!top?.email) toast.info('No verified email found — career links updated');
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'HR lookup failed');
    } finally {
      setHrLoading(false);
    }
  };

  // Find employees (Results only)
  const findEmployees = async () => {
    setEmpLoading(true);
    try {
      const { data } = await api.post(`/jobs/${job._id}/find-employees`);
      const employees = data.data.employees || [];
      updateJob({ employees });
      toast.success(employees.length > 0
        ? `Found ${employees.length} employee contacts`
        : 'No employees found via Apollo for this company');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Employee search failed');
    } finally {
      setEmpLoading(false);
    }
  };

  // Update application status
  const updateStatus = async (status) => {
    try {
      let endpoint;
      if (mode === 'linkedin') endpoint = `/linkedin/jobs/${job._id}/status`;
      else if (mode === 'geo')  endpoint = savedJobId ? `/jobs/${savedJobId}/status` : null;
      else                      endpoint = `/jobs/${job._id}/status`;

      if (!endpoint) { toast.error('Save this job first to track status'); return; }
      const prevStatus = job.status;
      await api.patch(endpoint, { status });
      updateJob({ status });
      if (mode === 'linkedin' && job._id) {
        if (status === 'applied') logLinkedInRankingEvent(job._id, 'apply', { source: 'status_tab' });
        else if (status === 'saved') logLinkedInRankingEvent(job._id, 'save', { source: 'status_tab' });
        else if (status === 'new' && prevStatus === 'saved') {
          logLinkedInRankingEvent(job._id, 'unsave', { source: 'status_tab' });
        } else if (status === 'ignored') logLinkedInRankingEvent(job._id, 'hide', { source: 'status_tab' });
      } else if (mode === 'results' && job._id) {
        if (status === 'applied') logJobRankingEvent(job._id, 'apply', { source: 'status_tab' });
        else if (status === 'saved') logJobRankingEvent(job._id, 'save', { source: 'status_tab' });
        else if (status === 'found' && prevStatus === 'saved') {
          logJobRankingEvent(job._id, 'unsave', { source: 'status_tab' });
        } else if (status === 'rejected') logJobRankingEvent(job._id, 'hide', { source: 'status_tab' });
      } else if (mode === 'geo' && savedJobId) {
        if (status === 'applied') logJobRankingEvent(savedJobId, 'apply', { source: 'status_tab' });
        else if (status === 'saved') logJobRankingEvent(savedJobId, 'save', { source: 'status_tab' });
        else if (status === 'found' && prevStatus === 'saved') {
          logJobRankingEvent(savedJobId, 'unsave', { source: 'status_tab' });
        } else if (status === 'rejected') logJobRankingEvent(savedJobId, 'hide', { source: 'status_tab' });
      }
      toast.success(`Marked as ${status}`);
    } catch { toast.error('Failed to update'); }
  };

  // Save/unsave (Geo mode)
  const toggleSave = async () => {
    setSaving(true);
    try {
      if (saved) {
        await api.post(`/geo-jobs/${job._id}/unsave`);
        setSaved(false);
        onSaveToggle?.(job._id, false);
      } else {
        await api.post(`/geo-jobs/${job._id}/save`);
        setSaved(true);
        onSaveToggle?.(job._id, true);
      }
    } catch { toast.error('Failed'); }
    finally { setSaving(false); }
  };

  // Liveness check (Results only)
  const checkLiveness = async () => {
    setLivenessLoading(true);
    try {
      const { data } = await api.post(`/jobs/${job._id}/check-liveness`);
      const liveness = data.data?.liveness;
      updateJob({ liveness });
      toast.success(
        liveness === 'active'  ? 'Job is still active!' :
        liveness === 'expired' ? 'Job may be closed' : 'Status unclear'
      );
    } catch { toast.error('Liveness check failed'); }
    finally { setLivenessLoading(false); }
  };

  // Deep evaluation (all modes)
  const runDeepEval = async () => {
    setEvalLoading(true);
    try {
      let endpoint;
      if (mode === 'linkedin') endpoint = `/linkedin/jobs/${job._id}/deep-evaluate`;
      else if (mode === 'geo')  endpoint = savedJobId ? `/jobs/${savedJobId}/deep-evaluate` : null;
      else                      endpoint = `/jobs/${job._id}/deep-evaluate`;

      if (!endpoint) { toast.error('Save this job first to run Deep Evaluation'); setEvalLoading(false); return; }
      const { data } = await api.post(endpoint);
      updateJob({ deepEval: data.data });
      toast.success('Deep evaluation complete');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Evaluation failed');
    } finally { setEvalLoading(false); }
  };

  // Interview prep (all modes)
  const runInterviewPrep = async () => {
    setPrepLoading(true);
    try {
      let endpoint;
      if (mode === 'linkedin') endpoint = `/linkedin/jobs/${job._id}/interview-prep`;
      else if (mode === 'geo')  endpoint = savedJobId ? `/jobs/${savedJobId}/interview-prep` : null;
      else                      endpoint = `/jobs/${job._id}/interview-prep`;

      if (!endpoint) { toast.error('Save this job first to generate Interview Prep'); setPrepLoading(false); return; }
      const { data } = await api.post(endpoint);
      updateJob({ interviewPrep: data.data });
      toast.success('Interview prep generated');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Prep generation failed');
    } finally { setPrepLoading(false); }
  };

  // Delete (LinkedIn only)
  const deleteJob = async () => {
    if (!confirm('Delete this job?')) return;
    setDeleting(true);
    try {
      await api.delete(`/linkedin/jobs/${job._id}`);
      toast.success('Deleted');
      onJobUpdate?.({ _deleted: true });
      onClose?.();
    } catch { toast.error('Failed to delete'); }
    finally { setDeleting(false); }
  };

  // Outreach navigation
  const goToOutreach = (emails = [], rankingSection = null) => {
    const allEmails = (emails.length > 0
      ? emails
      : [
          ...(job.allRecruiterContacts?.length > 0 ? job.allRecruiterContacts : job.recruiterEmail ? [{ email: job.recruiterEmail }] : []),
          ...(job.employees?.filter(e => e.email) || []),
        ].map(c => c.email).filter(Boolean));

    if (rankingSection && job?._id) {
      if (mode === 'linkedin') {
        logLinkedInRankingEvent(job._id, 'email_click', {
          action: 'outreach_nav',
          section: rankingSection,
          recipientCount: allEmails.length,
        });
      } else if (mode === 'results') {
        logJobRankingEvent(job._id, 'email_click', {
          action: 'outreach_nav',
          section: rankingSection,
          recipientCount: allEmails.length,
        });
      } else if (mode === 'geo' && savedJobId) {
        logJobRankingEvent(savedJobId, 'email_click', {
          action: 'outreach_nav',
          section: rankingSection,
          recipientCount: allEmails.length,
        });
      }
    }

    const params = new URLSearchParams({
      company:  job.company  || '',
      jobTitle: job.title    || '',
      ...(allEmails.length ? { to: allEmails.join(',') } : {}),
      ...(job.searchId ? { searchId: job.searchId } : {}),
      // Pass source-specific job ID so backend can update the correct model's status
      ...(mode === 'linkedin' && job._id ? { linkedinJobId: job._id } : {}),
    });
    window.location.href = `/outreach-manager?${params}`;
  };

  // ── Derived values ────────────────────────────────────────────
  const applyUrl   = job.applyUrl || job.url || '#';
  const source     = job.source || (mode === 'linkedin' ? 'LinkedIn' : null);
  const location   = typeof job.location === 'object' ? job.location?.address : job.location;

  // AI endpoint prefixes — based on mode
  const aiJobId = mode === 'linkedin' ? job._id : (mode === 'geo' ? savedJobId : job._id);
  const aiPrefix = mode === 'linkedin' ? '/linkedin/jobs' : '/jobs';
  const explainEndpoint = aiJobId ? `${aiPrefix}/${aiJobId}/explain`  : null;
  const companyEndpoint = aiJobId ? `${aiPrefix}/${aiJobId}/company`  : null;

  // For geo mode: AI features require the job to be saved first
  const geoAiLocked = mode === 'geo' && !savedJobId;

  const hrEmails = job.allRecruiterContacts?.length > 0
    ? job.allRecruiterContacts
    : job.recruiterEmail
      ? [{ email: job.recruiterEmail, name: job.recruiterName, confidence: job.recruiterConfidence, source: job.recruiterSource, status: job.recruiterEmailStatus || 'unknown', linkedin: job.recruiterLinkedIn }]
      : [];

  const employees = (job.employees || []).map(e => ({
    email: e.email, name: e.name, title: e.title,
    linkedin: e.linkedin, source: e.source || 'apollo',
    status: e.email ? 'verified' : 'unknown', confidence: e.email ? 85 : 0,
  }));

  const statusList   = mode === 'linkedin' ? LINKEDIN_STATUSES   : RESULTS_STATUSES;
  const statusLabels = mode === 'linkedin' ? LINKEDIN_STATUS_LABELS : JOB_STATUS_LABELS;

  // geo mode status banner
  const geoStatusLocked = mode === 'geo' && !savedJobId;

  if (!job) return null;

  // ─────────────────────────────────────────────────────────────
  return (
<div className="flex-1 overflow-y-auto p-5 space-y-4">
      {/* Mobile drag handle */}
      {showDragHandle && (
        <div className="flex justify-center pt-3 pb-1 flex-shrink-0">
          <div className="w-10 h-1 bg-gray-300 rounded-full" />
        </div>
      )}

      {/* Header */}
      <div className="p-5 border-b border-gray-100 flex-shrink-0">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div
              className="w-12 h-12 rounded-2xl flex items-center justify-center text-white font-black text-lg flex-shrink-0"
              style={{ background: `hsl(${(job.company?.charCodeAt(0) || 65) * 5 % 360}, 65%, 55%)` }}
            >
              {job.company?.[0]?.toUpperCase() || '?'}
            </div>
            <div className="min-w-0">
              <h2 className="font-bold text-gray-900 leading-tight truncate">{job.title}</h2>
              <p className="text-sm text-gray-500 font-medium mt-0.5">{job.company}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors flex-shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Meta badges */}
        <div className="flex items-center gap-2 mt-3 flex-wrap">
          {job.matchScore > 0 && (
            <span className={cn('inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold', SCORE_STYLE(job.matchScore))}>
              <Star className="w-3 h-3" /> {job.matchScore}% match
            </span>
          )}
          {job.remote && (
            <Badge variant="green">
              <Wifi className="h-3 w-3 shrink-0" aria-hidden /> Remote
            </Badge>
          )}
          <SourceBadge source={source} />
          {location && (
            <span className="text-xs text-gray-400 flex items-center gap-1">
              <MapPin className="w-3 h-3" /> {location}
            </span>
          )}
          {job.salary && job.salary !== 'Not specified' && (
            <span className="text-xs text-gray-500 font-medium">{job.salary}</span>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-100 flex-shrink-0 px-1 overflow-x-auto">
        {tabs.map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={cn(
              'flex-shrink-0 px-2.5 py-3 text-xs font-semibold capitalize transition-colors border-b-2 whitespace-nowrap',
              activeTab === tab
                ? 'border-blue-600 text-blue-700'
                : 'border-transparent text-gray-400 hover:text-gray-600'
            )}
          >
            {TAB_LABELS[tab]}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto p-5 space-y-4">

        {/* ── DETAILS TAB ─────────────────────────────────────── */}
        {activeTab === 'details' && (
          <div className="space-y-4">
            {/* Description */}
            {job.description ? (
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Description</p>
                <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-line">
                  {truncate(job.description, 800)}
                </p>
              </div>
            ) : mode === 'linkedin' && descLoading ? (
              <div className="flex items-center gap-2 py-6 justify-center text-sm text-gray-400">
                <Loader2 className="w-4 h-4 animate-spin text-blue-500" />
                Fetching description from LinkedIn…
              </div>
            ) : mode === 'linkedin' ? (
              <div className="flex flex-col items-center gap-3 py-6 text-center">
                <div className="w-12 h-12 rounded-2xl bg-gray-50 flex items-center justify-center">
                  <Linkedin className="w-5 h-5 text-gray-400" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-700">No description available</p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {job.url
                      ? 'Could not scrape description from the job page'
                      : 'No job URL found — description cannot be fetched'}
                  </p>
                </div>
                <div className="flex gap-2 flex-wrap justify-center">
                  {job.url && (
                    <button
                      onClick={retryFetchDescription}
                      disabled={descLoading}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 text-blue-700 text-xs font-semibold rounded-lg hover:bg-blue-100 transition-colors border border-blue-200"
                    >
                      {descLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
                      Retry Fetch
                    </button>
                  )}
                  {(job.url || job.applyUrl) && (
                    <a
                      href={job.url || job.applyUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#0077b5] text-white text-xs font-semibold rounded-lg hover:bg-[#005d91] transition-colors"
                    >
                      <ExternalLink className="w-3 h-3" /> View Job Page
                    </a>
                  )}
                </div>
              </div>
            ) : (
              <p className="text-sm text-gray-400 italic">No description available</p>
            )}

            {/* Tags (Geo jobs) */}
            {job.tags?.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {job.tags.map(tag => (
                  <span key={tag} className="px-2.5 py-1 bg-blue-50 text-blue-700 rounded-full text-xs font-medium border border-blue-100">{tag}</span>
                ))}
              </div>
            )}

            {/* Liveness (Results only) */}
            {job.liveness && (
              <div className={cn('flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold',
                job.liveness === 'active'    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                job.liveness === 'expired'   ? 'bg-red-50 text-red-600 border border-red-200' :
                'bg-amber-50 text-amber-700 border border-amber-200'
              )}>
                {job.liveness === 'active'  && <ShieldCheck className="w-3.5 h-3.5" />}
                {job.liveness === 'expired' && <AlertCircle className="w-3.5 h-3.5" />}
                {job.liveness === 'uncertain' && <HelpCircle className="w-3.5 h-3.5" />}
                {job.liveness === 'active'   ? 'Job is still active' :
                 job.liveness === 'expired'  ? 'Job may be closed' : 'Status uncertain'}
              </div>
            )}

            {/* Apply + Liveness check */}
            <div className="flex gap-2">
              <a
                href={applyUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => {
                  if (!applyUrl || applyUrl === '#') return;
                  if (mode === 'results' && job?._id) logJobRankingEvent(job._id, 'apply', { source: 'apply_cta' });
                  if (mode === 'linkedin' && job?._id) logLinkedInRankingEvent(job._id, 'apply', { source: 'apply_cta' });
                  if (mode === 'geo' && savedJobId) logJobRankingEvent(savedJobId, 'apply', { source: 'apply_cta' });
                }}
                className="btn btn-primary flex-1 justify-center"
              >
                <ArrowUpRight className="w-4 h-4" />
                {mode === 'linkedin' ? 'View on LinkedIn' : 'Apply Now'}
              </a>
              {mode === 'results' && (
                <button
                  onClick={checkLiveness}
                  disabled={livenessLoading}
                  className="btn btn-secondary px-3"
                  title="Check if job is still open"
                >
                  {livenessLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                </button>
              )}
            </div>

            {/* Geo: Save button */}
            {mode === 'geo' && (
              <button onClick={toggleSave} disabled={saving}
                className={cn('btn w-full justify-center', saved ? 'btn-secondary' : 'btn-primary')}>
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : saved ? <BookmarkCheck className="w-4 h-4" /> : <Bookmark className="w-4 h-4" />}
                {saved ? 'Saved' : 'Save Job'}
              </button>
            )}

            {/* Send Outreach button */}
            <button
              onClick={() => goToOutreach([], 'details')}
              className="w-full py-2.5 rounded-xl text-sm font-semibold text-white flex items-center justify-center gap-2"
              style={{ background: 'linear-gradient(135deg, #2563eb 0%, #7c3aed 100%)' }}
            >
              <Send className="w-4 h-4" /> Send Outreach
            </button>

            {/* LinkedIn: Delete */}
            {mode === 'linkedin' && (
              <button onClick={deleteJob} disabled={deleting}
                className="btn btn-danger w-full justify-center text-sm">
                {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                Delete
              </button>
            )}
          </div>
        )}

        {/* ── CONTACTS TAB ────────────────────────────────────── */}
        {activeTab === 'contacts' && (
          <div className="space-y-4">
            {/* HR Emails */}
            {hrEmails.length > 0 ? (
              <ContactsSection
                title="HR Emails"
                icon={Mail}
                iconColor="text-blue-500"
                items={hrEmails}
                onRankingEmailClick={emitEmailRankingClick}
                onOutreach={(contacts) => goToOutreach(contacts.map(c => c.email))}
              />
            ) : (
              <div className="rounded-2xl border border-dashed border-gray-200 p-4 space-y-3">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide flex items-center gap-1.5">
                  <Mail className="w-3.5 h-3.5 text-blue-500" /> HR Emails
                </p>
                <p className="text-xs text-gray-400">No verified emails found yet.</p>
                {(job.careerPageUrl || job.linkedinUrl || job.employeeSearch) && (
                  <div className="space-y-2">
                    {job.careerPageUrl && (
                      <a href={job.careerPageUrl} target="_blank" rel="noopener noreferrer"
                        className="flex items-center gap-2 p-2.5 bg-blue-50 border border-blue-100 rounded-xl text-xs font-semibold text-blue-700 hover:bg-blue-100 transition-colors">
                        <ArrowUpRight className="w-3.5 h-3.5 flex-shrink-0" /> Visit Careers Page
                      </a>
                    )}
                    {job.linkedinUrl && (
                      <a href={job.linkedinUrl} target="_blank" rel="noopener noreferrer"
                        className="flex items-center gap-2 p-2.5 bg-blue-50 border border-blue-100 rounded-xl text-xs font-semibold text-blue-700 hover:bg-blue-100 transition-colors">
                        <Linkedin className="w-3.5 h-3.5 flex-shrink-0" /> Company LinkedIn
                      </a>
                    )}
                    {job.employeeSearch && (
                      <a href={job.employeeSearch} target="_blank" rel="noopener noreferrer"
                        className="flex items-center gap-2 p-2.5 bg-violet-50 border border-violet-100 rounded-xl text-xs font-semibold text-violet-700 hover:bg-violet-100 transition-colors">
                        <Users className="w-3.5 h-3.5 flex-shrink-0" /> Find HR on LinkedIn
                      </a>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Employees */}
            {employees.length > 0 ? (
              <ContactsSection
                title="Employees"
                icon={Users}
                iconColor="text-violet-500"
                items={employees}
                onRankingEmailClick={emitEmailRankingClick}
                onOutreach={(contacts) => goToOutreach(contacts.filter(c => c.email).map(c => c.email))}
              />
            ) : (
              <div className="rounded-2xl border border-dashed border-gray-200 p-4 space-y-2">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5 text-violet-500" /> Employees
                </p>
                <p className="text-xs text-gray-400">
                  {isPro ? 'Click "Find Employees" to search for people at this company.' : 'Upgrade to Pro to search for employees.'}
                </p>
              </div>
            )}

            {/* Action buttons */}
            <div className="space-y-2 pt-1">
              {isPro ? (
                <>
                  <button onClick={findHR} disabled={hrLoading}
                    className="btn btn-secondary btn-sm w-full justify-center">
                    {hrLoading
                      ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Looking up HR…</>
                      : <><Search className="w-3.5 h-3.5" /> Find HR Emails</>}
                    <span className="ml-auto text-[10px] bg-gray-200 text-gray-600 font-semibold px-1.5 py-0.5 rounded-full">15 cr</span>
                  </button>
                  {mode === 'results' && (
                    <button onClick={findEmployees} disabled={empLoading}
                      className="btn btn-secondary btn-sm w-full justify-center">
                      {empLoading
                        ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Finding employees…</>
                        : <><Users className="w-3.5 h-3.5" /> Find Employees</>}
                      <span className="ml-auto text-[10px] bg-gray-200 text-gray-600 font-semibold px-1.5 py-0.5 rounded-full">10 cr</span>
                    </button>
                  )}
                </>
              ) : (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-700">
                  Upgrade to Pro to find HR emails &amp; employees
                  <Link to="/billing" className="block font-semibold mt-1 text-amber-800 hover:underline">Upgrade Now →</Link>
                </div>
              )}

              {/* Send outreach to all contacts */}
              {(job.recruiterEmail || hrEmails.length > 0) && (
                <button
                  onClick={() => goToOutreach([], 'contacts')}
                  className="w-full py-2.5 rounded-xl text-sm font-semibold text-white flex items-center justify-center gap-2"
                  style={{ background: 'linear-gradient(135deg, #2563eb 0%, #7c3aed 100%)' }}
                >
                  <Send className="w-4 h-4" /> Send Outreach to All Contacts
                </button>
              )}
            </div>
          </div>
        )}

        {/* ── STATUS TAB ──────────────────────────────────────── */}
        {activeTab === 'status' && (
          <div className="space-y-3">
            {geoStatusLocked ? (
              <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl text-center space-y-2">
                <Bookmark className="w-6 h-6 text-amber-500 mx-auto" />
                <p className="text-sm font-semibold text-amber-800">Save this job first</p>
                <p className="text-xs text-amber-600">Save the job to start tracking your application status</p>
                <button onClick={toggleSave} disabled={saving}
                  className="btn btn-primary btn-sm mx-auto">
                  {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Bookmark className="w-3.5 h-3.5" />}
                  Save Job
                </button>
              </div>
            ) : (
              <>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Track Your Application</p>
                <div className="grid grid-cols-2 gap-2">
                  {statusList.map(s => (
                    <button
                      key={s}
                      onClick={() => updateStatus(s)}
                      className={cn(
                        'px-3 py-2.5 rounded-xl text-xs font-semibold border-2 transition-all capitalize',
                        job.status === s
                          ? 'border-blue-500 bg-blue-50 text-blue-700 shadow-sm'
                          : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
                      )}
                    >
                      {statusLabels[s] || s}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        {/* ── AI TOOLS TAB ─────────────────────────────────────── */}
        {activeTab === 'ai' && (
          <div className="space-y-4">
            {geoAiLocked ? (
              <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl text-center space-y-2">
                <Sparkles className="w-6 h-6 text-amber-500 mx-auto" />
                <p className="text-sm font-semibold text-amber-800">Save this job to unlock AI Tools</p>
                <p className="text-xs text-amber-600">Save the job first, then use Match Explainer and Company Research</p>
                <button onClick={toggleSave} disabled={saving} className="btn btn-primary btn-sm mx-auto">
                  {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Bookmark className="w-3.5 h-3.5" />} Save Job
                </button>
              </div>
            ) : (
              <>
                <MatchExplainer job={job} endpoint={explainEndpoint} />
                <div className="border-t border-gray-100 pt-4">
                  <CompanyResearch jobId={job._id} company={job.company} endpoint={companyEndpoint} />
                </div>
              </>
            )}
          </div>
        )}

        {/* ── DEEP EVAL TAB ────────────────────────────────────── */}
        {activeTab === 'eval' && (
          <div className="space-y-4">
            {geoAiLocked ? (
              <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl text-center space-y-2">
                <Sparkles className="w-6 h-6 text-amber-500 mx-auto" />
                <p className="text-sm font-semibold text-amber-800">Save this job to unlock Deep Eval</p>
                <button onClick={toggleSave} disabled={saving} className="btn btn-primary btn-sm mx-auto">
                  {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Bookmark className="w-3.5 h-3.5" />} Save Job
                </button>
              </div>
            ) : job.deepEval ? (
              <DeepEvalReport eval={job.deepEval} />
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
                  <button onClick={runDeepEval} disabled={evalLoading} className="btn btn-primary w-full justify-center">
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
            {!geoAiLocked && job.deepEval && (
              <button onClick={runDeepEval} disabled={evalLoading} className="btn btn-secondary btn-sm w-full justify-center">
                {evalLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                Refresh Evaluation
              </button>
            )}
          </div>
        )}

        {/* ── PREP TAB ─────────────────────────────────────────── */}
        {activeTab === 'prep' && (
          <div className="space-y-4">
            {geoAiLocked ? (
              <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl text-center space-y-2">
                <Users className="w-6 h-6 text-amber-500 mx-auto" />
                <p className="text-sm font-semibold text-amber-800">Save this job to unlock Interview Prep</p>
                <button onClick={toggleSave} disabled={saving} className="btn btn-primary btn-sm mx-auto">
                  {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Bookmark className="w-3.5 h-3.5" />} Save Job
                </button>
              </div>
            ) : job.interviewPrep ? (
              <InterviewPrepPanel prep={job.interviewPrep} />
            ) : (
              <div className="text-center py-6 space-y-3">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-100 to-teal-100 flex items-center justify-center mx-auto">
                  <Users className="w-7 h-7 text-emerald-600" />
                </div>
                <div>
                  <p className="font-semibold text-gray-800 text-sm">Interview Prep</p>
                  <p className="text-xs text-gray-400 mt-1">6 tailored questions with STAR hints · company tips</p>
                </div>
                <button onClick={runInterviewPrep} disabled={prepLoading} className="btn btn-primary w-full justify-center"
                  style={{ background: 'linear-gradient(135deg, #059669, #0d9488)' }}>
                  {prepLoading
                    ? <><Loader2 className="w-4 h-4 animate-spin" /> Generating…</>
                    : <><Sparkles className="w-4 h-4" /> Generate Interview Prep</>}
                  <span className="ml-auto text-[10px] bg-emerald-500 px-1.5 py-0.5 rounded-full">5 cr</span>
                </button>
              </div>
            )}
            {!geoAiLocked && job.interviewPrep && (
              <button onClick={runInterviewPrep} disabled={prepLoading} className="btn btn-secondary btn-sm w-full justify-center">
                {prepLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                Regenerate
              </button>
            )}
          </div>
        )}

      </div>
    </div>
  );
}
