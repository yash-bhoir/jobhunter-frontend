import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Search, MapPin, Loader2, Clock, LocateFixed, Navigation, X, History, Sparkles,
} from 'lucide-react';
import MapView            from '@components/map/MapView';
import JobListPanel       from '@components/map/JobListPanel';
import RadiusControl      from '@components/map/RadiusControl';
import GeoJobDetailSheet  from '@components/map/GeoJobDetailSheet';
import { api }            from '@utils/axios';
import { useAuth }        from '@hooks/useAuth';

const DEFAULT_CENTER    = { lat: 19.0760, lng: 72.8777 };
const DEFAULT_LOCATION  = 'Mumbai, India';
const DEFAULT_RADIUS_KM = 10;
/** Quick radius buttons — keep in sync with slider min/step in RadiusControl. */
const RADIUS_PRESETS_KM = [5, 10, 25, 50, 100];

const EARTH_KM = 6371;
function haversineKm(lat1, lng1, lat2, lng2) {
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_KM * Math.asin(Math.min(1, Math.sqrt(a)));
}

function jobMapKey(job) {
  if (job.externalId) return `e:${job.externalId}`;
  if (job._id != null) return `i:${String(job._id)}`;
  return `h:${(job.title || '')}|${(job.company || '')}|${(job.applyUrl || '').slice(0, 40)}`;
}

function jobWithinKmOf(job, centerLat, centerLng, km) {
  const c = job.location?.coordinates;
  if (!Array.isArray(c) || c.length < 2) return false;
  const [jlng, jlat] = c;
  if (!Number.isFinite(jlat) || !Number.isFinite(jlng)) return false;
  return haversineKm(centerLat, centerLng, jlat, jlng) <= km * 1.06 + 0.5;
}

/** Same place + title → widening radius keeps all previous pins still inside the new ring, then adds new API rows. */
function searchFingerprint(lat, lng, title) {
  return `${Number(lat).toFixed(5)},${Number(lng).toFixed(5)},${String(title || '').trim().toLowerCase()}`;
}

function mergeWidenedJobs(prevJobs, incomingJobs, centerLat, centerLng, newRadiusKm) {
  const kept = prevJobs.filter((j) => jobWithinKmOf(j, centerLat, centerLng, newRadiusKm));
  const byKey = new Map();
  for (const j of kept) byKey.set(jobMapKey(j), j);
  for (const j of incomingJobs) byKey.set(jobMapKey(j), j);
  return [...byKey.values()].sort((a, b) => (b.matchScore ?? 0) - (a.matchScore ?? 0));
}

// ── localStorage map-search history ─────────────────────────────
const HISTORY_KEY = 'mapSearchHistory';
function getHistory()      { try { return JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]'); } catch { return []; } }
function saveToHistory(e)  {
  const h = getHistory();
  localStorage.setItem(HISTORY_KEY, JSON.stringify(
    [{ ...e, savedAt: Date.now() }, ...h.filter(x => x.location !== e.location || x.title !== e.title)].slice(0, 10)
  ));
}
function clearHistory()    { localStorage.removeItem(HISTORY_KEY); }
function fAgo(ts) {
  if (!ts) return '';
  const diff = Date.now() - ts;
  const m = Math.floor(diff / 60000);
  if (m < 1)  return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

/** Nominatim requires a descriptive User-Agent (https://operations.osmfoundation.org/policies/nominatim/). */
const NOMINATIM_HEADERS = {
  'Accept-Language': 'en',
  'User-Agent':      'JobHunter/1.0 (map location; https://github.com/jobhunter)',
};

export default function MapSearch() {
  const { user, loading: authLoading } = useAuth();

  const [center,         setCenter]         = useState(DEFAULT_CENTER);
  const [locationName,   setLocationName]   = useState(DEFAULT_LOCATION);
  const [radius,         setRadius]         = useState(DEFAULT_RADIUS_KM);
  const [titleQuery,     setTitleQuery]     = useState('');
  const [jobs,           setJobs]           = useState([]);
  const [loading,        setLoading]        = useState(false);
  const [error,          setError]          = useState(null);
  const [selectedJobId,  setSelectedJobId]  = useState(null);
  const [detailJob,      setDetailJob]      = useState(null);
  const [panelOpen,      setPanelOpen]      = useState(true);
  const [hasSearched,    setHasSearched]    = useState(false);
  const [savedIds,       setSavedIds]       = useState(new Set());
  const [savedJobDocIds, setSavedJobDocIds] = useState({});
  const [enrichLoading,  setEnrichLoading]  = useState(false);
  const [lastMeta,        setLastMeta]       = useState(null);

  // History
  const [history,       setHistory]       = useState(() => getHistory());
  const [showHistory,   setShowHistory]   = useState(false);

  // Location suggestions
  const [suggestions,     setSuggestions]     = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [sugLoading,      setSugLoading]      = useState(false);
  const [locatingGps,     setLocatingGps]     = useState(false);

  const locationInputRef = useRef(null);
  const sugDebounce        = useRef(null);
  const sugAbortRef        = useRef(null);
  /** After picking a row, skip one Nominatim run (otherwise the list reopens and feels like a missed click). */
  const skipSugEffectRef   = useRef(false);
  /** Last successful widen session: same centre + title → larger radius unions with prior list. */
  const widenSessionRef    = useRef(null);
  /** Once true, we stop auto-filling the title from profile (user cleared or edited the field). */
  const mapTitleTouchedRef = useRef(false);

  const resultsRadiusKm = lastMeta?.radiusKm;
  const radiusStale =
    hasSearched
    && resultsRadiusKm != null
    && Math.abs(Number(resultsRadiusKm) - Number(radius)) > 0.01;

  // ── Pre-fill job title from profile (target role → current role), until user edits ──
  useEffect(() => {
    if (authLoading || mapTitleTouchedRef.current) return;
    const seed = (user?.profile?.targetRole || user?.profile?.currentRole || '').trim();
    if (!seed) return;
    setTitleQuery((prev) => (prev.trim() ? prev : seed));
  }, [authLoading, user?.profile?.targetRole, user?.profile?.currentRole]);

  // ── Load saved GeoJob IDs on mount ────────────────────────────
  useEffect(() => {
    api.get('/geo-jobs/saved-ids')
      .then(({ data }) => {
        const rawIds = data.data?.ids || [];
        setSavedIds(new Set(rawIds.map(String)));
        const m = data.data?.docIdMap || {};
        setSavedJobDocIds(
          Object.fromEntries(Object.entries(m).map(([k, v]) => [String(k), String(v)]))
        );
      })
      .catch(() => {});
  }, []);

  const handleSaveToggle = useCallback((jobId, isSaved) => {
    const id = String(jobId);
    setSavedIds(prev => {
      const next = new Set(prev);
      isSaved ? next.add(id) : next.delete(id);
      return next;
    });
    if (isSaved) {
      api.get('/geo-jobs/saved-ids')
        .then(({ data }) => {
          const m = data.data?.docIdMap || {};
          setSavedJobDocIds(
            Object.fromEntries(Object.entries(m).map(([k, v]) => [String(k), String(v)]))
          );
        })
        .catch(() => {});
    } else {
      setSavedJobDocIds(prev => { const n = { ...prev }; delete n[id]; return n; });
    }
  }, []);

  // ── Geolocation on mount (centre only, no auto-search) ───────
  useEffect(() => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      async ({ coords }) => {
        setCenter({ lat: coords.latitude, lng: coords.longitude });
        try {
          const res  = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${coords.latitude}&lon=${coords.longitude}`,
            { headers: NOMINATIM_HEADERS }
          );
          const data = await res.json();
          const addr = data.address || {};
          const name = addr.city || addr.town || addr.village || addr.county || 'My Location';
          skipSugEffectRef.current = true;
          setLocationName(name);
        } catch {
          skipSugEffectRef.current = true;
          setLocationName('My Location');
        }
      },
      () => {},
      { timeout: 6000, maximumAge: 60000 }
    );
  }, []);

  // ── Location suggestions via Nominatim (debounced + abort stale requests) ──
  useEffect(() => {
    if (skipSugEffectRef.current) {
      skipSugEffectRef.current = false;
      clearTimeout(sugDebounce.current);
      return;
    }
    const q = locationName.trim();
    if (q.length < 2 || q === 'My Location' || q === 'Custom Location') {
      sugAbortRef.current?.abort();
      setSuggestions([]);
      setShowSuggestions(false);
      setSugLoading(false);
      return;
    }
    clearTimeout(sugDebounce.current);
    sugDebounce.current = setTimeout(async () => {
      sugAbortRef.current?.abort();
      const ac = new AbortController();
      sugAbortRef.current = ac;
      setSugLoading(true);
      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(q)}&limit=8&addressdetails=1`,
          { headers: NOMINATIM_HEADERS, signal: ac.signal }
        );
        const data = await res.json();
        if (ac.signal.aborted) return;
        setSuggestions(data.map(d => {
          const addr = d.address || {};
          const city = addr.city || addr.town || addr.village || addr.county || d.name || '';
          const state   = addr.state || '';
          const country = addr.country || '';
          const short   = [city, state, country].filter(Boolean).join(', ');
          return { short, full: d.display_name, lat: parseFloat(d.lat), lng: parseFloat(d.lon) };
        }));
        setShowSuggestions(true);
        setShowHistory(false);
      } catch (e) {
        if (e?.name === 'AbortError') return;
        setSuggestions([]);
      } finally {
        if (!ac.signal.aborted) setSugLoading(false);
      }
    }, 180);
    return () => {
      clearTimeout(sugDebounce.current);
      sugAbortRef.current?.abort();
    };
  }, [locationName]);

  // ── "Use my current location" button ─────────────────────────
  const handleGpsClick = useCallback(() => {
    if (!navigator.geolocation) return;
    setLocatingGps(true);
    navigator.geolocation.getCurrentPosition(
      async ({ coords }) => {
        const newCenter = { lat: coords.latitude, lng: coords.longitude };
        setCenter(newCenter);
        setSuggestions([]);
        setShowSuggestions(false);
        try {
          const res  = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${coords.latitude}&lon=${coords.longitude}`,
            { headers: NOMINATIM_HEADERS }
          );
          const data = await res.json();
          const addr = data.address || {};
          const name = addr.city || addr.town || addr.village || addr.county || 'My Location';
          skipSugEffectRef.current = true;
          setLocationName(name);
        } catch {
          skipSugEffectRef.current = true;
          setLocationName('My Location');
        }
        setLocatingGps(false);
      },
      () => setLocatingGps(false),
      { timeout: 8000 }
    );
  }, []);

  // ── Pick a suggestion ─────────────────────────────────────────
  const pickSuggestion = useCallback((sug) => {
    sugAbortRef.current?.abort();
    clearTimeout(sugDebounce.current);
    skipSugEffectRef.current = true;
    setLocationName(sug.short);
    setCenter({ lat: sug.lat, lng: sug.lng });
    setSuggestions([]);
    setShowSuggestions(false);
    setShowHistory(false);
    setSugLoading(false);
    locationInputRef.current?.focus();
  }, []);

  // ── Fetch nearby jobs ─────────────────────────────────────────
  const fetchJobs = useCallback(async (overrideCenter, overrideRadius) => {
    const lat = (overrideCenter ?? center).lat;
    const lng = (overrideCenter ?? center).lng;
    const km  = overrideRadius ?? radius;
    setLoading(true); setError(null);
    try {
      const { data } = await api.get('/geo-jobs/nearby', {
        params: {
          lat,
          lng,
          radius: km,
          ...(titleQuery.trim() && { title: titleQuery.trim() }),
        },
        // Reverse geocode + optional live API cache can exceed default 30s on slow networks.
        timeout: 90000,
      });
      const incoming = data.data?.jobs || [];
      const meta = data.data?.meta || null;
      const fp = searchFingerprint(lat, lng, titleQuery);
      const prev = widenSessionRef.current;

      let display = incoming;
      if (
        prev
        && prev.fingerprint === fp
        && km > prev.radiusKm + 0.01
        && Array.isArray(prev.jobs)
        && prev.jobs.length > 0
      ) {
        display = mergeWidenedJobs(prev.jobs, incoming, lat, lng, km);
      }

      widenSessionRef.current = { fingerprint: fp, radiusKm: km, jobs: display };

      setJobs(display);
      setLastMeta(
        meta
          ? {
            ...meta,
            total: display.length,
            ...(display.length > incoming.length
              ? { widenKeptFromSmallerRadius: display.length - incoming.length }
              : {}),
          }
          : null
      );
      setHasSearched(true);
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Failed to load jobs.');
    } finally {
      setLoading(false);
    }
  }, [center, radius, titleQuery]);

  const handleEnrichStored = useCallback(async () => {
    setEnrichLoading(true);
    try {
      await api.post('/geo-jobs/enrich-stored', {
        limit: 60,
        centerLat: center.lat,
        centerLng: center.lng,
      });
      await fetchJobs();
    } catch {
      setError('Could not run geo enrichment. Try again later.');
    } finally {
      setEnrichLoading(false);
    }
  }, [center.lat, center.lng, fetchJobs]);

  const applyQuickRadius = useCallback((km) => {
    setRadius(km);
  }, []);

  // Radius change only updates state — no auto-search

  // ── Search (geocode → fetch) ──────────────────────────────────
  const geocodeAndSearch = useCallback(async () => {
    setSuggestions([]); setShowSuggestions(false); setShowHistory(false);
    const query = locationName.trim();

    if (!query || query === 'My Location' || query === 'Custom Location') {
      fetchJobs();
      saveToHistory({ location: query || 'Current location', title: titleQuery.trim(), radius, lat: center.lat, lng: center.lng });
      setHistory(getHistory());
      return;
    }
    setLoading(true);
    try {
      const res  = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=1`,
        { headers: NOMINATIM_HEADERS }
      );
      const data = await res.json();
      if (data.length > 0) {
        const newCenter = { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
        setCenter(newCenter);
        setSelectedJobId(null);
        fetchJobs(newCenter, radius);
        saveToHistory({ location: query, title: titleQuery.trim(), radius, lat: newCenter.lat, lng: newCenter.lng });
      } else {
        fetchJobs();
        saveToHistory({ location: query, title: titleQuery.trim(), radius, lat: center.lat, lng: center.lng });
      }
    } catch {
      fetchJobs();
    }
    setHistory(getHistory());
  }, [locationName, fetchJobs, titleQuery, radius, center]);

  // ── Restore history entry ─────────────────────────────────────
  const restoreHistory = useCallback((entry) => {
    setShowHistory(false); setSuggestions([]); setShowSuggestions(false);
    setLocationName(entry.location);
    mapTitleTouchedRef.current = true;
    setTitleQuery(entry.title || '');
    setRadius(entry.radius || DEFAULT_RADIUS_KM);
    const newCenter = { lat: entry.lat, lng: entry.lng };
    setCenter(newCenter);
    setSelectedJobId(null);
    widenSessionRef.current = null;
    setJobs([]);
    setLastMeta(null);
    setHasSearched(false);
    setError(null);
  }, []);

  // ── Map handlers ──────────────────────────────────────────────
  const handleMapClick = useCallback((e) => {
    // Just move the centre — user must click "Search Jobs" to fetch
    const newCenter = { lat: e.latLng.lat(), lng: e.latLng.lng() };
    setCenter(newCenter);
    setLocationName('Custom Location');
    setSelectedJobId(null);
  }, []);

  const handleMarkerClick  = useCallback((id) => {
    const sid = String(id);
    setSelectedJobId(p => (p != null && String(p) === sid ? null : sid));
    const job = jobs.find(j => String(j._id) === sid);
    if (job) setDetailJob(job);
  }, [jobs]);

  const handleJobCardClick = useCallback((id) => {
    const sid = String(id);
    setSelectedJobId(sid);
    const job = jobs.find(j => String(j._id) === sid);
    if (job) setDetailJob(job);
  }, [jobs]);

  // Dropdown priority: suggestions > history
  const dropdownMode = showSuggestions && suggestions.length > 0
    ? 'suggestions'
    : showHistory && history.length > 0 && !showSuggestions
    ? 'history'
    : null;

  return (
    /* Negative margin cancels the main content padding; height fills viewport minus header+bottom-nav */
    <div className="flex flex-col overflow-hidden map-search-container -m-4 sm:-m-6">

      {/* ── Top bar ─────────────────────────────────────────────── */}
      <div
        className="bg-white border-b border-gray-200 flex-shrink-0 shadow-sm px-3 sm:px-4 py-2 sm:py-2.5"
        style={{ position: 'relative', zIndex: 1000 }}
      >
        {/* Row 1 — inputs */}
        <div className="flex items-center gap-2 mb-2 sm:mb-0 sm:inline-flex sm:w-auto w-full">
          {/* Job title */}
          <div className="relative flex-1 sm:flex-none">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
            <input
              value={titleQuery}
              onChange={(e) => {
                mapTitleTouchedRef.current = true;
                setTitleQuery(e.target.value);
              }}
              onKeyDown={e => e.key === 'Enter' && geocodeAndSearch()}
              placeholder="Job title or keywords…"
              title="Filled from your profile target role (Career tab) when empty — you can change it anytime."
              className="input pl-9 h-9 text-sm w-full sm:w-44 md:w-52"
            />
          </div>

          {/* Location input wrapper */}
          <div className="relative flex-1 sm:flex-none">
            <div className="flex items-center gap-1">
              <div className="relative flex-1 sm:flex-none">
                <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-blue-500 pointer-events-none" />
                {sugLoading && (
                  <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-400 animate-spin pointer-events-none" />
                )}
                <input
                  ref={locationInputRef}
                  value={locationName}
                  onChange={e => { setLocationName(e.target.value); setShowHistory(false); }}
                  onFocus={() => {
                    if (suggestions.length > 0) setShowSuggestions(true);
                    else if (history.length > 0 && locationName.trim().length < 2) setShowHistory(true);
                  }}
                  onBlur={() => {
                    setTimeout(() => { setShowSuggestions(false); setShowHistory(false); }, 220);
                  }}
                  onKeyDown={e => e.key === 'Enter' && geocodeAndSearch()}
                  placeholder="Location..."
                  className="input pl-9 pr-2 h-9 text-sm w-full sm:w-36 md:w-44"
                />
              </div>
              <button
                onClick={handleGpsClick}
                disabled={locatingGps}
                title="Use my current location"
                className="flex-shrink-0 h-9 w-9 flex items-center justify-center rounded-lg border border-gray-300 bg-white text-blue-600 hover:bg-blue-50 hover:border-blue-300 transition-colors disabled:opacity-50"
              >
                {locatingGps ? <Loader2 className="w-4 h-4 animate-spin" /> : <LocateFixed className="w-4 h-4" />}
              </button>
            </div>

            {/* Dropdown */}
            {dropdownMode && (
              <div
                className="absolute top-full left-0 mt-1 w-72 max-w-[calc(100vw-2rem)] bg-white rounded-xl border border-gray-200 shadow-xl z-[1200] overflow-hidden"
                onMouseDown={(e) => e.preventDefault()}
                role="listbox"
                aria-label="Location suggestions"
              >
                {dropdownMode === 'suggestions' && (
                  <>
                    <div className="px-3 py-2 border-b border-gray-100 flex items-center gap-1.5">
                      <Navigation className="w-3 h-3 text-blue-400" />
                      <span className="text-xs font-semibold text-gray-500">Location suggestions</span>
                    </div>
                    {suggestions.map((s, i) => (
                      <button
                        key={`${s.lat},${s.lng},${s.short}`}
                        type="button"
                        onMouseDown={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          pickSuggestion(s);
                        }}
                        className="w-full text-left px-3 py-2.5 hover:bg-blue-50 transition-colors flex items-start gap-2.5 border-b border-gray-50 last:border-0"
                      >
                        <MapPin className="w-3.5 h-3.5 text-blue-400 flex-shrink-0 mt-0.5" />
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-gray-800 truncate">{s.short}</p>
                          <p className="text-xs text-gray-400 truncate leading-snug">{s.full}</p>
                        </div>
                      </button>
                    ))}
                  </>
                )}
                {dropdownMode === 'history' && (
                  <>
                    <div className="flex items-center justify-between px-3 py-2 border-b border-gray-100">
                      <span className="text-xs font-semibold text-gray-500 flex items-center gap-1.5">
                        <Clock className="w-3 h-3" /> Recent searches
                      </span>
                      <button onMouseDown={e => { e.preventDefault(); clearHistory(); setHistory([]); setShowHistory(false); }}
                        className="text-xs text-red-500 hover:text-red-700 transition-colors">Clear</button>
                    </div>
                    <button onMouseDown={e => { e.preventDefault(); handleGpsClick(); setShowHistory(false); }}
                      className="w-full text-left px-3 py-2.5 hover:bg-blue-50 transition-colors flex items-center gap-2.5 border-b border-gray-100">
                      <LocateFixed className="w-3.5 h-3.5 text-blue-500 flex-shrink-0" />
                      <span className="text-xs font-semibold text-blue-600">Use my current location</span>
                    </button>
                    {history.map((entry, i) => (
                      <button key={i} onMouseDown={e => { e.preventDefault(); restoreHistory(entry); }}
                        className="w-full text-left px-3 py-2 hover:bg-gray-50 transition-colors flex items-center gap-2.5">
                        <Clock className="w-3 h-3 text-gray-300 flex-shrink-0" />
                        <div className="min-w-0">
                          <p className="text-xs font-medium text-gray-800 truncate">{entry.location}</p>
                          <p className="text-xs text-gray-400 truncate">
                            {[entry.title && `"${entry.title}"`, entry.radius && `${entry.radius} km`].filter(Boolean).join(' · ')}
                          </p>
                        </div>
                      </button>
                    ))}
                  </>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Row 2 — radius, quick widen, search */}
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:ml-2">
          <div className="flex flex-wrap items-center gap-2">
            <RadiusControl value={radius} onChange={setRadius} />
            <div className="flex items-center gap-1 flex-wrap">
              <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide hidden sm:inline">Widen</span>
              {RADIUS_PRESETS_KM.map((km) => (
                <button
                  key={km}
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => applyQuickRadius(km)}
                  disabled={loading}
                  className={`text-xs font-semibold px-2 py-1 rounded-lg border transition-colors ${
                    radius === km
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'bg-white text-gray-600 border-gray-200 hover:border-blue-300 hover:bg-blue-50'
                  }`}
                >
                  {km} km
                </button>
              ))}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={geocodeAndSearch}
              disabled={loading}
              className="btn btn-primary btn-sm gap-1.5 flex-shrink-0"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
              <span className="hidden xs:inline">Search Jobs</span>
              <span className="xs:hidden">Search</span>
            </button>
            {hasSearched && !loading && (
              <span className="text-xs text-gray-500 flex-shrink-0 flex flex-col items-end sm:items-start sm:inline sm:flex-row sm:gap-1">
                {jobs.length > 0
                  ? (
                    <>
                      <strong className="text-blue-600">{jobs.length}</strong>
                      {' found'}
                      {resultsRadiusKm != null ? ` · ${resultsRadiusKm} km` : ''}
                      {lastMeta?.widenKeptFromSmallerRadius > 0 && (
                        <span className="text-emerald-600 font-medium">
                          {' '}
                          (+{lastMeta.widenKeptFromSmallerRadius} kept from smaller radius)
                        </span>
                      )}
                    </>
                  )
                  : 'No jobs'
                }
                {radiusStale && (
                  <span className="text-amber-600 font-medium max-w-[220px] sm:max-w-none text-right sm:text-left" title="Search ring matches the control; job pins are from the last request.">
                    Ring is {radius} km — click Search to load that radius.
                  </span>
                )}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* ── Search history chips ─────────────────────────────────── */}
      {history.length > 0 && (
        <div
          className="bg-white border-b border-gray-100 flex-shrink-0 px-3 sm:px-4 py-1.5 flex items-center gap-2 overflow-x-auto"
          style={{ position: 'relative', zIndex: 999 }}
        >
          <div className="flex items-center gap-1 text-gray-400 flex-shrink-0">
            <History className="w-3 h-3" />
            <span className="text-[10px] font-semibold uppercase tracking-wide">Recent</span>
          </div>
          <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5">
            {history.map((entry, i) => (
              <button
                key={i}
                onClick={() => restoreHistory(entry)}
                className="flex-shrink-0 flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-blue-50 hover:bg-blue-100 border border-blue-200 text-blue-700 text-xs font-medium transition-colors group"
                title={`Search: ${entry.title ? `"${entry.title}" in ` : ''}${entry.location} · ${entry.radius || DEFAULT_RADIUS_KM} km`}
              >
                <MapPin className="w-3 h-3 flex-shrink-0" />
                <span className="max-w-[120px] truncate">
                  {entry.title ? `${entry.title} · ` : ''}{entry.location}
                </span>
                {entry.radius && <span className="text-blue-400 text-[10px]">{entry.radius}km</span>}
                {entry.savedAt && <span className="text-blue-300 text-[10px] hidden sm:inline">{fAgo(entry.savedAt)}</span>}
              </button>
            ))}
          </div>
          <button
            onClick={() => { clearHistory(); setHistory([]); }}
            className="flex-shrink-0 p-1 rounded-full hover:bg-gray-100 text-gray-300 hover:text-gray-500 transition-colors ml-auto"
            title="Clear history"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* ── Body ─────────────────────────────────────────────────── */}
      <div className="flex flex-1 overflow-hidden">
        {/* Job list — hidden on mobile, visible on lg+ */}
        <div className="hidden lg:flex flex-shrink-0">
          <JobListPanel
            jobs={jobs}
            loading={loading}
            error={error}
            hasSearched={hasSearched}
            selectedJobId={selectedJobId}
            onJobClick={handleJobCardClick}
            open={panelOpen}
            onToggle={() => setPanelOpen(p => !p)}
            savedIds={savedIds}
            onSaveToggle={handleSaveToggle}
            savedJobDocIds={savedJobDocIds}
            onEnrichStored={handleEnrichStored}
            enrichLoading={enrichLoading}
            searchAreaLabel={lastMeta?.searchAreaLabel}
            mapCountMeta={lastMeta}
          />
        </div>

        {/* Map */}
        <div className="flex-1 relative" style={{ zIndex: 0 }}>
          <MapView
            center={center}
            radiusMeters={radius * 1000}
            jobs={jobs}
            loading={loading}
            selectedJobId={selectedJobId}
            onMapClick={handleMapClick}
            onMarkerClick={handleMarkerClick}
            savedIds={savedIds}
            onSaveToggle={handleSaveToggle}
          />
          {/* Mobile job count badge */}
          {hasSearched && !loading && jobs.length > 0 && (
            <div className="lg:hidden absolute top-2 right-2 z-[500] bg-white/90 backdrop-blur-sm border border-gray-200 rounded-xl px-3 py-1.5 shadow-sm">
              <span className="text-xs font-semibold text-blue-600">{jobs.length} jobs</span>
              <span className="text-xs text-gray-500"> · tap markers</span>
            </div>
          )}
          {/* Mobile: no jobs — widen + enrich */}
          {hasSearched && !loading && jobs.length === 0 && (
            <div className="lg:hidden absolute bottom-3 left-3 right-3 z-[500] bg-white/95 backdrop-blur-sm border border-gray-200 rounded-xl p-3 shadow-lg space-y-2">
              <p className="text-xs text-gray-600 text-center">Try a larger radius or add coordinates to saved jobs in this area.</p>
              <div className="flex flex-wrap gap-1.5 justify-center">
                {RADIUS_PRESETS_KM.map((km) => (
                  <button
                    key={km}
                    type="button"
                    onClick={() => applyQuickRadius(km)}
                    className="text-xs font-semibold px-2 py-1 rounded-lg border border-gray-200 bg-white hover:bg-blue-50"
                  >
                    {km} km
                  </button>
                ))}
              </div>
              <button
                type="button"
                onClick={handleEnrichStored}
                disabled={enrichLoading}
                className="btn btn-secondary btn-sm w-full justify-center gap-1.5"
              >
                {enrichLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                Enrich saved jobs (geo)
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ── Job detail sheet ─────────────────────────────────────── */}
      {detailJob && (
        <GeoJobDetailSheet
          job={detailJob}
          savedIds={savedIds}
          onSaveToggle={handleSaveToggle}
          savedJobDocIds={savedJobDocIds}
          onClose={() => setDetailJob(null)}
        />
      )}
    </div>
  );
}
