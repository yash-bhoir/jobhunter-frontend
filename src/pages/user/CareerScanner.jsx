import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Building2, ExternalLink, Loader2, MapPin, Building, Star, Mail,
  ChevronLeft, ChevronRight, Sparkles, Clock, Heart, Plus, X, Search,
} from 'lucide-react';
import { api }      from '@utils/axios';
import { useAuth }  from '@hooks/useAuth';
import { useToast } from '@hooks/useToast';
import { fAgo }     from '@utils/formatters';
import { cn }       from '@utils/helpers';
import JobDetailPanel from '@components/jobs/JobDetailPanel';

const STATUS_CONFIG = {
  new:     { label: 'New',     cls: 'bg-blue-100 text-blue-700'    },
  saved:   { label: 'Saved',   cls: 'bg-amber-100 text-amber-700'  },
  applied: { label: 'Applied', cls: 'bg-emerald-100 text-emerald-700' },
  ignored: { label: 'Ignored', cls: 'bg-gray-100 text-gray-500'    },
};

const PLATFORM_META = {
  greenhouse: { label: 'Greenhouse', cls: 'bg-emerald-50 text-emerald-700 border-emerald-100' },
  ashby:      { label: 'Ashby',      cls: 'bg-violet-50 text-violet-700 border-violet-100'      },
  lever:      { label: 'Lever',      cls: 'bg-blue-50 text-blue-700 border-blue-100'           },
};

function boardUrl(platform, slug) {
  if (platform === 'greenhouse') return `https://boards.greenhouse.io/${slug}`;
  if (platform === 'ashby') return `https://jobs.ashbyhq.com/${slug}`;
  if (platform === 'lever') return `https://jobs.lever.co/${slug}`;
  return '#';
}

function CompanyAvatar({ name, size = 'md' }) {
  const char = name?.[0]?.toUpperCase() || '?';
  const hue  = ((name?.charCodeAt(0) || 66) * 5) % 360;
  const sz   = size === 'sm' ? 'w-7 h-7 text-[10px]' : 'w-9 h-9 text-xs';
  return (
    <div
      className={cn('rounded-lg flex items-center justify-center font-bold flex-shrink-0', sz)}
      style={{ background: `hsl(${hue},65%,92%)`, color: `hsl(${hue},65%,35%)` }}
    >
      {char}
    </div>
  );
}

const fadeUp = {
  hidden: { opacity: 0, y: 12 },
  show:   { opacity: 1, y: 0, transition: { duration: 0.3, ease: 'easeOut' } },
};
const stagger = { show: { transition: { staggerChildren: 0.04 } } };

export default function CareerScanner() {
  const { user, refetch } = useAuth();
  const toast    = useToast();
  const isPro    = user?.plan === 'pro' || user?.plan === 'team';
  const hasTargetRole = Boolean(user?.profile?.targetRole?.trim());
  const maxDreamWatches = isPro ? 15 : 3;

  const [portalsLoading, setPortalsLoading] = useState(true);
  const [portals, setPortals]       = useState(null);
  const [companyQuery, setCompanyQuery] = useState('');

  const [watches, setWatches] = useState([]);
  const [watchQuery, setWatchQuery] = useState('');
  const [savingWatches, setSavingWatches] = useState(false);
  const [discoveringWatch, setDiscoveringWatch] = useState(false);
  const [watchSuggestOpen, setWatchSuggestOpen] = useState(false);
  const [watchHighlight, setWatchHighlight] = useState(0);
  const watchComboRef = useRef(null);

  const [jobSource, setJobSource] = useState('career_page'); // 'career_page' | 'dream_company'
  const [jobs, setJobs]             = useState([]);
  const [jobsLoading, setJobsLoading] = useState(true);
  const [selected, setSelected]     = useState(null);
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage]             = useState(1);
  const [total, setTotal]           = useState(0);
  const LIMIT = 20;
  const totalPages = Math.ceil(total / LIMIT);

  useEffect(() => {
    const w = user?.dreamCompanyWatches;
    if (!Array.isArray(w)) return;
    setWatches(w.map((x) => ({ platform: x.platform, slug: x.slug, name: x.name })));
  }, [user?.dreamCompanyWatches]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setPortalsLoading(true);
      try {
        const { data } = await api.get('/career-scanner/portals');
        if (!cancelled) setPortals(data.data);
      } catch {
        if (!cancelled) toast.error('Could not load company list');
      } finally {
        if (!cancelled) setPortalsLoading(false);
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount once
  }, []);

  const fetchJobs = useCallback(async () => {
    setJobsLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(LIMIT),
        source: jobSource,
      });
      if (statusFilter) params.set('status', statusFilter);
      const { data } = await api.get(`/linkedin/jobs?${params}`);
      setJobs(data.data || []);
      setTotal(data.pagination?.total || 0);
    } catch {
      toast.error(jobSource === 'dream_company' ? 'Failed to load dream-company jobs' : 'Failed to load career-page matches');
    } finally {
      setJobsLoading(false);
    }
  }, [page, statusFilter, jobSource]);

  useEffect(() => { fetchJobs(); }, [fetchJobs]);

  useEffect(() => {
    setPage(1);
    setSelected(null);
  }, [jobSource]);

  const watchKey = (c) => `${c.platform}:${c.slug}`;
  const isWatched = (c) => watches.some((w) => watchKey(w) === watchKey(c));

  const addWatch = (c) => {
    if (isWatched(c)) return false;
    if (watches.length >= maxDreamWatches) {
      toast.error(`You can watch up to ${maxDreamWatches} companies on your plan`);
      return false;
    }
    setWatches((prev) => [...prev, { platform: c.platform, slug: c.slug, name: c.name }]);
    return true;
  };

  const removeWatch = (c) => {
    setWatches((prev) => prev.filter((w) => watchKey(w) !== watchKey(c)));
  };

  const saveWatches = async () => {
    setSavingWatches(true);
    try {
      await api.patch('/profile/dream-companies', { watches });
      await refetch();
      toast.success('Watched companies saved');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not save');
    } finally {
      setSavingWatches(false);
    }
  };

  const [remoteSuggestions, setRemoteSuggestions] = useState([]);
  const [suggestLoading, setSuggestLoading] = useState(false);

  /** When query is under 2 chars: alphabetical picks from our index only. */
  const localQuickPick = useMemo(() => {
    const list = portals?.companies || [];
    if (!list.length) return [];
    const watchedSet = new Set(watches.map((w) => `${w.platform}:${w.slug}`));
    return list
      .filter((c) => !watchedSet.has(`${c.platform}:${c.slug}`))
      .sort((a, b) => a.name.localeCompare(b.name))
      .slice(0, 20)
      .map((c) => ({ kind: 'tracked', platform: c.platform, slug: c.slug, name: c.name }));
  }, [portals, watches]);

  useEffect(() => {
    const q = watchQuery.trim();
    if (q.length < 2) {
      setRemoteSuggestions([]);
      setSuggestLoading(false);
      return;
    }
    const ctrl = new AbortController();
    setSuggestLoading(true);
    const tid = setTimeout(async () => {
      try {
        const { data } = await api.get('/career-scanner/company-suggest', {
          params: { q },
          signal:    ctrl.signal,
        });
        setRemoteSuggestions(data.data?.suggestions || []);
      } catch (err) {
        if (err?.code !== 'ERR_CANCELED' && err?.name !== 'CanceledError') setRemoteSuggestions([]);
      } finally {
        setSuggestLoading(false);
      }
    }, 280);
    return () => {
      clearTimeout(tid);
      ctrl.abort();
    };
  }, [watchQuery]);

  const displaySuggestions = useMemo(() => {
    if (watchQuery.trim().length < 2) return localQuickPick;
    return remoteSuggestions;
  }, [watchQuery, localQuickPick, remoteSuggestions]);

  function suggestionRowKey(s, i) {
    if (s.kind === 'tracked') return `t-${s.platform}-${s.slug}`;
    return `d-${s.domain || 'x'}-${String(s.name).slice(0, 40)}-${i}`;
  }

  function pickPortalFromSuggestion(s) {
    if (s.kind === 'tracked') return { platform: s.platform, slug: s.slug, name: s.name };
    if (s.kind === 'directory' && s.resolvedPortal) return s.resolvedPortal;
    return null;
  }

  useEffect(() => {
    setWatchHighlight(0);
  }, [watchQuery, displaySuggestions]);

  useEffect(() => {
    const onDoc = (e) => {
      if (!watchComboRef.current?.contains(e.target)) setWatchSuggestOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  const selectSuggestion = async (s) => {
    let portal = pickPortalFromSuggestion(s);
    if (!portal && s.kind === 'directory' && (s.domain || s.name)) {
      setDiscoveringWatch(true);
      try {
        const { data } = await api.post('/career-scanner/discover-board', {
          name:   s.name,
          domain: s.domain || '',
        });
        const d = data?.data;
        if (d?.platform && d?.slug) {
          portal = { platform: d.platform, slug: d.slug, name: d.name || s.name };
        }
      } catch (err) {
        toast.error(
          err.response?.data?.message
            || 'No public Greenhouse, Lever, or Ashby board matched. Try another spelling or pick from the index below.',
        );
        return;
      } finally {
        setDiscoveringWatch(false);
      }
    }
    if (!portal) {
      toast.info('Pick a suggestion with a known board, or type a company name so we can look up its careers API.');
      return;
    }
    if (!addWatch(portal)) return;
    setWatchQuery('');
    setWatchSuggestOpen(true);
    setWatchHighlight(0);
    toast.success(`Added ${portal.name} — click Save watches when you are done`);
  };

  const handleWatchKeyDown = (e) => {
    if (!watchSuggestOpen || !displaySuggestions.length) {
      if (e.key === 'ArrowDown' && displaySuggestions.length) {
        e.preventDefault();
        setWatchSuggestOpen(true);
      }
      return;
    }
    const max = displaySuggestions.length - 1;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setWatchHighlight((h) => Math.min(Math.min(h, max) + 1, max));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setWatchHighlight((h) => Math.max(Math.min(h, max) - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const s = displaySuggestions[Math.min(watchHighlight, max)];
      if (s) selectSuggestion(s);
    } else if (e.key === 'Escape') {
      setWatchSuggestOpen(false);
    }
  };

  const filteredCompanies = useMemo(() => {
    const list = portals?.companies || [];
    const q = companyQuery.trim().toLowerCase();
    if (!q) return list;
    return list.filter((c) => c.name.toLowerCase().includes(q) || c.slug.toLowerCase().includes(q));
  }, [portals, companyQuery]);

  const changePage = (p) => {
    setPage(p);
    setSelected(null);
  };

  return (
    <motion.div variants={stagger} initial="hidden" animate="show" className="space-y-5 max-w-6xl mx-auto">

      <motion.div variants={fadeUp}>
        <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
          <Building2 className="w-6 h-6 text-violet-600" />
          Top company career pages
        </h1>
        <p className="text-sm text-gray-500 mt-1 max-w-2xl">
          We poll public job boards (Greenhouse, Ashby, Lever) for curated tech companies. Profile-matched roles appear
          as “Career Page” jobs; boards you <strong>watch</strong> below can email you on <strong>any</strong> new
          opening there. Daily scan (~08:00 server time). Also listed in{' '}
          <Link to="/linkedin" className="text-violet-600 font-medium hover:underline">LinkedIn Jobs</Link>.
        </p>
      </motion.div>

      {!isPro && (
        <motion.div variants={fadeUp} className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <span className="font-semibold">Pro or Team</span> unlocks automatic profile-matched career scans.
          Dream-company watches work on Free too (up to {maxDreamWatches} boards).{' '}
          <Link to="/billing" className="text-violet-700 font-semibold hover:underline">View plans</Link>
        </motion.div>
      )}

      {isPro && !hasTargetRole && (
        <motion.div variants={fadeUp} className="rounded-2xl border border-violet-200 bg-violet-50 p-4 text-sm text-violet-900">
          Set a <span className="font-semibold">target role</span> in your profile so we can match relevant openings.
          {' '}<Link to="/profile" className="font-semibold hover:underline">Open profile</Link>
        </motion.div>
      )}

      <motion.div variants={fadeUp} className="grid sm:grid-cols-3 gap-3">
        <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Companies indexed</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">
            {portalsLoading ? '—' : portals?.total ?? 0}
          </p>
          <p className="text-xs text-gray-500 mt-1">Greenhouse · Ashby · Lever</p>
        </div>
        <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Your saved jobs</p>
          <p className="text-2xl font-bold text-violet-700 mt-1">{jobsLoading ? '—' : total}</p>
          <p className="text-xs text-gray-500 mt-1">
            {jobSource === 'dream_company' ? 'From watched companies' : 'Profile-matched (career page)'}
          </p>
        </div>
        <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm flex gap-3 items-start">
          <div className="w-10 h-10 rounded-xl bg-violet-50 flex items-center justify-center flex-shrink-0">
            <Clock className="w-5 h-5 text-violet-600" />
          </div>
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Schedule</p>
            <p className="text-sm font-semibold text-gray-900 mt-1">Daily scan</p>
            <p className="text-xs text-gray-500 mt-0.5">Dream emails: at most once per 24h when new roles appear</p>
          </div>
        </div>
      </motion.div>

      <motion.div variants={fadeUp} className="rounded-2xl border border-violet-200 bg-gradient-to-br from-violet-50/80 to-white p-4 shadow-sm">
        <div className="flex items-start gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-violet-100 flex items-center justify-center flex-shrink-0">
            <Heart className="w-5 h-5 text-violet-600" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs text-gray-600 leading-relaxed">
              Type a company name for suggestions (directory + our boards). You can only <strong>watch</strong> boards
              we index; when a <strong>new</strong> job appears we save it here and email you if alerts are on.
              Limit <strong>{maxDreamWatches}</strong> on your plan.
            </p>
          </div>
        </div>

        {watches.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-3">
            {watches.map((w) => (
              <span
                key={watchKey(w)}
                className="inline-flex items-center gap-1.5 pl-2.5 pr-1 py-1 rounded-full bg-white border border-violet-200 text-sm text-gray-800"
              >
                {w.name}
                <button
                  type="button"
                  aria-label={`Remove ${w.name}`}
                  onClick={() => removeWatch(w)}
                  className="p-0.5 rounded-full hover:bg-violet-100 text-gray-500"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </span>
            ))}
          </div>
        )}

        <div className="flex flex-col sm:flex-row gap-2 mb-1">
          <div className="relative flex-1 min-w-0" ref={watchComboRef}>
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
            <input
              type="search"
              value={watchQuery}
              onChange={(e) => {
                setWatchQuery(e.target.value);
                setWatchSuggestOpen(true);
              }}
              onFocus={() => setWatchSuggestOpen(true)}
              onKeyDown={handleWatchKeyDown}
              placeholder="Search any company name (2+ letters)…"
              autoComplete="off"
              aria-autocomplete="list"
              aria-expanded={watchSuggestOpen}
              aria-controls="dream-company-suggestions"
              className="input w-full text-sm pl-9"
              disabled={watches.length >= maxDreamWatches || discoveringWatch}
            />
            {watchSuggestOpen && !portalsLoading && watches.length < maxDreamWatches && (suggestLoading || discoveringWatch) && (
              <div className="absolute z-40 left-0 right-0 mt-1 rounded-xl border border-violet-200 bg-white shadow-lg px-3 py-4 flex items-center justify-center gap-2 text-sm text-gray-500">
                <Loader2 className="w-4 h-4 animate-spin text-violet-500" />
                {discoveringWatch ? 'Finding job board…' : 'Loading suggestions…'}
              </div>
            )}
            {watchSuggestOpen && !portalsLoading && !suggestLoading && !discoveringWatch && displaySuggestions.length > 0 && watches.length < maxDreamWatches && (
              <ul
                id="dream-company-suggestions"
                role="listbox"
                className="absolute z-40 left-0 right-0 mt-1 max-h-60 overflow-y-auto rounded-xl border border-violet-200 bg-white shadow-lg py-1"
              >
                {displaySuggestions.map((s, i) => {
                  const active = i === Math.min(watchHighlight, Math.max(0, displaySuggestions.length - 1));
                  const canAdd = Boolean(pickPortalFromSuggestion(s));
                  if (s.kind === 'tracked') {
                    const pm = PLATFORM_META[s.platform] || PLATFORM_META.lever;
                    return (
                      <li key={suggestionRowKey(s, i)} role="option" aria-selected={active}>
                        <button
                          type="button"
                          className={cn(
                            'w-full text-left px-3 py-2.5 flex items-center justify-between gap-2 text-sm transition-colors',
                            active ? 'bg-violet-50' : 'hover:bg-gray-50',
                          )}
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => selectSuggestion(s)}
                          onMouseEnter={() => setWatchHighlight(i)}
                        >
                          <span className="font-medium text-gray-900 truncate">{s.name}</span>
                          <span className={cn('text-[10px] font-semibold px-1.5 py-0.5 rounded border flex-shrink-0', pm.cls)}>
                            {pm.label}
                          </span>
                        </button>
                      </li>
                    );
                  }
                  return (
                    <li key={suggestionRowKey(s, i)} role="option" aria-selected={active}>
                      <button
                        type="button"
                        className={cn(
                          'w-full text-left px-3 py-2.5 flex items-center justify-between gap-2 text-sm transition-colors',
                          active ? 'bg-violet-50' : 'hover:bg-gray-50',
                          !canAdd && 'opacity-75',
                        )}
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => selectSuggestion(s)}
                        onMouseEnter={() => setWatchHighlight(i)}
                      >
                        <div className="min-w-0 flex-1">
                          <span className="font-medium text-gray-900 truncate block">{s.name}</span>
                          {s.domain && <span className="text-[11px] text-gray-400 truncate block">{s.domain}</span>}
                        </div>
                        <span className={cn(
                          'text-[10px] font-semibold px-1.5 py-0.5 rounded border flex-shrink-0',
                          canAdd ? 'bg-emerald-50 text-emerald-800 border-emerald-100' : 'bg-gray-50 text-gray-500 border-gray-100',
                        )}>
                          {canAdd ? 'Watch' : 'No board match'}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
            {watchSuggestOpen && !portalsLoading && !suggestLoading && !discoveringWatch && displaySuggestions.length === 0 && watches.length < maxDreamWatches && (
              <div className="absolute z-40 left-0 right-0 mt-1 rounded-xl border border-gray-200 bg-white shadow-lg px-3 py-2.5 text-xs text-gray-500">
                {watchQuery.trim().length >= 2
                  ? 'No suggestions — try another spelling.'
                  : portals?.companies?.length
                    ? 'Type at least 2 letters for directory search, or pick from the list above.'
                    : 'Loading…'}
              </div>
            )}
          </div>
          <button
            type="button"
            disabled={savingWatches}
            onClick={saveWatches}
            className="btn btn-primary btn-sm whitespace-nowrap"
          >
            {savingWatches ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save watches'}
          </button>
        </div>
        <p className="text-[11px] text-gray-500 mb-2">
          ↑/↓ + Enter to add. Directory rows need a match to one of our boards; tracked rows add immediately.
        </p>
      </motion.div>

      <motion.div variants={fadeUp} className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-violet-500" />
            <h2 className="font-semibold text-gray-900">Indexed companies</h2>
          </div>
          <input
            type="search"
            value={companyQuery}
            onChange={(e) => setCompanyQuery(e.target.value)}
            placeholder="Filter by name…"
            className="input max-w-xs text-sm"
          />
        </div>
        {portalsLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-violet-500" />
          </div>
        ) : (
          <div className="max-h-[320px] overflow-y-auto pr-1 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {filteredCompanies.map((c) => {
              const pm = PLATFORM_META[c.platform] || PLATFORM_META.lever;
              const href = boardUrl(c.platform, c.slug);
              return (
                <a
                  key={`${c.platform}-${c.slug}`}
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 rounded-xl border border-gray-100 px-3 py-2 hover:border-violet-200 hover:bg-violet-50/40 transition-colors group"
                >
                  <CompanyAvatar name={c.name} size="sm" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-gray-900 truncate">{c.name}</p>
                    <span className={cn('text-[10px] font-semibold px-1.5 py-0.5 rounded border inline-block mt-0.5', pm.cls)}>
                      {pm.label}
                    </span>
                  </div>
                  <ExternalLink className="w-3.5 h-3.5 text-gray-300 group-hover:text-violet-500 flex-shrink-0" />
                </a>
              );
            })}
          </div>
        )}
        {!portalsLoading && filteredCompanies.length === 0 && (
          <p className="text-sm text-gray-500 text-center py-6">No companies match that filter.</p>
        )}
      </motion.div>

      <motion.div variants={fadeUp}>
        <div className="flex flex-wrap gap-2 mb-3">
          <button
            type="button"
            onClick={() => setJobSource('career_page')}
            className={cn(
              'px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all',
              jobSource === 'career_page'
                ? 'bg-violet-600 text-white border-violet-600'
                : 'bg-white text-gray-600 border-gray-200 hover:border-violet-300',
            )}
          >
            Profile matches
          </button>
          <button
            type="button"
            onClick={() => setJobSource('dream_company')}
            className={cn(
              'px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all inline-flex items-center gap-1',
              jobSource === 'dream_company'
                ? 'bg-violet-600 text-white border-violet-600'
                : 'bg-white text-gray-600 border-gray-200 hover:border-violet-300',
            )}
          >
            <Heart className="w-3.5 h-3.5" /> Dream companies
          </button>
        </div>
        <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
          <h2 className="font-semibold text-gray-900">
            {jobSource === 'dream_company' ? 'Jobs from watched companies' : 'Profile-matched career jobs'}
          </h2>
          <div className="flex gap-2 flex-wrap">
            {['', 'new', 'saved', 'applied', 'ignored'].map((s) => (
              <button
                key={s || 'all'}
                type="button"
                onClick={() => { setStatusFilter(s); setPage(1); setSelected(null); }}
                className={cn(
                  'px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all capitalize',
                  statusFilter === s
                    ? 'bg-violet-600 text-white border-violet-600'
                    : 'bg-white text-gray-600 border-gray-200 hover:border-violet-300',
                )}
              >
                {s || 'All'}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          {jobsLoading ? (
            [...Array(4)].map((_, i) => (
              <div key={i} className="bg-white rounded-2xl border border-gray-100 p-4 flex items-center gap-3">
                <div className="skeleton w-9 h-9 rounded-lg flex-shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="skeleton h-4 w-2/3 rounded" />
                  <div className="skeleton h-3 w-1/3 rounded" />
                </div>
              </div>
            ))
          ) : jobs.length === 0 ? (
            <div className="bg-white rounded-2xl border border-gray-100 p-10 text-center">
              {jobSource === 'dream_company' ? (
                <>
                  <Heart className="w-10 h-10 text-violet-300 mx-auto mb-2" />
                  <p className="font-semibold text-gray-800">No dream-company jobs yet</p>
                  <p className="text-sm text-gray-500 mt-1 max-w-md mx-auto">
                    Add companies above and save. After the next daily scan, new listings on those boards appear here
                    and we email you when we find new URLs you have not seen before.
                  </p>
                </>
              ) : (
                <>
                  <Building2 className="w-10 h-10 text-violet-300 mx-auto mb-2" />
                  <p className="font-semibold text-gray-800">No career-page matches yet</p>
                  <p className="text-sm text-gray-500 mt-1 max-w-md mx-auto">
                    {isPro && hasTargetRole
                      ? 'The next daily scan may add roles that fit your target role. You can still browse company boards above.'
                      : 'Upgrade to Pro or Team and set a target role to receive automatic profile matches.'}
                  </p>
                </>
              )}
            </div>
          ) : (
            jobs.map((job) => {
              const sc = STATUS_CONFIG[job.status] || STATUS_CONFIG.new;
              return (
                <button
                  type="button"
                  key={job._id}
                  onClick={() => setSelected(job)}
                  className={cn(
                    'w-full text-left bg-white rounded-2xl border transition-all p-4',
                    selected?._id === job._id
                      ? 'border-violet-300 shadow-md'
                      : 'border-gray-100 hover:border-violet-200 hover:shadow-sm',
                  )}
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
                            {job.remote && (
                              <span className="text-xs bg-emerald-100 text-emerald-700 font-semibold px-1.5 py-0.5 rounded-full">
                                Remote
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5 flex-shrink-0">
                          {job.matchScore > 0 && (
                            <span
                              className={cn(
                                'flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold',
                                job.matchScore >= 75 ? 'bg-emerald-100 text-emerald-700'
                                  : job.matchScore >= 50 ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-500',
                              )}
                            >
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
                      <p className="text-xs text-violet-600 font-medium mt-1">
                        {job.source === 'dream_company' ? 'Dream watch · ' : 'Career page · '}
                        {fAgo(job.createdAt)}
                      </p>
                    </div>
                  </div>
                </button>
              );
            })
          )}
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-3 pt-4">
            <button
              type="button"
              disabled={page === 1}
              onClick={() => changePage(page - 1)}
              className="btn btn-secondary btn-sm"
            >
              <ChevronLeft className="w-4 h-4" /> Prev
            </button>
            <span className="text-sm font-medium text-gray-600">
              Page {page} of {totalPages} · {total} jobs
            </span>
            <button
              type="button"
              disabled={page >= totalPages}
              onClick={() => changePage(page + 1)}
              className="btn btn-secondary btn-sm"
            >
              Next <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </motion.div>

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
                mode="linkedin"
                onClose={() => setSelected(null)}
                onJobUpdate={(patch) => {
                  if (patch._deleted) {
                    setSelected(null);
                    fetchJobs();
                    return;
                  }
                  setJobs((prev) => prev.map((j) => (j._id === selected._id ? { ...j, ...patch } : j)));
                  setSelected((prev) => (prev ? { ...prev, ...patch } : prev));
                }}
              />
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
