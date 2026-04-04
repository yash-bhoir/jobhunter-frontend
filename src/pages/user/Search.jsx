import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search as SearchIcon, MapPin, Briefcase, User,
  ChevronDown, ChevronUp, Loader2, Zap, Mail, CheckCircle,
  Clock, RefreshCw, Sparkles, History, ChevronRight, FileText, Wand2
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

export default function Search() {
  const { user }  = useAuth();
  const toast     = useToast();
  const navigate  = useNavigate();
  const dispatch  = useDispatch();

  const [role,           setRole]           = useState(user?.profile?.targetRole || '');
  const [location,       setLocation]       = useState(user?.profile?.preferredLocations?.[0] || 'India');
  const [workType,       setWorkType]       = useState(user?.profile?.workType || 'any');
  // adminOnly platforms are controlled server-side; exclude from user-facing selector
  const userPlatforms = PLATFORMS.filter(p => !p.adminOnly);
  const [platforms,      setPlatforms]      = useState(userPlatforms.map(p => p.id));
  const [showAdvanced,   setShowAdvanced]   = useState(false);
  const [loading,        setLoading]        = useState(false);
  const [profileLoading, setProfileLoading] = useState(false);
  const [progress,       setProgress]       = useState({});
  const [emailProgress,  setEmailProgress]  = useState(null);
  const [done,           setDone]           = useState(false);
  const [results,        setResults]        = useState(null);
  const [cacheInfo,      setCacheInfo]      = useState(null);
  const [history,          setHistory]          = useState([]);
  const [historyLoading,   setHistoryLoading]   = useState(false);
  const [suggestions,      setSuggestions]      = useState(null);
  const [suggestLoading,   setSuggestLoading]   = useState(false);
  const [showSuggestions,  setShowSuggestions]  = useState(false);

  const cacheDebounce = useRef(null);

  // ── Check cache whenever search params change ──────────────────
  useEffect(() => {
    if (!role.trim()) { setCacheInfo(null); return; }

    clearTimeout(cacheDebounce.current);
    cacheDebounce.current = setTimeout(async () => {
      try {
        const params = new URLSearchParams({
          role: role.trim(),
          ...(location && { location }),
          ...(workType && { workType }),
        });
        const { data } = await api.get(`/search/check-cache?${params}`);
        setCacheInfo(data.data?.hasCache ? data.data : null);
      } catch {
        setCacheInfo(null);
      }
    }, 800);

    return () => clearTimeout(cacheDebounce.current);
  }, [role, location, workType]);

  // ── Load search history on mount ─────────────────────────────
  useEffect(() => {
    setHistoryLoading(true);
    api.get('/search/history?limit=8')
      .then(({ data }) => setHistory(data.data || []))
      .catch(() => {})
      .finally(() => setHistoryLoading(false));
  }, []);

  // ── Real-time progress via socket ─────────────────────────────
  useSocket('search:progress', (data) => {
    setProgress(prev => ({ ...prev, [data.platform]: data }));
    dispatch(updateProgress(data));
  });

  useSocket('search:email_finding', (data) => {
    setEmailProgress(data);
    if (data.status === 'done' && data.found > 0) {
      toast.success(`Found ${data.found} HR email contacts!`);
    }
  });

  useSocket('search:complete', () => {
    dispatch(completeSearch());
    setDone(true);
  });

  const togglePlatform = (id) => {
    setPlatforms(prev =>
      prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]
    );
  };

  const loadResumeSuggestions = async () => {
    setSuggestLoading(true);
    try {
      const { data } = await api.get('/search/resume-suggest');
      setSuggestions(data.data);
      setShowSuggestions(true);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Upload your resume first to get smart suggestions');
    } finally {
      setSuggestLoading(false);
    }
  };

  const applySuggestion = (s) => {
    setRole(s.role);
    setLocation(s.location || '');
    setWorkType(s.workType || 'any');
    setShowSuggestions(false);
    toast.success(`Applied: ${s.label}`);
  };

  const loadFromProfile = async () => {
    setProfileLoading(true);
    try {
      const { data } = await api.get('/search/profile-search');
      setRole(data.data.role);
      setLocation(data.data.location);
      setWorkType(data.data.workType || 'any');
      toast.success('Search filled from your profile!');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Complete your profile first');
    } finally {
      setProfileLoading(false);
    }
  };

  // ── Run search (force=false uses cache, force=true skips cache) ─
  const handleSearch = async (force = false) => {
    if (!role.trim()) {
      toast.error('Please enter a job role');
      return;
    }
    if (platforms.length === 0) {
      toast.error('Select at least one platform');
      return;
    }

    setLoading(true);
    setDone(false);
    setProgress({});
    setEmailProgress(null);
    setResults(null);
    setCacheInfo(null);
    dispatch(startSearch(null));

    try {
      const { data } = await api.post('/search/run', {
        role:     role.trim(),
        location: location.trim() || 'India',
        workType,
        platforms,
        force,
      });

      setResults(data.data);
      dispatch(setJobs(data.data.jobs || []));
      dispatch(completeSearch());
      setDone(true);

      if (data.data.fromCache) {
        toast.success(`Loaded from cache — saved 10 credits!`);
      } else {
        toast.success(`Found ${data.data.totalFound} jobs!`);
      }

      // Refresh history to include the new/cached search
      api.get('/search/history?limit=8')
        .then(({ data: h }) => setHistory(h.data || []))
        .catch(() => {});

      setTimeout(() => navigate(`/results${data.data.searchId ? `?searchId=${data.data.searchId}` : ''}`), 2000);

    } catch (err) {
      dispatch(setSearchError(err.response?.data?.message || 'Search failed'));
      toast.error(err.response?.data?.message || 'Search failed');
    } finally {
      setLoading(false);
    }
  };

  const isPro = user?.plan === 'pro' || user?.plan === 'team';

  return (
    <div className="max-w-3xl mx-auto space-y-6">

      {/* ── Header ─────────────────────────────────────────────── */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Job Search</h1>
        <p className="text-gray-500 mt-1 text-sm">
          Search across {PLATFORMS.length} platforms simultaneously
          <span className="ml-2 badge badge-blue">10 credits per search</span>
        </p>
      </div>

      {/* ── Smart search from profile ───────────────────────────── */}
      <div className="card card-body bg-gradient-to-r from-purple-50 to-blue-50 border-purple-200 py-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="font-semibold text-purple-800 text-sm">🎯 Smart Search from Profile</p>
            <p className="text-xs text-purple-600 mt-0.5">
              Auto-fill from your target role, preferred location, skills and work type
            </p>
          </div>
          <button
            onClick={loadFromProfile}
            disabled={profileLoading}
            className="btn btn-sm bg-purple-600 text-white hover:bg-purple-700 flex-shrink-0"
          >
            {profileLoading
              ? <Loader2 className="w-4 h-4 animate-spin" />
              : <User className="w-4 h-4" />
            }
            Auto-Fill
          </button>
        </div>
      </div>

      {/* ── Resume-based smart suggestions ─────────────────────── */}
      <div className="card card-body bg-gradient-to-r from-indigo-50 to-purple-50 border-indigo-200 py-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="font-semibold text-indigo-800 text-sm flex items-center gap-1.5">
              <FileText className="w-4 h-4" /> Resume-Based Search Suggestions
            </p>
            <p className="text-xs text-indigo-600 mt-0.5">
              AI reads your resume + skills and suggests the best matching job queries
            </p>
          </div>
          <button
            onClick={loadResumeSuggestions}
            disabled={suggestLoading}
            className="btn btn-sm bg-indigo-600 text-white hover:bg-indigo-700 flex-shrink-0"
          >
            {suggestLoading
              ? <Loader2 className="w-4 h-4 animate-spin" />
              : <Wand2 className="w-4 h-4" />
            }
            Suggest
          </button>
        </div>

        {showSuggestions && suggestions && (
          <div className="mt-3 space-y-2">
            {suggestions.detectedStacks?.length > 0 && (
              <p className="text-xs text-indigo-500">
                Detected stacks: {suggestions.detectedStacks.join(', ')}
              </p>
            )}
            <div className="grid grid-cols-1 gap-1.5">
              {suggestions.suggestions.map((s, i) => (
                <button
                  key={i}
                  onClick={() => applySuggestion(s)}
                  className="flex items-center justify-between gap-2 px-3 py-2 bg-white rounded-lg border border-indigo-200 hover:border-indigo-400 hover:bg-indigo-50 text-left transition-colors group"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{s.label}</p>
                    <p className="text-xs text-gray-500 truncate">{s.description} · {s.location || 'Remote'}</p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {s.priority === 'high' && <span className="badge badge-green text-xs">Best match</span>}
                    <ChevronRight className="w-4 h-4 text-indigo-400 group-hover:text-indigo-600" />
                  </div>
                </button>
              ))}
            </div>
            <button
              onClick={() => setShowSuggestions(false)}
              className="text-xs text-indigo-400 hover:text-indigo-600 mt-1"
            >
              Dismiss
            </button>
          </div>
        )}
      </div>

      {/* ── Cache hit banner ────────────────────────────────────── */}
      {cacheInfo && !loading && !done && (
        <div className="card card-body bg-green-50 border-green-300 py-3">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-2">
              <Clock className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-green-800">
                  Recent results available —{' '}
                  {cacheInfo.daysLeft > 0
                    ? `${cacheInfo.daysLeft} day${cacheInfo.daysLeft !== 1 ? 's' : ''} left`
                    : 'expiring soon'}
                </p>
                <p className="text-xs text-green-600 mt-0.5">
                  {cacheInfo.jobCount} jobs from a search {cacheInfo.ageDays === 0 ? 'today' : `${cacheInfo.ageDays} day${cacheInfo.ageDays !== 1 ? 's' : ''} ago`}.
                  Use for free or run fresh (costs 10 credits).
                </p>
              </div>
            </div>
            <div className="flex gap-2 flex-shrink-0">
              <button
                onClick={() => handleSearch(false)}
                className="btn btn-sm bg-green-600 text-white hover:bg-green-700"
              >
                <Sparkles className="w-3.5 h-3.5" />
                Use Free
              </button>
              <button
                onClick={() => handleSearch(true)}
                className="btn btn-sm btn-secondary"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Fresh
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Plan info banners ───────────────────────────────────── */}
      {!isPro && (
        <div className="card card-body bg-amber-50 border-amber-200 py-3">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm text-amber-700">
              <strong>Free plan:</strong> HR emails auto-found for top 2 companies.
              Upgrade to Pro for all companies + bulk outreach.
            </p>
            <a href="/billing" className="btn btn-sm bg-amber-500 text-white hover:bg-amber-600 flex-shrink-0">
              Upgrade
            </a>
          </div>
        </div>
      )}

      {isPro && (
        <div className="card card-body bg-blue-50 border-blue-200 py-3">
          <p className="text-sm text-blue-700">
            <strong>Pro plan:</strong> HR emails auto-found for ALL companies.
            Send bulk AI outreach emails after search.
          </p>
        </div>
      )}

      {/* ── Search form ─────────────────────────────────────────── */}
      <div className="card card-body space-y-4">

        <div>
          <label className="label">Job Role *</label>
          <div className="relative">
            <Briefcase className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={role}
              onChange={e => setRole(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSearch(false)}
              placeholder="e.g. React Developer, Data Scientist, Product Manager"
              className="input pl-9"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label">Location</label>
            <div className="relative">
              <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={location}
                onChange={e => setLocation(e.target.value)}
                placeholder="e.g. Mumbai, Bangalore"
                className="input pl-9"
              />
            </div>
          </div>
          <div>
            <label className="label">Work Type</label>
            <div className="grid grid-cols-4 gap-1">
              {WORK_TYPES.map(({ value, label }) => (
                <button
                  key={value}
                  onClick={() => setWorkType(value)}
                  className={cn(
                    'py-2 px-1 text-xs font-medium rounded-lg border transition-colors',
                    workType === value
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'bg-white text-gray-600 border-gray-300 hover:border-blue-400'
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div>
          <button
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"
          >
            {showAdvanced ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            Advanced options — select platforms ({platforms.length} selected)
          </button>

          {showAdvanced && (
            <div className="mt-3 grid grid-cols-2 gap-2">
              {userPlatforms.map(platform => {
                const isSelected = platforms.includes(platform.id);
                const locked     = platform.proOnly && !isPro;
                return (
                  <button
                    key={platform.id}
                    onClick={() => !locked && togglePlatform(platform.id)}
                    disabled={locked}
                    className={cn(
                      'flex items-center gap-2 p-2.5 rounded-lg border text-left transition-colors text-sm',
                      locked      ? 'opacity-50 cursor-not-allowed bg-gray-50 border-gray-200' :
                      isSelected  ? 'bg-blue-50 border-blue-300 text-blue-800' :
                                    'bg-white border-gray-200 hover:border-gray-300 text-gray-700'
                    )}
                  >
                    <div className={cn(
                      'w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0',
                      isSelected ? 'bg-blue-600 border-blue-600' : 'border-gray-300'
                    )}>
                      {isSelected && (
                        <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="font-medium truncate">{platform.name}</div>
                      <div className="text-xs text-gray-500 truncate">{platform.note}</div>
                    </div>
                    {locked && <span className="badge badge-amber text-xs ml-auto">Pro</span>}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <button
          onClick={() => handleSearch(false)}
          disabled={loading}
          className="btn btn-primary w-full btn-lg"
        >
          {loading
            ? <><Loader2 className="w-5 h-5 animate-spin" /> Searching...</>
            : <><SearchIcon className="w-5 h-5" /> Search Jobs + Find HR Emails</>
          }
        </button>
      </div>

      {/* ── Search progress ─────────────────────────────────────── */}
      {loading && (
        <div className="card card-body space-y-4">
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Zap className="w-5 h-5 text-blue-600 animate-pulse" />
              <h3 className="font-semibold text-gray-900">Searching platforms...</h3>
            </div>
            <div className="space-y-2">
              {userPlatforms.filter(p => platforms.includes(p.id)).map(platform => {
                const p = progress[platform.id];
                return (
                  <div key={platform.id} className="flex items-center gap-3">
                    <div className={cn(
                      'w-2 h-2 rounded-full flex-shrink-0',
                      !p                   ? 'bg-gray-300 animate-pulse' :
                      p.status === 'done'  ? 'bg-green-500' :
                      p.status === 'error' ? 'bg-red-500'   :
                                             'bg-blue-500 animate-pulse'
                    )} />
                    <span className="text-sm text-gray-700 flex-1">{platform.name}</span>
                    <span className="text-xs text-gray-500">
                      {!p                   ? 'Waiting...'       :
                       p.status === 'done'  ? `${p.found} jobs`  :
                       p.status === 'error' ? 'Failed'           : 'Searching...'}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="border-t border-gray-100 pt-3">
            <div className="flex items-center gap-2 mb-2">
              <Mail className="w-4 h-4 text-green-600" />
              <h4 className="text-sm font-semibold text-gray-700">Auto-finding HR emails...</h4>
              {isPro
                ? <span className="badge badge-blue text-xs">All companies (Pro)</span>
                : <span className="badge badge-amber text-xs">Top 2 companies (Free)</span>
              }
            </div>
            {emailProgress ? (
              <div className="flex items-center gap-2">
                {emailProgress.status === 'done'
                  ? <CheckCircle className="w-4 h-4 text-green-500" />
                  : <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />
                }
                <p className="text-sm text-gray-600">
                  {emailProgress.status === 'started'
                    ? `Searching emails for ${emailProgress.total} companies...`
                    : `Found HR emails for ${emailProgress.found} companies`
                  }
                </p>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded-full bg-gray-200 animate-pulse" />
                <p className="text-sm text-gray-400">Waiting for search to complete...</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Done ────────────────────────────────────────────────── */}
      {done && results && (
        <div className={cn(
          'card card-body space-y-3',
          results.fromCache ? 'bg-green-50 border-green-200' : 'bg-blue-50 border-blue-200'
        )}>
          <div className="flex items-center gap-3">
            <div className={cn(
              'w-10 h-10 rounded-full flex items-center justify-center',
              results.fromCache ? 'bg-green-100' : 'bg-blue-100'
            )}>
              {results.fromCache
                ? <Sparkles className="w-5 h-5 text-green-600" />
                : <CheckCircle className="w-5 h-5 text-blue-600" />
              }
            </div>
            <div>
              <p className={cn('font-semibold', results.fromCache ? 'text-green-800' : 'text-blue-800')}>
                {results.fromCache ? 'Loaded from cache — 10 credits saved!' : 'Search complete!'}
              </p>
              <p className={cn('text-sm', results.fromCache ? 'text-green-600' : 'text-blue-600')}>
                {results.fromCache
                  ? `${results.jobs?.length} jobs from your recent search`
                  : <>Found <strong>{results.totalFound}</strong> jobs
                    {results.emailsFound > 0 && <> + <strong>{results.emailsFound}</strong> HR emails</>}
                  </>
                }
              </p>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <div className="bg-white rounded-lg p-2 text-center">
              <div className="text-lg font-bold text-gray-900">{results.jobs?.length || 0}</div>
              <div className="text-xs text-gray-500">Top Matches</div>
            </div>
            <div className="bg-white rounded-lg p-2 text-center">
              <div className="text-lg font-bold text-green-600">{results.emailsFound || 0}</div>
              <div className="text-xs text-gray-500">HR Emails</div>
            </div>
            <div className="bg-white rounded-lg p-2 text-center">
              {results.fromCache
                ? <><div className="text-lg font-bold text-green-600">FREE</div><div className="text-xs text-gray-500">Credits Used</div></>
                : <><div className="text-lg font-bold text-blue-600">{Math.round((results.durationMs || 0) / 1000)}s</div><div className="text-xs text-gray-500">Time Taken</div></>
              }
            </div>
          </div>

          <p className="text-xs text-center animate-pulse text-gray-500">
            Redirecting to results...
          </p>
        </div>
      )}

      {/* ── Past searches ───────────────────────────────────────── */}
      {!loading && !done && (history.length > 0 || historyLoading) && (
        <div className="card card-body space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <History className="w-4 h-4 text-gray-500" />
              <h3 className="text-sm font-semibold text-gray-800">Past Searches</h3>
            </div>
            <button
              onClick={() => navigate('/results')}
              className="text-xs text-blue-600 hover:text-blue-700 flex items-center gap-1"
            >
              View all results <ChevronRight className="w-3 h-3" />
            </button>
          </div>

          {historyLoading ? (
            <div className="space-y-2">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="skeleton h-10 rounded-lg" />
              ))}
            </div>
          ) : (
            <div className="space-y-1.5">
              {history.map(s => {
                const ageDays = Math.floor((Date.now() - new Date(s.createdAt).getTime()) / 86400000);
                return (
                  <div
                    key={s._id}
                    onClick={() => navigate(`/results?searchId=${s._id}`)}
                    className="flex items-center justify-between gap-3 px-3 py-2.5 rounded-lg border border-gray-200 hover:border-blue-300 hover:bg-blue-50/40 cursor-pointer transition-colors group"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <SearchIcon className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                        <span className="text-sm font-medium text-gray-900 truncate">
                          {s.query?.role}
                        </span>
                        {s.query?.location && (
                          <span className="text-xs text-gray-500 truncate hidden sm:block">
                            · {s.query.location}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 mt-0.5 ml-5.5">
                        <span className="text-xs text-gray-500">
                          {ageDays === 0 ? 'Today' : ageDays === 1 ? 'Yesterday' : `${ageDays} days ago`}
                        </span>
                        {s.totalFound > 0 && (
                          <span className="text-xs text-green-600 font-medium">
                            {s.totalFound} jobs
                          </span>
                        )}
                        {s.status === 'running' && (
                          <span className="badge badge-amber text-xs">running</span>
                        )}
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-blue-500 flex-shrink-0 transition-colors" />
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── Tips ────────────────────────────────────────────────── */}
      {!loading && !done && !cacheInfo && (
        <div className="card card-body bg-blue-50 border-blue-100">
          <h3 className="text-sm font-semibold text-blue-800 mb-2">💡 How it works</h3>
          <ul className="text-sm text-blue-700 space-y-1.5">
            <li className="flex items-start gap-2">
              <span className="text-blue-400 flex-shrink-0">1.</span>
              Search runs across {PLATFORMS.filter(p => !p.adminOnly).length}+ job platforms simultaneously
            </li>
            <li className="flex items-start gap-2">
              <span className="text-blue-400 flex-shrink-0">2.</span>
              Jobs are scored by skill match, role match and work type from your profile
            </li>
            <li className="flex items-start gap-2">
              <span className="text-blue-400 flex-shrink-0">3.</span>
              HR emails auto-found for{' '}
              <strong>{isPro ? 'all companies' : 'top 2 companies'}</strong>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-blue-400 flex-shrink-0">4.</span>
              Recent searches are cached for 30 days — no credits charged for repeat searches
            </li>
          </ul>
        </div>
      )}
    </div>
  );
}
