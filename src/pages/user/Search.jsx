import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search as SearchIcon, MapPin, Briefcase, User,
  ChevronDown, ChevronUp, Loader2, Zap, Mail, CheckCircle,
  Clock, RefreshCw, Sparkles, History, ChevronRight, FileText,
  Wand2, ArrowRight, Target, X
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
  { value: 'any',    label: 'Any',     emoji: '🌐' },
  { value: 'remote', label: 'Remote',  emoji: '🏠' },
  { value: 'hybrid', label: 'Hybrid',  emoji: '⚡' },
  { value: 'onsite', label: 'On-site', emoji: '🏢' },
];

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  show:   { opacity: 1, y: 0, transition: { duration: 0.4, ease: 'easeOut' } },
};

const stagger = {
  show: { transition: { staggerChildren: 0.07 } },
};

const itemFade = {
  hidden: { opacity: 0, y: 10 },
  show:   { opacity: 1, y: 0, transition: { duration: 0.3 } },
};

export default function Search() {
  const { user }  = useAuth();
  const toast     = useToast();
  const navigate  = useNavigate();
  const dispatch  = useDispatch();

  const userPlatforms = PLATFORMS.filter(p => !p.adminOnly);
  const [role,          setRole]          = useState(user?.profile?.targetRole || '');
  const [location,      setLocation]      = useState(user?.profile?.preferredLocations?.[0] || 'India');
  const [workType,      setWorkType]      = useState(user?.profile?.workType || 'any');
  const [platforms,     setPlatforms]     = useState(userPlatforms.map(p => p.id));
  const [showAdvanced,  setShowAdvanced]  = useState(false);
  const [loading,       setLoading]       = useState(false);
  const [profileLoading,setProfileLoading]= useState(false);
  const [progress,      setProgress]      = useState({});
  const [emailProgress, setEmailProgress] = useState(null);
  const [done,          setDone]          = useState(false);
  const [results,       setResults]       = useState(null);
  const [cacheInfo,     setCacheInfo]     = useState(null);
  const [history,       setHistory]       = useState([]);
  const [historyLoading,setHistoryLoading]= useState(false);
  const [suggestions,   setSuggestions]   = useState(null);
  const [suggestLoading,setSuggestLoading]= useState(false);
  const [showSugg,      setShowSugg]      = useState(false);

  const cacheDebounce = useRef(null);

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
    setProgress(prev => ({ ...prev, [data.platform]: data }));
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
      setSuggestions(data.data);
      setShowSugg(true);
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
      const { data } = await api.post('/search/run', { role: role.trim(), location: location.trim() || 'India', workType, platforms, force });
      setResults(data.data);
      dispatch(setJobs(data.data.jobs || []));
      dispatch(completeSearch()); setDone(true);
      if (data.data.fromCache) toast.success('Loaded from cache — saved 10 credits!');
      else toast.success(`Found ${data.data.totalFound} jobs!`);
      api.get('/search/history?limit=6').then(({ data: h }) => setHistory(h.data || [])).catch(() => {});
      setTimeout(() => navigate(`/results${data.data.searchId ? `?searchId=${data.data.searchId}` : ''}`), 2000);
    } catch (err) {
      dispatch(setSearchError(err.response?.data?.message || 'Search failed'));
      toast.error(err.response?.data?.message || 'Search failed');
    } finally { setLoading(false); }
  };

  const isPro = user?.plan === 'pro' || user?.plan === 'team';
  const doneJobs = results?.jobs?.length || 0;
  const doneEmails = results?.emailsFound || 0;

  return (
    <div className="max-w-2xl mx-auto">
      <motion.div variants={stagger} initial="hidden" animate="show" className="space-y-5">

        {/* ── Hero header ─────────────────────────────────────── */}
        <motion.div variants={fadeUp} className="text-center pt-2 pb-1">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-blue-50 border border-blue-100 rounded-full text-blue-700 text-xs font-semibold mb-4">
            <Sparkles className="w-3.5 h-3.5" />
            AI-Powered Multi-Platform Search
          </div>
          <h1 className="text-3xl font-bold text-gray-900 tracking-tight">
            Find your <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-violet-600">dream job</span>
          </h1>
          <p className="text-gray-500 mt-2 text-sm">
            Search {userPlatforms.length} platforms simultaneously · Auto-find HR emails · ATS-optimised outreach
          </p>
        </motion.div>

        {/* ── Main search card ────────────────────────────────── */}
        <motion.div
          variants={fadeUp}
          className="relative bg-white rounded-3xl border border-gray-100 shadow-elevated overflow-hidden"
          style={{ boxShadow: '0 8px 32px -4px rgba(0,0,0,0.1), 0 2px 8px -2px rgba(0,0,0,0.06)' }}
        >
          {/* Top gradient bar */}
          <div className="h-1 w-full bg-gradient-to-r from-blue-500 via-violet-500 to-indigo-500" />

          <div className="p-6 space-y-5">
            {/* Role input */}
            <div>
              <label className="label">What role are you looking for?</label>
              <div className="relative group">
                <Briefcase className="absolute left-4 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-gray-400 group-focus-within:text-blue-500 transition-colors" style={{width:'18px',height:'18px'}} />
                <input
                  type="text"
                  value={role}
                  onChange={e => setRole(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleSearch(false)}
                  placeholder="e.g. React Developer, Data Scientist, Product Manager"
                  className="input pl-11 text-base py-3 rounded-2xl border-gray-200 focus:border-blue-400"
                />
                {role && (
                  <button onClick={() => setRole('')} className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-full text-gray-300 hover:text-gray-500 transition-colors">
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>

            {/* Location + Work type */}
            <div className="grid grid-cols-5 gap-3">
              <div className="col-span-2">
                <label className="label">Location</label>
                <div className="relative">
                  <MapPin className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    value={location}
                    onChange={e => setLocation(e.target.value)}
                    placeholder="City, Country"
                    className="input pl-10 rounded-xl"
                  />
                </div>
              </div>
              <div className="col-span-3">
                <label className="label">Work Type</label>
                <div className="grid grid-cols-4 gap-1.5">
                  {WORK_TYPES.map(({ value, label, emoji }) => (
                    <button
                      key={value}
                      onClick={() => setWorkType(value)}
                      className={cn(
                        'py-2 px-1 text-xs font-semibold rounded-xl border-2 transition-all duration-150 flex flex-col items-center gap-0.5',
                        workType === value
                          ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                          : 'bg-white text-gray-600 border-gray-200 hover:border-blue-300 hover:bg-blue-50/50'
                      )}
                    >
                      <span>{emoji}</span>
                      <span>{label}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Quick actions row */}
            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={loadFromProfile}
                disabled={profileLoading}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-violet-50 hover:bg-violet-100 text-violet-700 text-xs font-semibold rounded-xl border border-violet-200 transition-colors"
              >
                {profileLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <User className="w-3.5 h-3.5" />}
                Fill from Profile
              </button>
              <button
                onClick={loadResumeSuggestions}
                disabled={suggestLoading}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-semibold rounded-xl border border-indigo-200 transition-colors"
              >
                {suggestLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Wand2 className="w-3.5 h-3.5" />}
                AI Suggestions
              </button>
              <button
                onClick={() => setShowAdvanced(v => !v)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-50 hover:bg-gray-100 text-gray-600 text-xs font-semibold rounded-xl border border-gray-200 transition-colors ml-auto"
              >
                {showAdvanced ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                Platforms ({platforms.length}/{userPlatforms.length})
              </button>
            </div>

            {/* AI Suggestions dropdown */}
            <AnimatePresence>
              {showSugg && suggestions && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="overflow-hidden"
                >
                  <div className="bg-indigo-50 border border-indigo-200 rounded-2xl p-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-semibold text-indigo-700 flex items-center gap-1.5">
                        <Sparkles className="w-3.5 h-3.5" />
                        AI Suggestions based on your resume
                      </p>
                      <button onClick={() => setShowSugg(false)} className="text-indigo-400 hover:text-indigo-600">
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                    {suggestions.detectedStacks?.length > 0 && (
                      <p className="text-xs text-indigo-500">Detected: {suggestions.detectedStacks.join(', ')}</p>
                    )}
                    <div className="space-y-1.5">
                      {suggestions.suggestions.map((s, i) => (
                        <motion.button
                          key={i}
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: i * 0.05 }}
                          onClick={() => applySuggestion(s)}
                          className="w-full flex items-center justify-between gap-2 px-3 py-2.5 bg-white rounded-xl border border-indigo-100 hover:border-indigo-400 hover:bg-indigo-50 text-left transition-all group"
                        >
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-gray-900 truncate">{s.label}</p>
                            <p className="text-xs text-gray-500 truncate">{s.description}</p>
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            {s.priority === 'high' && <span className="badge badge-green text-xs">Best</span>}
                            <ArrowRight className="w-4 h-4 text-indigo-400 group-hover:text-indigo-600 transition-colors" />
                          </div>
                        </motion.button>
                      ))}
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Platform selector */}
            <AnimatePresence>
              {showAdvanced && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="overflow-hidden"
                >
                  <div className="border border-gray-100 rounded-2xl p-4 bg-gray-50/50">
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Job Platforms</p>
                    <div className="grid grid-cols-2 gap-2">
                      {userPlatforms.map((platform, i) => {
                        const isSelected = platforms.includes(platform.id);
                        const locked = platform.proOnly && !isPro;
                        return (
                          <motion.button
                            key={platform.id}
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ delay: i * 0.03 }}
                            onClick={() => !locked && togglePlatform(platform.id)}
                            disabled={locked}
                            className={cn(
                              'flex items-center gap-2.5 p-3 rounded-xl border-2 text-left transition-all duration-150',
                              locked      ? 'opacity-50 cursor-not-allowed bg-gray-100 border-gray-200' :
                              isSelected  ? 'bg-blue-50 border-blue-400 shadow-sm' :
                                            'bg-white border-gray-200 hover:border-blue-300 hover:bg-blue-50/30'
                            )}
                          >
                            <div className={cn(
                              'w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 transition-all',
                              isSelected ? 'bg-blue-600 border-blue-600' : 'border-gray-300'
                            )}>
                              {isSelected && (
                                <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                </svg>
                              )}
                            </div>
                            <div className="min-w-0">
                              <p className={cn('text-sm font-semibold truncate', isSelected ? 'text-blue-800' : 'text-gray-700')}>{platform.name}</p>
                              <p className="text-xs text-gray-400 truncate">{platform.note}</p>
                            </div>
                            {locked && <span className="badge badge-amber text-xs ml-auto">Pro</span>}
                          </motion.button>
                        );
                      })}
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Cache hit banner */}
            <AnimatePresence>
              {cacheInfo && !loading && !done && (
                <motion.div
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  className="flex items-center justify-between gap-3 p-3 bg-emerald-50 border border-emerald-200 rounded-2xl"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <Clock className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-emerald-800">{cacheInfo.jobCount} jobs cached · {cacheInfo.ageDays === 0 ? 'today' : `${cacheInfo.ageDays}d ago`}</p>
                      <p className="text-xs text-emerald-600">Use free or run a fresh search</p>
                    </div>
                  </div>
                  <div className="flex gap-2 flex-shrink-0">
                    <button onClick={() => handleSearch(false)} className="btn btn-sm bg-emerald-600 text-white hover:bg-emerald-700">
                      <Sparkles className="w-3.5 h-3.5" /> Free
                    </button>
                    <button onClick={() => handleSearch(true)} className="btn btn-sm btn-secondary">
                      <RefreshCw className="w-3.5 h-3.5" /> Fresh
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
              whileTap={{ scale: loading ? 1 : 0.99 }}
              className="w-full btn btn-primary btn-lg rounded-2xl text-base py-4 relative overflow-hidden"
              style={{ background: loading ? undefined : 'linear-gradient(135deg, #2563eb 0%, #7c3aed 100%)' }}
            >
              {loading ? (
                <><Loader2 className="w-5 h-5 animate-spin" /> Searching across {platforms.length} platforms...</>
              ) : (
                <><SearchIcon className="w-5 h-5" /> Search Jobs + Find HR Emails</>
              )}
            </motion.button>

            {/* Plan info */}
            {!isPro && (
              <p className="text-xs text-center text-gray-400">
                Free plan · HR emails found for top 2 companies ·{' '}
                <a href="/billing" className="text-blue-600 font-semibold hover:underline">Upgrade to Pro</a> for all
              </p>
            )}
          </div>
        </motion.div>

        {/* ── Live search progress ─────────────────────────────── */}
        <AnimatePresence>
          {loading && (
            <motion.div
              initial={{ opacity: 0, scale: 0.98, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.98 }}
              className="bg-white rounded-3xl border border-gray-100 p-6 space-y-5"
              style={{ boxShadow: '0 8px 32px -4px rgba(0,0,0,0.08)' }}
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-blue-50 flex items-center justify-center">
                  <Zap className="w-5 h-5 text-blue-600 animate-pulse" />
                </div>
                <div>
                  <p className="font-bold text-gray-900">Scanning platforms...</p>
                  <p className="text-xs text-gray-400">This takes 15–30 seconds</p>
                </div>
              </div>

              <div className="space-y-2.5">
                {userPlatforms.filter(p => platforms.includes(p.id)).map((platform, i) => {
                  const p = progress[platform.id];
                  const status = !p ? 'waiting' : p.status === 'done' ? 'done' : p.status === 'error' ? 'error' : 'running';
                  return (
                    <motion.div
                      key={platform.id}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.04 }}
                      className="flex items-center gap-3"
                    >
                      <div className={cn(
                        'w-2.5 h-2.5 rounded-full flex-shrink-0 transition-all',
                        status === 'done'    ? 'bg-emerald-500' :
                        status === 'error'   ? 'bg-red-400' :
                        status === 'running' ? 'bg-blue-500 animate-pulse' : 'bg-gray-200'
                      )} />
                      <span className="text-sm text-gray-700 flex-1 font-medium">{platform.name}</span>
                      <span className={cn(
                        'text-xs font-semibold',
                        status === 'done'  ? 'text-emerald-600' :
                        status === 'error' ? 'text-red-400' : 'text-gray-400'
                      )}>
                        {status === 'done'    ? `✓ ${p.found} jobs` :
                         status === 'error'   ? '✗ Failed' :
                         status === 'running' ? 'Searching...' : 'Waiting'}
                      </span>
                    </motion.div>
                  );
                })}
              </div>

              <div className="pt-3 border-t border-gray-100">
                <div className="flex items-center gap-2 mb-2">
                  <Mail className="w-4 h-4 text-emerald-600" />
                  <p className="text-sm font-semibold text-gray-700">Auto-finding HR emails</p>
                  <span className={cn('badge text-xs', isPro ? 'badge-blue' : 'badge-amber')}>
                    {isPro ? 'All companies' : 'Top 2 only'}
                  </span>
                </div>
                {emailProgress ? (
                  <div className="flex items-center gap-2">
                    {emailProgress.status === 'done'
                      ? <CheckCircle className="w-4 h-4 text-emerald-500" />
                      : <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />
                    }
                    <p className="text-sm text-gray-500">
                      {emailProgress.status === 'started'
                        ? `Searching ${emailProgress.total} companies...`
                        : `Found HR emails for ${emailProgress.found} companies`}
                    </p>
                  </div>
                ) : (
                  <p className="text-sm text-gray-400 flex items-center gap-2">
                    <span className="w-4 h-4 rounded-full bg-gray-200 animate-pulse inline-block" />
                    Waiting for job scan to complete...
                  </p>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Done result ──────────────────────────────────────── */}
        <AnimatePresence>
          {done && results && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="rounded-3xl overflow-hidden"
              style={{ background: results.fromCache ? 'linear-gradient(135deg, #d1fae5, #a7f3d0)' : 'linear-gradient(135deg, #dbeafe, #e0e7ff)', boxShadow: '0 8px 32px -4px rgba(0,0,0,0.1)' }}
            >
              <div className="p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className={cn('w-12 h-12 rounded-2xl flex items-center justify-center', results.fromCache ? 'bg-emerald-500' : 'bg-blue-500')}>
                    {results.fromCache
                      ? <Sparkles className="w-6 h-6 text-white" />
                      : <CheckCircle className="w-6 h-6 text-white" />}
                  </div>
                  <div>
                    <p className="font-bold text-gray-900 text-lg">
                      {results.fromCache ? 'Loaded from cache!' : 'Search complete!'}
                    </p>
                    <p className="text-sm text-gray-600">
                      {results.fromCache ? '10 credits saved 🎉' : `${Math.round((results.durationMs || 0) / 1000)}s total`}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3 mb-4">
                  {[
                    { label: 'Top Matches', value: doneJobs,    color: 'text-blue-700' },
                    { label: 'HR Emails',   value: doneEmails,  color: 'text-emerald-700' },
                    { label: results.fromCache ? 'Credits' : 'Platforms', value: results.fromCache ? 'FREE' : results.platformResults?.length, color: 'text-violet-700' },
                  ].map(({ label, value, color }) => (
                    <div key={label} className="bg-white/70 backdrop-blur-sm rounded-2xl p-3 text-center">
                      <p className={cn('text-2xl font-black', color)}>{value}</p>
                      <p className="text-xs text-gray-500 font-medium">{label}</p>
                    </div>
                  ))}
                </div>

                <motion.p
                  animate={{ opacity: [0.5, 1, 0.5] }}
                  transition={{ duration: 1.5, repeat: Infinity }}
                  className="text-xs text-center text-gray-500 font-medium"
                >
                  Redirecting to results...
                </motion.p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Past searches ───────────────────────────────────── */}
        {!loading && !done && history.length > 0 && (
          <motion.div variants={fadeUp} className="bg-white rounded-3xl border border-gray-100 overflow-hidden" style={{ boxShadow: '0 2px 12px -2px rgba(0,0,0,0.06)' }}>
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <History className="w-4 h-4 text-gray-400" />
                <p className="text-sm font-bold text-gray-800">Recent Searches</p>
              </div>
              <button onClick={() => navigate('/results')} className="text-xs text-blue-600 hover:text-blue-700 font-semibold flex items-center gap-1">
                All results <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {historyLoading ? (
              <div className="p-4 space-y-2">
                {[...Array(3)].map((_, i) => <div key={i} className="skeleton h-10 rounded-xl" />)}
              </div>
            ) : (
              <motion.div variants={stagger} initial="hidden" animate="show" className="divide-y divide-gray-100">
                {history.map(s => {
                  const ageDays = Math.floor((Date.now() - new Date(s.createdAt)) / 86400000);
                  return (
                    <motion.div
                      key={s._id}
                      variants={itemFade}
                      onClick={() => navigate(`/results?searchId=${s._id}`)}
                      className="flex items-center gap-3 px-5 py-3 hover:bg-slate-50 cursor-pointer transition-colors group"
                    >
                      <div className="w-8 h-8 rounded-xl bg-blue-50 flex items-center justify-center flex-shrink-0">
                        <SearchIcon className="w-4 h-4 text-blue-500" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-gray-900 truncate">{s.query?.role}</p>
                        <p className="text-xs text-gray-400">
                          {s.query?.location} · {ageDays === 0 ? 'Today' : ageDays === 1 ? 'Yesterday' : `${ageDays}d ago`}
                          {s.totalFound > 0 && <span className="ml-2 text-emerald-600 font-medium">{s.totalFound} jobs</span>}
                        </p>
                      </div>
                      <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-blue-500 flex-shrink-0 transition-colors" />
                    </motion.div>
                  );
                })}
              </motion.div>
            )}
          </motion.div>
        )}

        {/* ── How it works ────────────────────────────────────── */}
        {!loading && !done && (
          <motion.div variants={fadeUp} className="grid grid-cols-2 gap-3 pb-4">
            {[
              { icon: SearchIcon, title: `${userPlatforms.length}+ Platforms`, desc: 'Searched simultaneously', color: 'blue'   },
              { icon: Target,     title: 'AI Match Score',  desc: 'Jobs ranked by fit',      color: 'violet' },
              { icon: Mail,       title: 'HR Emails',       desc: 'Auto-found contacts',     color: 'emerald'},
              { icon: Zap,        title: 'Smart Cache',     desc: 'Free for 30 days',        color: 'amber'  },
            ].map(({ icon: Icon, title, desc, color }) => (
              <div key={title} className={cn(
                'flex items-center gap-3 p-3.5 rounded-2xl border',
                color === 'blue'   ? 'bg-blue-50/50 border-blue-100' :
                color === 'violet' ? 'bg-violet-50/50 border-violet-100' :
                color === 'emerald'? 'bg-emerald-50/50 border-emerald-100' :
                                     'bg-amber-50/50 border-amber-100'
              )}>
                <div className={cn(
                  'w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0',
                  color === 'blue'   ? 'bg-blue-100' :
                  color === 'violet' ? 'bg-violet-100' :
                  color === 'emerald'? 'bg-emerald-100' : 'bg-amber-100'
                )}>
                  <Icon className={cn('w-4 h-4',
                    color === 'blue'   ? 'text-blue-600' :
                    color === 'violet' ? 'text-violet-600' :
                    color === 'emerald'? 'text-emerald-600' : 'text-amber-600'
                  )} />
                </div>
                <div>
                  <p className="text-sm font-bold text-gray-800">{title}</p>
                  <p className="text-xs text-gray-500">{desc}</p>
                </div>
              </div>
            ))}
          </motion.div>
        )}

      </motion.div>
    </div>
  );
}
