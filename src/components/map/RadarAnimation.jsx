import { useEffect, useRef } from 'react';
import { useMap } from 'react-leaflet';
import L from 'leaflet';

// Inject keyframe CSS once
const STYLE_ID = 'radar-anim-style';
if (!document.getElementById(STYLE_ID)) {
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    @keyframes radar-pulse {
      0%   { transform: translate(-50%,-50%) scale(0.3); opacity: 0.7; }
      100% { transform: translate(-50%,-50%) scale(5);   opacity: 0;   }
    }
    .radar-ring {
      position: absolute;
      width: 36px; height: 36px;
      border-radius: 50%;
      border: 2px solid rgba(59,130,246,0.55);
      background: rgba(59,130,246,0.07);
      animation: radar-pulse 2.2s ease-out infinite;
      pointer-events: none;
    }
    .radar-dot {
      position: absolute;
      width: 12px; height: 12px;
      border-radius: 50%;
      background: #2563eb;
      border: 2.5px solid white;
      transform: translate(-50%,-50%);
      box-shadow: 0 1px 4px rgba(0,0,0,0.25);
      pointer-events: none;
    }
  `;
  document.head.appendChild(style);
}

export default function RadarAnimation({ center }) {
  const map     = useMap();
  const markerRef = useRef(null);

  useEffect(() => {
    const html = `
      <div style="position:relative;width:0;height:0;">
        <div class="radar-ring" style="animation-delay:0s"></div>
        <div class="radar-ring" style="animation-delay:0.75s"></div>
        <div class="radar-ring" style="animation-delay:1.5s"></div>
        <div class="radar-dot"></div>
      </div>`;

    const icon = L.divIcon({
      html,
      className:  '',
      iconSize:   [0, 0],
      iconAnchor: [0, 0],
    });

    const marker = L.marker([center.lat, center.lng], {
      icon,
      interactive:  false,
      zIndexOffset: -100,
    }).addTo(map);

    markerRef.current = marker;
    return () => marker.remove();
  }, [map, center.lat, center.lng]);

  return null;
}
