// Satellite view of the real pitch, located from the watch's own GPS: north up,
// the estimated pitch outline, the track, and optionally a pin at each goal end.
// Only tile requests (the pitch's rough location) leave the device.

import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useEffect, useRef } from 'react';
import type { GoalEnd } from '../analysis/types';
import { C } from './format';

const TILES = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';

export function SatellitePicker({ track, ends, corners, words, chosen, onPick, onFail, compact }: {
  track: [number, number][];
  ends: { a: [number, number]; b: [number, number] };
  corners: [number, number][];
  words: { a: string; b: string };
  chosen: GoalEnd | null;
  /** Without it the map only shows the pitch (no pins). */
  onPick?: (e: GoalEnd) => void;
  /** Called once when tiles cannot load (offline or blocked). */
  onFail?: () => void;
  compact?: boolean;
}) {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const layer = useRef<L.LayerGroup | null>(null);
  const fitted = useRef(false);
  const failRef = useRef(onFail);
  failRef.current = onFail;

  useEffect(() => {
    if (!el.current || map.current) return;
    map.current = L.map(el.current, { zoomControl: !compact, attributionControl: true, zoomSnap: 0.25, dragging: !compact || !L.Browser.mobile, scrollWheelZoom: !compact });
    let errors = 0, loaded = 0;
    L.tileLayer(TILES, { maxZoom: 21, maxNativeZoom: 19, attribution: 'Esri, Maxar' })
      .on('tileload', () => { loaded++; })
      .on('tileerror', () => { errors++; if (errors >= 3 && loaded === 0) failRef.current?.(); })
      .addTo(map.current);
    layer.current = L.layerGroup().addTo(map.current);
    return () => { map.current?.remove(); map.current = null; fitted.current = false; };
  }, [compact]);

  useEffect(() => {
    const m = map.current, g = layer.current;
    if (!m || !g) return;
    g.clearLayers();
    L.polygon(corners, { color: '#fff', weight: 2, dashArray: '6 6', fill: false }).addTo(g);
    L.polyline(track, { color: C.cyan, weight: 1.5, opacity: 0.65 }).addTo(g);
    if (onPick) {
      (['a', 'b'] as GoalEnd[]).forEach((k) => {
        const on = chosen === k;
        const icon = L.divIcon({
          className: '',
          html: `<button class="sat-pin ${on ? 'on' : ''}">${on ? 'مرماك ✓' : 'مرماك هنا؟'}<small>ناحية ${words[k]}</small></button>`,
          iconSize: [130, 48], iconAnchor: [65, 24],
        });
        L.marker(ends[k], { icon }).on('click', () => onPick(k)).addTo(g);
      });
    } else if (chosen) {
      const icon = L.divIcon({ className: '', html: `<span class="sat-pin on">مرماك</span>`, iconSize: [70, 30], iconAnchor: [35, 15] });
      L.marker(ends[chosen], { icon, interactive: false }).addTo(g);
    }
    if (!fitted.current && corners.length) {
      m.fitBounds(L.latLngBounds(corners).pad(compact ? 0.25 : 0.45), { animate: false });
      fitted.current = true;
    }
  }, [track, ends, corners, words, chosen, onPick, compact]);

  return (
    <div className={`sat-wrap ${compact ? 'compact' : ''}`}>
      <div ref={el} className="sat-map" />
      <div className="north" aria-label="الشمال لفوق">
        <svg viewBox="0 0 24 24" width="22" height="22"><path d="M12 2l6 18-6-4-6 4z" fill={C.coral} /></svg>
        <b>شمال</b>
      </div>
    </div>
  );
}
