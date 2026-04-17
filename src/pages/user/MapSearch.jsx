import { useState, useEffect, useCallback, useRef } from 'react';
import { Search, MapPin, Loader2, Clock, LocateFixed, Navigation } from 'lucide-react';
import MapView            from '@components/map/MapView';
import JobListPanel       from '@components/map/JobListPanel';
import RadiusControl      from '@components/map/RadiusControl';
import GeoJobDetailSheet  from '@components/map/GeoJobDetailSheet';
import { api }            from '@utils/axios';
import { useDebounce }    from '@hooks/useDebounce';

const DEFAULT_CENTER    = { lat: 19.0760, lng: 72.8777 };
const DEFAULT_LOCATION  = 'Mumbai, India';
const DEFAULT_RADIUS_KM = 10;

// ── localStorage map-search history ─────────────────────────────
const HISTORY_KEY = 'mapSearchHistory';
function getHistory()      { try { return JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]'); } catch { return []; } }
function saveToHistory(e)  {
  const h = getHistory();
  localStorage.setItem(HISTORY_KEY, JSON.stringify(
    [e, ...h.filter(x => x.location !== e.location || x.title !== e.title)].slice(0, 8)
  ));
}
function clearHistory()    { localStorage.removeItem(HISTORY_KEY); }

export default function MapSearch() {
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

  // History
  const [history,       setHistory]       = useState(() => getHistory());
  const [showHistory,   setShowHistory]   = useState(false);

  // Location suggestions
  const [suggestions,     setSuggestions]     = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [sugLoading,      setSugLoading]      = useState(false);
  const [locatingGps,     setLocatingGps]     = useState(false);

  const locationInputRef = useRef(null);
  const sugDebounce      = useRef(null);

  const debouncedRadius = useDebounce(radius, 400);

  // ── Load saved GeoJob IDs on mount ────────────────────────────
  useEffect(() => {
    api.get('/geo-jobs/saved-ids')
      .then(({ data }) => {
        setSavedIds(new Set(data.data.ids));
        setSavedJobDocIds(data.data.docIdMap || {});
      })
      .catch(() => {});
  }, []);

  const handleSaveToggle = useCallback((jobId, isSaved) => {
    setSavedIds(prev => {
      const next = new Set(prev);
      isSaved ? next.add(jobId) : next.delete(jobId);
      return next;
    });
    if (isSaved) {
      api.get('/geo-jobs/saved-ids')
        .then(({ data }) => setSavedJobDocIds(data.data.docIdMap || {}))
        .catch(() => {});
    } else {
      setSavedJobDocIds(prev => { const n = { ...prev }; delete n[jobId]; return n; });
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
            { headers: { 'Accept-Language': 'en' } }
          );
          const data = await res.json();
          const addr = data.address || {};
          const name = addr.city || addr.town || addr.village || addr.county || 'My Location';
          setLocationName(name);
        } catch {
          setLocationName('My Location');
        }
      },
      () => {},
      { timeout: 6000, maximumAge: 60000 }
    );
  }, []);

  // ── Location suggestions via Nominatim ────────────────────────
  useEffect(() => {
    const q = locationName.trim();
    if (q.length < 2 || q === 'My Location' || q === 'Custom Location') {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }
    clearTimeout(sugDebounce.current);
    sugDebounce.current = setTimeout(async () => {
      setSugLoading(true);
      try {
        const res  = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(q)}&limit=6&addressdetails=1`,
          { headers: { 'Accept-Language': 'en' } }
        );
        const data = await res.json();
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
      } catch {
        setSuggestions([]);
      } finally {
        setSugLoading(false);
      }
    }, 380);
    return () => clearTimeout(sugDebounce.current);
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
            { headers: { 'Accept-Language': 'en' } }
          );
          const data = await res.json();
          const addr = data.address || {};
          const name = addr.city || addr.town || addr.village || addr.county || 'My Location';
          setLocationName(name);
        } catch {
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
    setLocationName(sug.short);
    setCenter({ lat: sug.lat, lng: sug.lng });
    setSuggestions([]);
    setShowSuggestions(false);
    setShowHistory(false);
  }, []);

  // ── Fetch nearby jobs ─────────────────────────────────────────
  const fetchJobs = useCallback(async (overrideCenter, overrideRadius) => {
    const lat = (overrideCenter ?? center).lat;
    const lng = (overrideCenter ?? center).lng;
    const km  = overrideRadius ?? debouncedRadius;
    setLoading(true); setError(null);
    try {
      const { data } = await api.get('/geo-jobs/nearby', {
        params: { lat, lng, radius: km, ...(titleQuery.trim() && { title: titleQuery.trim() }) },
      });
      setJobs(data.data?.jobs || []);
      setHasSearched(true);
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Failed to load jobs.');
    } finally {
      setLoading(false);
    }
  }, [center, debouncedRadius, titleQuery]);

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
        { headers: { 'Accept-Language': 'en' } }
      );
      const data = await res.json();
      if (data.length > 0) {
        const newCenter = { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
        setCenter(newCenter);
        setSelectedJobId(null);
        fetchJobs(newCenter, debouncedRadius);
        saveToHistory({ location: query, title: titleQuery.trim(), radius, lat: newCenter.lat, lng: newCenter.lng });
      } else {
        fetchJobs();
        saveToHistory({ location: query, title: titleQuery.trim(), radius, lat: center.lat, lng: center.lng });
      }
    } catch {
      fetchJobs();
    }
    setHistory(getHistory());
  }, [locationName, debouncedRadius, fetchJobs, titleQuery, radius, center]);

  // ── Restore history entry ─────────────────────────────────────
  const restoreHistory = useCallback((entry) => {
    setShowHistory(false); setSuggestions([]); setShowSuggestions(false);
    setLocationName(entry.location);
    setTitleQuery(entry.title || '');
    setRadius(entry.radius || DEFAULT_RADIUS_KM);
    const newCenter = { lat: entry.lat, lng: entry.lng };
    setCenter(newCenter);
    setSelectedJobId(null);
    fetchJobs(newCenter, entry.radius || DEFAULT_RADIUS_KM);
  }, [fetchJobs]);

  // ── Map handlers ──────────────────────────────────────────────
  const handleMapClick = useCallback((e) => {
    // Just move the centre — user must click "Search Jobs" to fetch
    const newCenter = { lat: e.latLng.lat(), lng: e.latLng.lng() };
    setCenter(newCenter);
    setLocationName('Custom Location');
    setSelectedJobId(null);
  }, []);

  const handleMarkerClick  = useCallback((id) => {
    setSelectedJobId(p => p === id ? null : id);
    const job = jobs.find(j => j._id === id);
    if (job) setDetailJob(job);
  }, [jobs]);

  const handleJobCardClick = useCallback((id) => {
    setSelectedJobId(id);
    const job = jobs.find(j => j._id === id);
    if (job) setDetailJob(job);
  }, [jobs]);

  // Dropdown priority: suggestions > history
  const dropdownMode = showSuggestions && suggestions.length > 0
    ? 'suggestions'
    : showHistory && history.length > 0 && !showSuggestions
    ? 'history'
    : null;

  return (
    <div className="flex flex-col -m-6 overflow-hidden" style={{ height: 'calc(100vh - 4rem)' }}>

      {/* ── Top bar ────────────────────────────────────────────── */}
      <div
        className="flex items-center gap-2.5 px-4 py-2.5 bg-white border-b border-gray-200 flex-shrink-0 shadow-sm flex-wrap"
        style={{ position: 'relative', zIndex: 1000 }}
      >

        {/* Job title search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
          <input
            value={titleQuery}
            onChange={e => setTitleQuery(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && geocodeAndSearch()}
            placeholder="Job title, skills..."
            className="input pl-9 h-9 text-sm w-52"
          />
        </div>

        {/* ── Location input + GPS button + dropdown ─────────── */}
        <div className="relative">
          <div className="flex items-center gap-1">
            {/* Location text input */}
            <div className="relative">
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
                onBlur={() => setTimeout(() => { setShowSuggestions(false); setShowHistory(false); }, 180)}
                onKeyDown={e => e.key === 'Enter' && geocodeAndSearch()}
                placeholder="City or location..."
                className="input pl-9 pr-8 h-9 text-sm w-44"
              />
            </div>

            {/* GPS / current location button */}
            <button
              onClick={handleGpsClick}
              disabled={locatingGps}
              title="Use my current location"
              className="flex-shrink-0 h-9 w-9 flex items-center justify-center rounded-lg border border-gray-300 bg-white text-blue-600 hover:bg-blue-50 hover:border-blue-300 transition-colors disabled:opacity-50"
            >
              {locatingGps
                ? <Loader2 className="w-4 h-4 animate-spin" />
                : <LocateFixed className="w-4 h-4" />
              }
            </button>
          </div>

          {/* ── Dropdown — suggestions or history ─────────────── */}
          {dropdownMode && (
            <div className="absolute top-full left-0 mt-1 w-72 bg-white rounded-xl border border-gray-200 shadow-xl z-[1200] overflow-hidden">

              {/* Suggestions */}
              {dropdownMode === 'suggestions' && (
                <>
                  <div className="px-3 py-2 border-b border-gray-100 flex items-center gap-1.5">
                    <Navigation className="w-3 h-3 text-blue-400" />
                    <span className="text-xs font-semibold text-gray-500">Location suggestions</span>
                  </div>
                  {suggestions.map((s, i) => (
                    <button
                      key={i}
                      onMouseDown={e => { e.preventDefault(); pickSuggestion(s); }}
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

              {/* History */}
              {dropdownMode === 'history' && (
                <>
                  <div className="flex items-center justify-between px-3 py-2 border-b border-gray-100">
                    <span className="text-xs font-semibold text-gray-500 flex items-center gap-1.5">
                      <Clock className="w-3 h-3" /> Recent searches
                    </span>
                    <button
                      onMouseDown={e => { e.preventDefault(); clearHistory(); setHistory([]); setShowHistory(false); }}
                      className="text-xs text-red-500 hover:text-red-700 transition-colors"
                    >
                      Clear
                    </button>
                  </div>
                  {/* "Use my location" row inside history dropdown */}
                  <button
                    onMouseDown={e => { e.preventDefault(); handleGpsClick(); setShowHistory(false); }}
                    className="w-full text-left px-3 py-2.5 hover:bg-blue-50 transition-colors flex items-center gap-2.5 border-b border-gray-100"
                  >
                    <LocateFixed className="w-3.5 h-3.5 text-blue-500 flex-shrink-0" />
                    <span className="text-xs font-semibold text-blue-600">Use my current location</span>
                  </button>
                  {history.map((entry, i) => (
                    <button
                      key={i}
                      onMouseDown={e => { e.preventDefault(); restoreHistory(entry); }}
                      className="w-full text-left px-3 py-2 hover:bg-gray-50 transition-colors flex items-center gap-2.5"
                    >
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

        {/* Radius */}
        <RadiusControl value={radius} onChange={setRadius} />

        {/* Search button */}
        <button
          onClick={geocodeAndSearch}
          disabled={loading}
          className="btn btn-primary btn-sm gap-1.5 flex-shrink-0"
        >
          {loading
            ? <Loader2 className="w-4 h-4 animate-spin" />
            : <Search className="w-4 h-4" />
          }
          Search Jobs
        </button>

        {/* Result count */}
        {hasSearched && !loading && (
          <span className="text-xs text-gray-500 flex-shrink-0 ml-1">
            {jobs.length > 0
              ? <><strong className="text-blue-600">{jobs.length}</strong> job{jobs.length !== 1 ? 's' : ''} found</>
              : 'No jobs found'
            }
          </span>
        )}
      </div>

      {/* ── Body ─────────────────────────────────────────────── */}
      <div className="flex flex-1 overflow-hidden">
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
        />

        <div className="flex-1 relative" style={{ zIndex: 0 }}>
          <MapView
            center={center}
            radiusMeters={debouncedRadius * 1000}
            jobs={jobs}
            loading={loading}
            selectedJobId={selectedJobId}
            onMapClick={handleMapClick}
            onMarkerClick={handleMarkerClick}
            savedIds={savedIds}
            onSaveToggle={handleSaveToggle}
          />
        </div>
      </div>

      {/* ── Job detail sheet ──────────────────────────────────── */}
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
