import { useEffect, useMemo, useRef } from 'react';
import { MapContainer, TileLayer, Circle, useMap, useMapEvents } from 'react-leaflet';
import JobMarker      from './JobMarker';
import RadarAnimation from './RadarAnimation';
import RadarSweep     from './RadarSweep';

// ── Dynamic zoom based on radius ─────────────────────────────────
function getZoom(km) {
  if (km <= 5)  return 13;
  if (km <= 10) return 12;
  if (km <= 20) return 11;
  if (km <= 50) return 10;
  return 9;
}

// ── Sync map centre + zoom when props change ──────────────────────
function MapController({ center, zoom }) {
  const map  = useMap();
  const prev = useRef(null);

  useEffect(() => {
    const key = `${center.lat},${center.lng},${zoom}`;
    if (prev.current === key) return;
    prev.current = key;
    map.setView([center.lat, center.lng], zoom, { animate: true, duration: 0.5 });
  }, [center, zoom, map]);

  return null;
}

// ── Fire onMapClick with {latLng} compatible shape ────────────────
function ClickHandler({ onMapClick }) {
  useMapEvents({
    click(e) {
      onMapClick({ latLng: { lat: () => e.latlng.lat, lng: () => e.latlng.lng } });
    },
  });
  return null;
}

// Radius circle options — normal vs loading (pulsing)
const CIRCLE_NORMAL  = { color: '#3b82f6', fillColor: '#3b82f6', fillOpacity: 0.07, weight: 1.5, opacity: 0.45 };
const CIRCLE_LOADING = { color: '#3b82f6', fillColor: '#3b82f6', fillOpacity: 0.07, weight: 2,   opacity: 0.45,
                         className: 'radius-loading' };

const MAP_CONTAINER = { width: '100%', height: '100%' };

export default function MapView({
  center,
  radiusMeters,
  jobs,
  loading,
  selectedJobId,
  onMapClick,
  onMarkerClick,
  savedIds,
  onSaveToggle,
}) {
  const zoom = useMemo(() => getZoom(radiusMeters / 1000), [radiusMeters]);

  return (
    <MapContainer
      center={[center.lat, center.lng]}
      zoom={zoom}
      style={MAP_CONTAINER}
      zoomControl={true}
      attributionControl={true}
    >
      {/* OpenStreetMap tiles */}
      <TileLayer
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        maxZoom={19}
      />

      <MapController center={center} zoom={zoom} />
      <ClickHandler onMapClick={onMapClick} />

      {/* Radius boundary — pulses while searching */}
      <Circle
        center={[center.lat, center.lng]}
        radius={radiusMeters}
        pathOptions={loading ? CIRCLE_LOADING : CIRCLE_NORMAL}
      />

      {/* Pulsing radar dot at search centre */}
      <RadarAnimation center={center} />

      {/* Expanding radar rings while the API fetch is in progress */}
      {loading && (
        <RadarSweep center={center} radiusMeters={radiusMeters} />
      )}

      {/* Job markers — each pops in with a staggered delay */}
      {jobs.map((job, index) => (
        <JobMarker
          key={job._id}
          job={job}
          index={index}
          isSelected={String(selectedJobId) === String(job._id)}
          onClick={onMarkerClick}
          savedIds={savedIds}
          onSaveToggle={onSaveToggle}
        />
      ))}
    </MapContainer>
  );
}
