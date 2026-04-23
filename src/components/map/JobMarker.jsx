import { memo, useCallback, useState, useRef, useEffect } from 'react';
import { Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import { api } from '@utils/axios';

// Inject animation keyframe once
const POP_STYLE_ID = 'marker-popin-style';
if (!document.getElementById(POP_STYLE_ID)) {
  const s = document.createElement('style');
  s.id = POP_STYLE_ID;
  s.textContent = `
    @keyframes markerPopIn {
      0%   { transform: scale(0) translateY(14px); opacity: 0; }
      65%  { transform: scale(1.2) translateY(-4px); opacity: 1; }
      100% { transform: scale(1) translateY(0); opacity: 1; }
    }
  `;
  document.head.appendChild(s);
}

// ── Logo resolution ───────────────────────────────────────────────

// Extract root domain from a URL  (https://careers.infosys.com/... → infosys.com)
function domainFromUrl(url) {
  if (!url || url === '#') return null;
  try {
    const { hostname } = new URL(url);
    // Skip Adzuna / JSearch / SerpAPI redirect domains — they won't have a useful logo
    const skip = ['adzuna', 'rapidapi', 'serpapi', 'jsearch', 'redirect', 'track'];
    if (skip.some(s => hostname.includes(s))) return null;
    const parts = hostname.replace(/^www\./, '').split('.');
    return parts.length >= 2 ? parts.slice(-2).join('.') : hostname;
  } catch {
    return null;
  }
}

// Guess domain from company name  (e.g. "Infosys Ltd" → "infosys.com")
// Strategy: use just the FIRST meaningful word of the company name,
// which is almost always the brand name that Clearbit / Google have a logo for.
function guessDomain(company) {
  if (!company) return null;
  // Strip legal / generic suffixes from end, then take the first word
  const stripped = company
    .replace(/\b(ltd\.?|limited|inc\.?|llc|pvt\.?|private|corp\.?|corporation|co\.?|group|global|india|technologies|technology|tech|solutions|services|systems|consulting|ventures|holdings)\b\.?/gi, '')
    .trim();
  // Take the first word (the brand name)
  const firstWord = stripped.split(/[\s,.\-&()/|]+/)[0];
  const clean = firstWord.replace(/[^a-z0-9]/gi, '').toLowerCase();
  return clean.length > 2 ? `${clean}.com` : null;
}

// Build an SVG data-URI to use as onerror fallback (company initial in a coloured circle)
function fallbackDataUri(initial, color) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32">
    <circle cx="16" cy="16" r="16" fill="${color}"/>
    <text x="16" y="21" font-family="Arial,sans-serif" font-size="15" font-weight="700"
          fill="white" text-anchor="middle">${initial.toUpperCase()}</text>
  </svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

// ── Icon factory ──────────────────────────────────────────────────
function makeLogoIcon(job, isSelected, delayMs) {
  const SIZE   = isSelected ? 44 : 38;
  const color  = isSelected ? '#1d4ed8' : '#3b82f6';
  const shadow = isSelected
    ? '0 4px 18px rgba(29,78,216,0.55)'
    : '0 2px 10px rgba(0,0,0,0.22)';

  const initial  = (job.company || job.title || '?')[0];
  const domain   = domainFromUrl(job.applyUrl) || guessDomain(job.company);
  const fbSrc    = fallbackDataUri(initial, color);

  // Fallback chain: Clearbit → Google Favicons → SVG initial
  // onerror reassigns itself before switching src so the second failure is also caught
  const imgHtml = domain
    ? `<img
        src="https://logo.clearbit.com/${domain}"
        onerror="this.onerror=function(){this.onerror=null;this.src='${fbSrc}'};this.src='https://www.google.com/s2/favicons?domain=${domain}&sz=128'"
        style="width:${SIZE - 14}px;height:${SIZE - 14}px;object-fit:contain;border-radius:3px;"
        draggable="false"
      />`
    : `<img src="${fbSrc}" style="width:${SIZE - 14}px;height:${SIZE - 14}px;" draggable="false"/>`;

  const anim = delayMs >= 0
    ? `animation:markerPopIn 0.45s cubic-bezier(0.34,1.56,0.64,1) ${delayMs}ms both;`
    : '';

  const html = `
    <div style="${anim}transform-origin:50% 100%;display:inline-block;">
      <div style="
        width:${SIZE}px;height:${SIZE}px;
        border-radius:50%;
        background:#fff;
        border:2.5px solid ${color};
        box-shadow:${shadow};
        display:flex;align-items:center;justify-content:center;
        overflow:hidden;
      ">${imgHtml}</div>
      <div style="
        width:0;height:0;
        border-left:7px solid transparent;
        border-right:7px solid transparent;
        border-top:9px solid ${color};
        margin:-1px auto 0;
      "></div>
    </div>`;

  return L.divIcon({
    html,
    className:   '',
    iconSize:    [SIZE, SIZE + 9],
    iconAnchor:  [SIZE / 2, SIZE + 9],
    popupAnchor: [0, -(SIZE + 9)],
  });
}

// ── Component ─────────────────────────────────────────────────────
function JobMarker({ job, index, isSelected, onClick, savedIds, onSaveToggle }) {
  const coords = job.location?.coordinates;
  if (
    !coords || coords.length < 2 ||
    !Number.isFinite(coords[0]) || !Number.isFinite(coords[1])
  ) return null;

  const position   = [coords[1], coords[0]];
  const sid        = String(job._id);
  const isSaved =
    (savedIds?.has(sid) ?? false) || job.status === 'saved';
  const [saving, setSaving] = useState(false);
  const markerRef  = useRef(null);
  const mountedRef = useRef(false);
  const popDelay   = useRef(index * 70);

  useEffect(() => { mountedRef.current = true; }, []);

  const icon = makeLogoIcon(job, isSelected, mountedRef.current ? -1 : popDelay.current);

  const handleClick = useCallback(() => onClick(sid), [sid, onClick]);

  const handleSave = useCallback(async (e) => {
    e.stopPropagation();
    setSaving(true);
    try {
      if (isSaved) {
        await api.post(`/geo-jobs/${sid}/unsave`);
        onSaveToggle?.(sid, false);
      } else {
        await api.post(`/geo-jobs/${sid}/save`);
        onSaveToggle?.(sid, true);
      }
    } catch { /* ignore */ } finally { setSaving(false); }
  }, [isSaved, sid, onSaveToggle]);

  return (
    <Marker
      position={position}
      icon={icon}
      zIndexOffset={isSelected ? 1000 : 0}
      ref={markerRef}
      eventHandlers={{ click: handleClick }}
    >
      <Popup minWidth={230} maxWidth={290}>
        <div style={{ padding: '4px 2px' }}>
          {/* Company logo header */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            {(() => {
              const d = domainFromUrl(job.applyUrl) || guessDomain(job.company);
              if (!d) return null;
              return (
                <img
                  src={`https://logo.clearbit.com/${d}`}
                  onError={e => {
                    const t = e.target;
                    if (t.dataset.fb2) { t.style.display = 'none'; return; }
                    t.dataset.fb2 = '1';
                    t.src = `https://www.google.com/s2/favicons?domain=${d}&sz=64`;
                  }}
                  style={{ width: 28, height: 28, objectFit: 'contain', borderRadius: 4, flexShrink: 0 }}
                />
              );
            })()}
            <div style={{ minWidth: 0 }}>
              <p style={{ fontWeight: 700, fontSize: 13, color: '#111827', lineHeight: 1.3, marginBottom: 1 }}>
                {job.title}
              </p>
              <p style={{ fontSize: 12, color: '#2563eb', fontWeight: 600 }}>
                {job.company}
              </p>
              {typeof job.matchScore === 'number' && (
                <p style={{ fontSize: 11, color: '#059669', fontWeight: 700, marginTop: 2 }}>
                  ★ {job.matchScore}% match
                </p>
              )}
            </div>
          </div>

          {job.location?.address && (
            <p style={{ fontSize: 11, color: '#6b7280', marginBottom: 3 }}>📍 {job.location.address}</p>
          )}
          {job.salaryDisplay && (
            <p style={{ fontSize: 11, color: '#16a34a', fontWeight: 600, marginBottom: 3 }}>💰 {job.salaryDisplay}</p>
          )}
          {job.jobType && (
            <p style={{ fontSize: 11, color: '#6b7280', marginBottom: 6, textTransform: 'capitalize' }}>🕐 {job.jobType}</p>
          )}
          {job.tags?.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 8 }}>
              {job.tags.slice(0, 3).map(tag => (
                <span key={tag} style={{
                  fontSize: 10, padding: '2px 6px',
                  background: '#eff6ff', color: '#2563eb',
                  borderRadius: 4, fontWeight: 500,
                }}>{tag}</span>
              ))}
            </div>
          )}

          <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
            <button
              onClick={handleSave}
              disabled={saving}
              style={{
                flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
                background: isSaved ? '#eff6ff' : '#f9fafb',
                color: isSaved ? '#2563eb' : '#374151',
                border: `1px solid ${isSaved ? '#bfdbfe' : '#e5e7eb'}`,
                fontSize: 11, fontWeight: 600, padding: '6px 10px', borderRadius: 6,
                cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.6 : 1,
              }}
            >
              {isSaved ? '✓ Saved' : '🔖 Save'}
            </button>
            <a
              href={job.applyUrl || '#'}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                flex: 1, display: 'block', textAlign: 'center',
                background: '#2563eb', color: '#fff',
                fontSize: 11, fontWeight: 600, padding: '6px 10px',
                borderRadius: 6, textDecoration: 'none',
              }}
            >
              Apply →
            </a>
          </div>
        </div>
      </Popup>
    </Marker>
  );
}

export default memo(JobMarker);
