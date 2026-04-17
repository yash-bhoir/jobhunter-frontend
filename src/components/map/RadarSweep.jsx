import { useEffect } from 'react';
import { Circle } from 'react-leaflet';

// Inject keyframes once
const STYLE_ID = 'radar-sweep-style';
if (!document.getElementById(STYLE_ID)) {
  const s = document.createElement('style');
  s.id = STYLE_ID;
  s.textContent = `
    @keyframes radarRing {
      0%   { stroke-opacity: 0;   fill-opacity: 0; }
      15%  { stroke-opacity: 0.9; fill-opacity: 0.08; }
      100% { stroke-opacity: 0;   fill-opacity: 0; }
    }
    .rs-0 { animation: radarRing 2.2s ease-out 0s    infinite; }
    .rs-1 { animation: radarRing 2.2s ease-out 0.55s infinite; }
    .rs-2 { animation: radarRing 2.2s ease-out 1.1s  infinite; }

    @keyframes radiusPulse {
      0%, 100% { stroke-opacity: 0.4;  fill-opacity: 0.06; }
      50%      { stroke-opacity: 0.85; fill-opacity: 0.14; }
    }
    .radius-loading { animation: radiusPulse 1.1s ease-in-out infinite; }
  `;
  document.head.appendChild(s);
}

const RING_OPTIONS = {
  color:       '#3b82f6',
  weight:      2,
  fillColor:   '#3b82f6',
  fillOpacity: 0,
  opacity:     0,
};

export default function RadarSweep({ center, radiusMeters }) {
  return (
    <>
      {/* Three rings at 30 %, 60 %, 90 % of the search radius */}
      {[0.3, 0.6, 0.9].map((frac, i) => (
        <Circle
          key={i}
          center={[center.lat, center.lng]}
          radius={radiusMeters * frac}
          className={`rs-${i}`}
          pathOptions={RING_OPTIONS}
        />
      ))}
    </>
  );
}
