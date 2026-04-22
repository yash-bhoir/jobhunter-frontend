import { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search as SearchIcon, MapPin, Briefcase, User,
  ChevronDown, ChevronUp, Loader2, Zap, Mail, CheckCircle,
  Clock, RefreshCw, Sparkles, History, ChevronRight,
  Wand2, ArrowRight, X, Target, Navigation, Building,
  Star, ExternalLink, Filter, Calendar, TrendingUp,
} from 'lucide-react';
import { useAuth }     from '@hooks/useAuth';
import { useSocket }   from '@hooks/useSocket';
import { useToast }    from '@hooks/useToast';
import { useDispatch } from 'react-redux';
import {
  startSearch, updateProgress, completeSearch, setSearchError,
} from '@store/slices/searchSlice';
import { setJobs }   from '@store/slices/jobsSlice';
import { api }       from '@utils/axios';
import { cn }        from '@utils/helpers';
import { PLATFORMS } from '@utils/constants';

const WORK_TYPES = [
  { value: 'any',    label: 'Any'     },
  { value: 'remote', label: 'Remote'  },
  { value: 'hybrid', label: 'Hybrid'  },
  { value: 'onsite', label: 'On-site' },
];

const EXP_LEVELS = [
  { value: 'any',       label: 'Any Level'  },
  { value: 'entry',     label: 'Entry'      },
  { value: 'mid',       label: 'Mid-Level'  },
  { value: 'senior',    label: 'Senior'     },
  { value: 'executive', label: 'Executive'  },
];

const DATE_POSTED = [
  { value: 'any',   label: 'Any Time'   },
  { value: '1',     label: 'Today'      },
  { value: '7',     label: 'Past Week'  },
  { value: '30',    label: 'Past Month' },
];

const SCORE_STYLE = (s) =>
  s >= 75 ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
  s >= 50 ? 'bg-amber-50 text-amber-700 border border-amber-200' :
            'bg-gray-100 text-gray-500';

const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  show:   { opacity: 1, y: 0, transition: { duration: 0.4, ease: 'easeOut' } },
};
const stagger  = { show: { transition: { staggerChildren: 0.08 } } };
const itemFade = {
  hidden: { opacity: 0, y: 8 },
  show:   { opacity: 1, y: 0, transition: { duration: 0.25 } },
};

/** Backend may send done, cached, skipped, or cluster reuse statuses */
function isTerminalSearchProgress(s) {
  return (
    s === 'done'
    || s === 'cached'
    || s === 'skipped'
    || s === 'reused_snapshot'
    || s === 'reused_sibling_snapshot'
  );
}

export default function Search() {
  const { user }  = useAuth();
  const toast     = useToast();
  const navigate  = useNavigate();
  const dispatch  = useDispatch();

  const userPlatforms = PLATFORMS.filter(p => !p.adminOnly);
  const [role,           setRole]           = useState(user?.profile?.targetRole || '');
  const [location,       setLocation]       = useState(user?.profile?.preferredLocations?.[0] || 'India');
  const [workType,       setWorkType]       = useState(user?.profile?.workType || 'any');
  const [expLevel,       setExpLevel]       = useState('any');
  const [datePosted,     setDatePosted]     = useState('any');
  const [platforms,      setPlatforms]      = useState(userPlatforms.map(p => p.id));
  const [showPlatforms,  setShowPlatforms]  = useState(false);
  const [showAdvanced,   setShowAdvanced]   = useState(false);
  const [loading,        setLoading]        = useState(false);
  const [profileLoading, setProfileLoading] = useState(false);
  const [progress,       setProgress]       = useState({});
  const [emailProgress,  setEmailProgress]  = useState(null);
  const [done,           setDone]           = useState(false);
  const [results,        setResults]        = useState(null);
  const [cacheInfo,      setCacheInfo]      = useState(null);
  const [history,        setHistory]        = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [suggestions,    setSuggestions]    = useState(null);
  const [suggestLoading, setSuggestLoading] = useState(false);
  const [showSugg,       setShowSugg]       = useState(false);

  const [radius,          setRadius]          = useState(0);
  const [locSuggestions,  setLocSuggestions]  = useState([]);
  const [locLoading,      setLocLoading]      = useState(false);
  const [showLocDrop,     setShowLocDrop]     = useState(false);
  const [geoLoading,      setGeoLoading]      = useState(false);
  const locDebounce   = useRef(null);
  const locInputRef   = useRef(null);
  const locDropRef    = useRef(null);
  const cacheDebounce   = useRef(null);
  const platformsRef    = useRef(platforms);

  useEffect(() => {
    platformsRef.current = platforms;
  }, [platforms]);

  const RADIUS_OPTIONS = [
    { label: 'Any', value: 0 },
    { label: '10 km', value: 10 },
    { label: '25 km', value: 25 },
    { label: '50 km', value: 50 },
    { label: '100 km', value: 100 },
  ];

  useEffect(() => {
    const handler = (e) => {
      if (locDropRef.current && !locDropRef.current.contains(e.target) &&
          locInputRef.current && !locInputRef.current.contains(e.target)) {
        setShowLocDrop(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const fetchLocSuggestions = (query) => {
    clearTimeout(locDebounce.current);
    if (!query.trim() || query.length < 2) { setLocSuggestions([]); setShowLocDrop(false); return; }
    locDebounce.current = setTimeout(async () => {
      setLocLoading(true);
      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&addressdetails=1&limit=6&featuretype=city`,
          { headers: { 'Accept-Language': 'en' } }
        );
        const data = await res.json();
        const formatted = data.map(r => {
          const a = r.address || {};
          const city    = a.city || a.town || a.village || a.county || r.name;
          const state   = a.state || '';
          const country = a.country || '';
          const label   = [city, state, country].filter(Boolean).join(', ');
          return { label, city, lat: r.lat, lon: r.lon };
        }).filter((v, i, arr) => arr.findIndex(x => x.label === v.label) === i);
        setLocSuggestions(formatted);
        setShowLocDrop(formatted.length > 0);
      } catch { setLocSuggestions([]); }
      finally { setLocLoading(false); }
    }, 300);
  };

  const pickLocation = (item) => {
    setLocation(item.label);
    setLocSuggestions([]);
    setShowLocDrop(false);
  };

  const useMyLocation = () => {
    if (!navigator.geolocation) { toast.error('Geolocation not supported'); return; }
    setGeoLoading(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const { latitude: lat, longitude: lon } = pos.coords;
          const res  = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json`, { headers: { 'Accept-Language': 'en' } });
          const data = await res.json();
          const a    = data.address || {};
          const city = a.city || a.town || a.village || a.county || data.name || 'Your location';
          const loc  = [city, a.state, a.country].filter(Boolean).join(', ');
          setLocation(loc);
          toast.success(`Location set to ${city}`);
        } catch { toast.error('Could not resolve location'); }
        finally { setGeoLoading(false); }
      },
      () => { toast.error('Location access denied'); setGeoLoading(false); }
    );
  };

  useEffect(() => {
    if (!role.trim()) { setCacheInfo(null); return; }
    clearTimeout(cacheDebounce.current);
    cacheDebounce.current = setTimeout(async () => {
      try {
        const params = new URLSearchParams({ role: role.trim(), ...(location && { location }), ...(workType && { workType }) });
        const { data } = await api.get(`/search/check-cache?${params}`);
        setCacheInfo(data.data?.hasCache ? data.data : null);
      } catch { setCacheInfo(null); }
    }, 800);
    return () => clearTimeout(cacheDebounce.current);
  }, [role, location, workType]);

  useEffect(() => {
    setHistoryLoading(true);
    api.get('/search/history?limit=6').then(({ data }) => setHistory(data.data || [])).catch(() => {}).finally(() => setHistoryLoading(false));
  }, []);

  useSocket('search:progress', (data) => {
    setProgress((prev) => {
      const clusterReuse =
        data.platform === 'cluster'
        || data.status === 'reused_snapshot'
        || data.status === 'reused_sibling_snapshot';
      if (clusterReuse) {
        const ids = platformsRef.current?.length ? platformsRef.current : [];
        const total = Math.max(0, Number(data.found) || 0);
        const n = Math.max(ids.length, 1);
        const base = Math.floor(total / n);
        const rem = total - base * n;
        const next = { ...prev, cluster: data };
        ids.forEach((pid, i) => {
          next[pid] = {
            platform:       pid,
            found:          base + (i < rem ? 1 : 0),
            status:         'done',
            sourceCluster:  true,
            clusterStatus:  data.status,
          };
        });
        return next;
      }
      return { ...prev, [data.platform]: data };
    });
    dispatch(updateProgress(data));
  });
  useSocket('search:email_finding', (data) => {
    setEmailProgress(data);
    if (data.status === 'done' && data.found > 0) toast.success(`Found ${data.found} HR email contacts!`);
  });
  useSocket('search:complete', () => { dispatch(completeSearch()); setDone(true); });

  const togglePlatform = (id) => setPlatforms(prev => prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]);

  const loadResumeSuggestions = async () => {
    setSuggestLoading(true);
    try {
      const { data } = await api.get('/search/resume-suggest');
      setSuggestions(data.data); setShowSugg(true);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Upload your resume first');
    } finally { setSuggestLoading(false); }
  };

  const applySuggestion = (s) => {
    setRole(s.role); setLocation(s.location || ''); setWorkType(s.workType || 'any');
    setShowSugg(false); toast.success(`Applied: ${s.label}`);
  };

  const loadFromProfile = async () => {
    setProfileLoading(true);
    try {
      const { data } = await api.get('/search/profile-search');
      setRole(data.data.role); setLocation(data.data.location); setWorkType(data.data.workType || 'any');
      toast.success('Filled from your profile!');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Complete your profile first');
    } finally { setProfileLoading(false); }
  };

  const handleSearch = async (force = false) => {
    if (!role.trim()) { toast.error('Please enter a job role'); return; }
    if (platforms.length === 0) { toast.error('Select at least one platform'); return; }
    setLoading(true); setDone(false); setProgress({}); setEmailProgress(null); setResults(null); setCacheInfo(null);
    dispatch(startSearch(null));
    try {
      const { data } = await api.post('/search/run',
        {
          role: role.trim(),
          location: location.trim() || 'India',
          workType,
          platforms,
          force,
          ...(radius > 0 && { radius }),
          ...(expLevel !== 'any' && { expLevel }),
          ...(datePosted !== 'any' && { datePosted }),
        },
        { timeout: 90000 }
      );
      setResults(data.data);
      dispatch(setJobs(data.data.jobs || []));
      dispatch(completeSearch()); setDone(true);
      if (data.data.fromCache) toast.success('Loaded from cache — saved 10 credits!');
      else toast.success(`Found ${data.data.totalFound} jobs!`);
      api.get('/search/history?limit=6').then(({ data: h }) => setHistory(h.data || [])).catch(() => {});
      const sid = data.data?.searchId;
      navigate(sid ? `/results?searchId=${sid}` : '/results', { replace: false });
    } catch (err) {
      if (err.code === 'ECONNABORTED' || err.message?.includes('timeout')) {
        toast('Search is taking longer than usual — checking results…');
        dispatch(completeSearch()); setDone(true);
        setTimeout(() => navigate('/results'), 3000);
      } else {
        dispatch(setSearchError(err.response?.data?.message || 'Search failed'));
        toast.error(err.response?.data?.message || 'Search failed');
      }
    } finally { setLoading(false); }
  };

  const isPro     = user?.plan === 'pro' || user?.plan === 'team';
  const doneJobs  = results?.jobs?.length || 0;
  const doneEmails = results?.emailsFound || 0;

  // Client-side filter for inline results
  const filteredResults = (() => {
    if (!results?.jobs) return [];
    let jobs = [...results.jobs];
    if (expLevel !== 'any') {
      const kw = expLevel === 'entry' ? ['entry', 'junior', 'fresher', 'graduate', 'trainee', '0-2', '0-1'] :
                 expLevel === 'mid'   ? ['mid', 'intermediate', '2-5', '3-5', '2-4'] :
                 expLevel === 'senior' ? ['senior', 'lead', 'principal', 'staff', '5+', '6+', '7+'] :
                                        ['executive', 'director', 'vp', 'head', 'chief', 'cto', 'ceo'];
      jobs = jobs.filter(j => kw.some(k => (j.title || '').toLowerCase().includes(k) || (j.description || '').toLowerCase().includes(k)));
    }
    if (datePosted !== 'any') {
      const cutoff = new Date(Date.now() - parseInt(datePosted) * 86400000);
      jobs = jobs.filter(j => j.postedAt ? new Date(j.postedAt) >= cutoff : true);
    }
    return jobs;
  })();

  return (
    <motion.div variants={stagger} initial="hidden" animate="show" className="space-y-4">

      {/* Header */}
      <motion.div variants={fadeUp}>
        <h1 className="text-xl font-bold text-gray-900">
          Find your{' '}
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-violet-600">
            dream job
          </span>
        </h1>
        <p className="text-sm text-gray-400 mt-0.5">
          {userPlatforms.length} platforms · HR emails · AI outreach
        </p>
      </motion.div>

      {/* Two-column layout on desktop */}
      <div className="lg:grid lg:grid-cols-[1fr_280px] lg:gap-5 space-y-4 lg:space-y-0">

        {/* ── LEFT: main area ─────────────────────────────────────── */}
        <div className="space-y-4 min-w-0">

          {/* Search card */}
          <motion.div
            variants={fadeUp}
            className="bg-white rounded-2xl border border-gray-100 overflow-hidden"
            style={{ boxShadow: '0 4px 24px -4px rgba(0,0,0,0.08)' }}
          >
            <div className="h-0.5 w-full bg-gradient-to-r from-blue-500 via-violet-500 to-indigo-500" />
            <div className="p-5 space-y-3.5">

              {/* Role */}
              <div className="relative group">
                <Briefcase className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 group-focus-within:text-blue-500 transition-colors" />
                <input
                  type="text"
                  value={role}
                  onChange={e => setRole(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleSearch(false)}
                  placeholder="Job role — e.g. React Developer, Data Scientist"
                  className="input pl-10 pr-9 py-3 rounded-xl text-sm"
                />
                {role && (
                  <button onClick={() => setRole('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-300 hover:text-gray-500 transition-colors">
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>

              {/* Location with autocomplete */}
              <div className="relative" ref={locDropRef}>
                <div className="relative flex items-center">
                  <MapPin className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                  <input
                    ref={locInputRef}
                    type="text"
                    value={location}
                    onChange={e => { setLocation(e.target.value); fetchLocSuggestions(e.target.value); }}
                    onFocus={() => { if (locSuggestions.length > 0) setShowLocDrop(true); }}
                    onKeyDown={e => { if (e.key === 'Escape') setShowLocDrop(false); }}
                    placeholder="Location — e.g. Mumbai, Remote"
                    className="input pl-10 pr-10 py-3 rounded-xl text-sm w-full"
                    autoComplete="off"
                  />
                  <button
                    type="button"
                    onClick={useMyLocation}
                    disabled={geoLoading}
                    title="Use my location"
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-blue-500 transition-colors"
                  >
                    {geoLoading
                      ? <Loader2 className="w-4 h-4 animate-spin text-blue-500" />
                      : locLoading
                        ? <Loader2 className="w-4 h-4 animate-spin" />
                        : <Navigation className="w-4 h-4" />}
                  </button>
                </div>
                <AnimatePresence>
                  {showLocDrop && locSuggestions.length > 0 && (
                    <motion.ul
                      initial={{ opacity: 0, y: -4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -4 }}
                      transition={{ duration: 0.15 }}
                      className="absolute z-50 left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden"
                    >
                      {locSuggestions.map((s, i) => (
                        <li key={i}>
                          <button
                            type="button"
                            onMouseDown={() => pickLocation(s)}
                            className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-left hover:bg-blue-50 transition-colors group"
                          >
                            <MapPin className="w-3.5 h-3.5 text-gray-300 group-hover:text-blue-500 flex-shrink-0 transition-colors" />
                            <span className="text-sm text-gray-700 truncate">{s.label}</span>
                          </button>
                        </li>
                      ))}
                    </motion.ul>
                  )}
                </AnimatePresence>
              </div>

              {/* Work type pills */}
              <div>
                <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5">Work Type</p>
                <div className="flex gap-1.5 sm:gap-2">
                  {WORK_TYPES.map(({ value, label }) => (
                    <button
                      key={value}
                      onClick={() => setWorkType(value)}
                      className={cn(
                        'flex-1 py-2 text-xs font-semibold rounded-lg border transition-all duration-150',
                        workType === value
                          ? 'bg-blue-600 text-white border-blue-600'
                          : 'bg-white text-gray-500 border-gray-200 hover:border-blue-300 hover:text-blue-600'
                      )}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Radius — for on-site / hybrid */}
              <AnimatePresence>
                {(workType === 'onsite' || workType === 'hybrid') && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium text-gray-400 flex-shrink-0">Within</span>
                      <div className="flex gap-1.5 flex-wrap">
                        {RADIUS_OPTIONS.map(({ label, value }) => (
                          <button
                            key={value}
                            type="button"
                            onClick={() => setRadius(value)}
                            className={cn(
                              'px-2.5 py-1 text-xs font-semibold rounded-lg border transition-all duration-150',
                              radius === value
                                ? 'bg-blue-600 text-white border-blue-600'
                                : 'bg-white text-gray-500 border-gray-200 hover:border-blue-300 hover:text-blue-600'
                            )}
                          >
                            {label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Advanced filters toggle */}
              <button
                onClick={() => setShowAdvanced(v => !v)}
                className="flex items-center gap-1.5 text-xs font-medium text-gray-500 hover:text-blue-600 transition-colors"
              >
                <Filter className="w-3.5 h-3.5" />
                Advanced Filters
                {showAdvanced ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                {(expLevel !== 'any' || datePosted !== 'any') && (
                  <span className="ml-1 px-1.5 py-0.5 bg-blue-100 text-blue-700 text-[10px] font-bold rounded-full">
                    {[expLevel !== 'any', datePosted !== 'any'].filter(Boolean).length}
                  </span>
                )}
              </button>

              {/* Advanced filters panel */}
              <AnimatePresence>
                {showAdvanced && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="border border-gray-100 rounded-xl p-3 bg-gray-50/60 space-y-3">

                      {/* Experience Level */}
                      <div>
                        <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                          <TrendingUp className="w-3 h-3" /> Experience Level
                        </p>
                        <div className="flex flex-wrap gap-1.5">
                          {EXP_LEVELS.map(({ value, label }) => (
                            <button
                              key={value}
                              onClick={() => setExpLevel(value)}
                              className={cn(
                                'px-2.5 py-1.5 text-xs font-semibold rounded-lg border transition-all duration-150',
                                expLevel === value
                                  ? 'bg-violet-600 text-white border-violet-600'
                                  : 'bg-white text-gray-500 border-gray-200 hover:border-violet-300 hover:text-violet-600'
                              )}
                            >
                              {label}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Date Posted */}
                      <div>
                        <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                          <Calendar className="w-3 h-3" /> Date Posted
                        </p>
                        <div className="flex flex-wrap gap-1.5">
                          {DATE_POSTED.map(({ value, label }) => (
                            <button
                              key={value}
                              onClick={() => setDatePosted(value)}
                              className={cn(
                                'px-2.5 py-1.5 text-xs font-semibold rounded-lg border transition-all duration-150',
                                datePosted === value
                                  ? 'bg-indigo-600 text-white border-indigo-600'
                                  : 'bg-white text-gray-500 border-gray-200 hover:border-indigo-300 hover:text-indigo-600'
                              )}
                            >
                              {label}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Platforms */}
                      <div>
                        <button
                          onClick={() => setShowPlatforms(v => !v)}
                          className="flex items-center gap-1.5 text-[10px] font-semibold text-gray-400 uppercase tracking-wider hover:text-gray-600 transition-colors"
                        >
                          {showPlatforms ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                          Platforms ({platforms.length}/{userPlatforms.length})
                        </button>
                        <AnimatePresence>
                          {showPlatforms && (
                            <motion.div
                              initial={{ opacity: 0, height: 0 }}
                              animate={{ opacity: 1, height: 'auto' }}
                              exit={{ opacity: 0, height: 0 }}
                              className="overflow-hidden mt-2"
                            >
                              <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                                {userPlatforms.map((platform) => {
                                  const isSelected = platforms.includes(platform.id);
                                  const locked     = platform.proOnly && !isPro;
                                  return (
                                    <button
                                      key={platform.id}
                                      onClick={() => !locked && togglePlatform(platform.id)}
                                      disabled={locked}
                                      className={cn(
                                        'flex items-center gap-2 px-3 py-2 rounded-lg border text-left transition-all text-xs',
                                        locked     ? 'opacity-40 cursor-not-allowed bg-gray-100 border-gray-200' :
                                        isSelected ? 'bg-blue-50 border-blue-300 text-blue-800 font-semibold' :
                                                     'bg-white border-gray-200 text-gray-600 hover:border-blue-200'
                                      )}
                                    >
                                      <div className={cn(
                                        'w-3.5 h-3.5 rounded border-2 flex items-center justify-center flex-shrink-0',
                                        isSelected ? 'bg-blue-600 border-blue-600' : 'border-gray-300'
                                      )}>
                                        {isSelected && (
                                          <svg className="w-2 h-2 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                          </svg>
                                        )}
                                      </div>
                                      <span className="truncate">{platform.name}</span>
                                      {locked && <span className="ml-auto text-[9px] bg-amber-100 text-amber-600 font-semibold px-1 py-0.5 rounded">Pro</span>}
                                    </button>
                                  );
                                })}
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Helper row */}
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  onClick={loadFromProfile}
                  disabled={profileLoading}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-violet-700 bg-violet-50 hover:bg-violet-100 border border-violet-200 rounded-lg transition-colors"
                >
                  {profileLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <User className="w-3 h-3" />}
                  From profile
                </button>
                <button
                  onClick={loadResumeSuggestions}
                  disabled={suggestLoading}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-lg transition-colors"
                >
                  {suggestLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Wand2 className="w-3 h-3" />}
                  AI suggest
                </button>
              </div>

              {/* AI Suggestions */}
              <AnimatePresence>
                {showSugg && suggestions && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-semibold text-indigo-700 flex items-center gap-1">
                          <Sparkles className="w-3.5 h-3.5" /> Based on your resume
                        </p>
                        <button onClick={() => setShowSugg(false)} className="text-indigo-300 hover:text-indigo-600">
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      {suggestions.detectedStacks?.length > 0 && (
                        <p className="text-xs text-indigo-400">Detected: {suggestions.detectedStacks.join(', ')}</p>
                      )}
                      <div className="space-y-1.5">
                        {suggestions.suggestions.map((s, i) => (
                          <motion.button
                            key={i}
                            initial={{ opacity: 0, x: -8 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: i * 0.05 }}
                            onClick={() => applySuggestion(s)}
                            className="w-full flex items-center justify-between gap-2 px-3 py-2 bg-white rounded-lg border border-indigo-100 hover:border-indigo-300 text-left transition-all group"
                          >
                            <div className="min-w-0">
                              <p className="text-sm font-semibold text-gray-900 truncate">{s.label}</p>
                              <p className="text-xs text-gray-400 truncate">{s.description}</p>
                            </div>
                            <ArrowRight className="w-3.5 h-3.5 text-indigo-300 group-hover:text-indigo-600 flex-shrink-0 transition-colors" />
                          </motion.button>
                        ))}
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Cache banner */}
              <AnimatePresence>
                {cacheInfo && !loading && !done && (
                  <motion.div
                    initial={{ opacity: 0, y: -6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    className="flex items-center justify-between gap-3 px-3 py-2.5 bg-emerald-50 border border-emerald-200 rounded-xl"
                  >
                    <div className="flex items-center gap-2">
                      <Clock className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" />
                      <p className="text-xs font-semibold text-emerald-800">
                        {cacheInfo.jobCount} cached · {cacheInfo.ageDays === 0 ? 'today' : `${cacheInfo.ageDays}d ago`}
                      </p>
                    </div>
                    <div className="flex gap-1.5">
                      <button onClick={() => handleSearch(false)} className="btn btn-sm bg-emerald-600 text-white hover:bg-emerald-700 text-xs px-2.5 py-1">
                        <Sparkles className="w-3 h-3" /> Free
                      </button>
                      <button onClick={() => handleSearch(true)} className="btn btn-sm btn-secondary text-xs px-2.5 py-1">
                        <RefreshCw className="w-3 h-3" /> Fresh
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Search button */}
              <motion.button
                onClick={() => handleSearch(false)}
                disabled={loading}
                whileHover={{ scale: loading ? 1 : 1.01 }}
                whileTap={{ scale: loading ? 1 : 0.98 }}
                className="w-full py-3 rounded-xl text-white font-semibold text-sm flex items-center justify-center gap-2"
                style={{ background: loading ? '#93c5fd' : 'linear-gradient(135deg, #2563eb 0%, #7c3aed 100%)' }}
              >
                {loading
                  ? <><Loader2 className="w-4 h-4 animate-spin" /> Searching {platforms.length} platforms…</>
                  : <><SearchIcon className="w-4 h-4" /> Search Jobs + Find HR Emails</>
                }
              </motion.button>

              {!isPro && (
                <p className="text-[11px] text-center text-gray-400">
                  Free plan · HR emails for top 2 companies ·{' '}
                  <a href="/billing" className="text-blue-600 font-semibold hover:underline">Upgrade</a>
                </p>
              )}
            </div>
          </motion.div>

          {/* Live progress */}
          <AnimatePresence>
            {loading && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="bg-white rounded-2xl border border-gray-100 p-5 space-y-3.5"
                style={{ boxShadow: '0 4px 20px -4px rgba(0,0,0,0.07)' }}
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-blue-50 flex items-center justify-center">
                    <Zap className="w-4 h-4 text-blue-600 animate-pulse" />
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900 text-sm">Scanning platforms…</p>
                    <p className="text-xs text-gray-400">Takes 15–30 seconds</p>
                  </div>
                </div>
                <div className="space-y-2">
                  {userPlatforms.filter(p => platforms.includes(p.id)).map((platform, i) => {
                    const p = progress[platform.id];
                    const status = !p
                      ? 'waiting'
                      : isTerminalSearchProgress(p.status)
                        ? 'done'
                        : p.status === 'error'
                          ? 'error'
                          : 'running';
                    const doneLabel = () => {
                      if (!p) return '—';
                      if (p.sourceCluster) return '✓ Shared pool';
                      if (p.status === 'cached') return `✓ ${p.found} cached`;
                      if (p.status === 'skipped') return '— Skipped';
                      return `✓ ${p.found} jobs`;
                    };
                    return (
                      <motion.div key={platform.id} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.04 }} className="flex items-center gap-3">
                        <span className={cn('w-2 h-2 rounded-full flex-shrink-0', status === 'done' ? 'bg-emerald-500' : status === 'error' ? 'bg-red-400' : status === 'running' ? 'bg-blue-500 animate-pulse' : 'bg-gray-200')} />
                        <span className="text-sm text-gray-700 flex-1">{platform.name}</span>
                        <span className={cn('text-xs font-medium', status === 'done' ? 'text-emerald-600' : status === 'error' ? 'text-red-400' : 'text-gray-300')}>
                          {status === 'done' ? doneLabel() : status === 'error' ? '✗ Failed' : status === 'running' ? 'Searching…' : '—'}
                        </span>
                      </motion.div>
                    );
                  })}
                </div>
                <div className="pt-3 border-t border-gray-100 flex items-center gap-2">
                  <Mail className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" />
                  <p className="text-xs text-gray-400">
                    {emailProgress
                      ? emailProgress.status === 'started'
                        ? `Finding HR emails for ${emailProgress.total} companies…`
                        : `✓ Found emails for ${emailProgress.found} companies`
                      : 'HR email search queued…'}
                  </p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* ── Inline Results ─────────────────────────────────────── */}
          <AnimatePresence>
            {done && results && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="space-y-3"
              >
                {/* Summary bar */}
                <div
                  className="rounded-2xl overflow-hidden"
                  style={{
                    background: results.fromCache
                      ? 'linear-gradient(135deg, #d1fae5, #a7f3d0)'
                      : 'linear-gradient(135deg, #dbeafe, #e0e7ff)',
                    boxShadow: '0 4px 24px -4px rgba(0,0,0,0.1)',
                  }}
                >
                  <div className="p-4">
                    <div className="flex items-center gap-3 mb-3">
                      <div className={cn('w-9 h-9 rounded-xl flex items-center justify-center', results.fromCache ? 'bg-emerald-500' : 'bg-blue-500')}>
                        {results.fromCache ? <Sparkles className="w-4 h-4 text-white" /> : <CheckCircle className="w-4 h-4 text-white" />}
                      </div>
                      <div className="flex-1">
                        <p className="font-bold text-gray-900 text-sm">{results.fromCache ? 'Loaded from cache!' : 'Search complete!'}</p>
                        <p className="text-xs text-gray-500">{results.fromCache ? '10 credits saved 🎉' : `${Math.round((results.durationMs || 0) / 1000)}s total`}</p>
                      </div>
                      <Link
                        to={`/results${results.searchId ? `?searchId=${results.searchId}` : ''}`}
                        className="flex items-center gap-1 text-xs font-bold text-blue-700 bg-white/80 hover:bg-white px-3 py-1.5 rounded-lg transition-colors"
                      >
                        View all <ChevronRight className="w-3 h-3" />
                      </Link>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      {[
                        { label: 'Jobs Found', value: doneJobs },
                        { label: 'HR Emails',  value: doneEmails },
                        { label: results.fromCache ? 'Credits' : 'Platforms', value: results.fromCache ? 'FREE' : results.platformResults?.length },
                      ].map(({ label, value }) => (
                        <div key={label} className="bg-white/70 backdrop-blur-sm rounded-xl p-2.5 text-center">
                          <p className="text-lg font-black text-gray-800">{value}</p>
                          <p className="text-[10px] text-gray-500">{label}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Active filter badges */}
                {(expLevel !== 'any' || datePosted !== 'any') && filteredResults.length !== results.jobs?.length && (
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs text-gray-400">Filtered to {filteredResults.length} jobs</span>
                    {expLevel !== 'any' && (
                      <span className="flex items-center gap-1 px-2 py-0.5 bg-violet-100 text-violet-700 text-xs font-semibold rounded-full">
                        {EXP_LEVELS.find(e => e.value === expLevel)?.label}
                        <button onClick={() => setExpLevel('any')}><X className="w-3 h-3" /></button>
                      </span>
                    )}
                    {datePosted !== 'any' && (
                      <span className="flex items-center gap-1 px-2 py-0.5 bg-indigo-100 text-indigo-700 text-xs font-semibold rounded-full">
                        {DATE_POSTED.find(d => d.value === datePosted)?.label}
                        <button onClick={() => setDatePosted('any')}><X className="w-3 h-3" /></button>
                      </span>
                    )}
                  </div>
                )}

                {/* Job list */}
                {filteredResults.length > 0 ? (
                  <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden" style={{ boxShadow: '0 4px 24px -4px rgba(0,0,0,0.07)' }}>
                    <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
                      <p className="font-semibold text-gray-800 text-sm">
                        Results <span className="text-gray-400 font-normal">({filteredResults.length} jobs)</span>
                      </p>
                      <Link
                        to={`/results${results.searchId ? `?searchId=${results.searchId}` : ''}`}
                        className="text-xs text-blue-600 font-semibold hover:underline flex items-center gap-0.5"
                      >
                        Manage all <ChevronRight className="w-3 h-3" />
                      </Link>
                    </div>
                    <motion.div variants={stagger} initial="hidden" animate="show" className="divide-y divide-gray-50">
                      {filteredResults.slice(0, 20).map((job, i) => (
                        <motion.div
                          key={job._id || i}
                          variants={itemFade}
                          className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50 transition-colors group"
                        >
                          <div
                            className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-black text-sm flex-shrink-0"
                            style={{ background: `hsl(${(job.company?.charCodeAt(0) || 65) * 5 % 360}, 65%, 55%)` }}
                          >
                            {job.company?.[0]?.toUpperCase() || '?'}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="font-semibold text-gray-900 text-sm truncate">{job.title}</p>
                            <p className="text-xs text-gray-400 mt-0.5 flex items-center gap-1.5">
                              <Building className="w-3 h-3" /> {job.company}
                              {job.location && <><MapPin className="w-3 h-3 ml-1" /> {typeof job.location === 'string' ? job.location : job.location?.address}</>}
                            </p>
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            {job.matchScore > 0 && (
                              <span className={cn('text-xs font-bold px-2 py-0.5 rounded-full', SCORE_STYLE(job.matchScore))}>
                                {job.matchScore}%
                              </span>
                            )}
                            {job.url && (
                              <a
                                href={job.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={e => e.stopPropagation()}
                                className="p-1 text-gray-300 hover:text-blue-500 transition-colors"
                              >
                                <ExternalLink className="w-3.5 h-3.5" />
                              </a>
                            )}
                          </div>
                        </motion.div>
                      ))}
                    </motion.div>
                    {filteredResults.length > 20 && (
                      <div className="px-4 py-3 border-t border-gray-100 text-center">
                        <Link
                          to={`/results${results.searchId ? `?searchId=${results.searchId}` : ''}`}
                          className="text-xs text-blue-600 font-semibold hover:underline"
                        >
                          + {filteredResults.length - 20} more jobs in Results →
                        </Link>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="bg-white rounded-2xl border border-gray-100 p-8 text-center">
                    <p className="text-sm text-gray-400">No jobs match the active filters.</p>
                    <button onClick={() => { setExpLevel('any'); setDatePosted('any'); }} className="mt-2 text-xs text-blue-600 font-semibold hover:underline">
                      Clear filters
                    </button>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>

          {/* ── Recent Searches (below form) ───────────────────────── */}
          {!loading && history.length > 0 && (
            <motion.div
              variants={fadeUp}
              className="bg-white rounded-2xl border border-gray-100 overflow-hidden"
              style={{ boxShadow: '0 2px 12px -2px rgba(0,0,0,0.05)' }}
            >
              <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
                <div className="flex items-center gap-2">
                  <History className="w-3.5 h-3.5 text-gray-400" />
                  <p className="text-sm font-semibold text-gray-700">Recent Searches</p>
                </div>
                <button onClick={() => navigate('/results')} className="text-xs text-blue-600 font-semibold hover:underline flex items-center gap-0.5">
                  All results <ChevronRight className="w-3 h-3" />
                </button>
              </div>
              {historyLoading ? (
                <div className="p-3 space-y-2">
                  {[...Array(3)].map((_, i) => <div key={i} className="skeleton h-8 rounded-lg" />)}
                </div>
              ) : (
                <motion.div variants={stagger} initial="hidden" animate="show" className="divide-y divide-gray-50">
                  {history.map(s => {
                    const ageDays = Math.floor((Date.now() - new Date(s.createdAt)) / 86400000);
                    return (
                      <motion.div
                        key={s._id}
                        variants={itemFade}
                        onClick={() => navigate(`/results?searchId=${s._id}`)}
                        className="flex items-center gap-2.5 px-4 py-2.5 hover:bg-slate-50 cursor-pointer transition-colors group"
                      >
                        <div className="w-7 h-7 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0">
                          <SearchIcon className="w-3.5 h-3.5 text-blue-500" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold text-gray-800 truncate">{s.query?.role}</p>
                          <p className="text-xs text-gray-400 truncate">
                            {s.query?.location} · {ageDays === 0 ? 'Today' : ageDays === 1 ? 'Yesterday' : `${ageDays}d ago`}
                            {s.totalFound > 0 && <span className="ml-1.5 text-emerald-500 font-medium">{s.totalFound} jobs</span>}
                          </p>
                        </div>
                        <ChevronRight className="w-3.5 h-3.5 text-gray-300 group-hover:text-blue-400 flex-shrink-0 transition-colors" />
                      </motion.div>
                    );
                  })}
                </motion.div>
              )}
            </motion.div>
          )}
        </div>

        {/* ── RIGHT: feature tiles only ────────────────────────────── */}
        <div className="space-y-3">
          <motion.div variants={fadeUp} className="grid grid-cols-2 lg:grid-cols-1 gap-2">
            {[
              { icon: SearchIcon, title: `${userPlatforms.length}+ Platforms`, desc: 'Searched at once',       color: 'blue'    },
              { icon: Target,     title: 'AI Match Score',  desc: 'Ranked by fit',          color: 'violet'  },
              { icon: Mail,       title: 'HR Emails',       desc: 'Auto-found contacts',    color: 'emerald' },
              { icon: Zap,        title: 'Smart Cache',     desc: 'Free reuse for 30 days', color: 'amber'   },
            ].map(({ icon: Icon, title, desc, color }) => (
              <div key={title} className={cn(
                'flex items-center gap-3 p-3 rounded-xl border',
                color === 'blue'    ? 'bg-blue-50/60 border-blue-100' :
                color === 'violet'  ? 'bg-violet-50/60 border-violet-100' :
                color === 'emerald' ? 'bg-emerald-50/60 border-emerald-100' :
                                      'bg-amber-50/60 border-amber-100'
              )}>
                <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0',
                  color === 'blue'    ? 'bg-blue-100' :
                  color === 'violet'  ? 'bg-violet-100' :
                  color === 'emerald' ? 'bg-emerald-100' : 'bg-amber-100'
                )}>
                  <Icon className={cn('w-4 h-4',
                    color === 'blue'    ? 'text-blue-600' :
                    color === 'violet'  ? 'text-violet-600' :
                    color === 'emerald' ? 'text-emerald-600' : 'text-amber-600'
                  )} />
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-800">{title}</p>
                  <p className="text-xs text-gray-400">{desc}</p>
                </div>
              </div>
            ))}
          </motion.div>

          {/* Quick tip */}
          <motion.div variants={fadeUp} className="bg-gradient-to-br from-violet-50 to-indigo-50 border border-violet-100 rounded-2xl p-4">
            <div className="flex items-center gap-2 mb-1.5">
              <Sparkles className="w-4 h-4 text-violet-500" />
              <p className="text-xs font-bold text-violet-700 uppercase tracking-wide">Pro Tip</p>
            </div>
            <p className="text-xs text-violet-800 leading-relaxed">
              After searching, use the Outreach tab to send personalised AI-written emails to the HR contacts found automatically.
            </p>
          </motion.div>
        </div>
      </div>
    </motion.div>
  );
}
