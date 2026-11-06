// GPX parsing. Built for Zepp / Amazfit exports (gpxtpx:TrackPointExtension with
// hr and speed in m/s) but tolerant of any GPX 1.0/1.1 track: when speed is
// missing it is derived from positions.

import { haversine } from './geo';
import type { ParsedTrack, TrackPoint } from './types';

const TPX_NS = [
  'http://www.garmin.com/xmlschemas/TrackPointExtension/v1',
  'http://www.garmin.com/xmlschemas/TrackPointExtension/v2',
];

function childValue(el: Element, localName: string): string | null {
  for (const ns of TPX_NS) {
    const found = el.getElementsByTagNameNS(ns, localName)[0];
    if (found?.textContent) return found.textContent;
  }
  const any = el.getElementsByTagNameNS('*', localName)[0];
  return any?.textContent ?? null;
}

export function parseGpx(text: string, fileName: string): ParsedTrack {
  const doc = new DOMParser().parseFromString(text, 'application/xml');
  if (doc.getElementsByTagName('parsererror').length) throw new Error(`ملف GPX غير صالح: ${fileName}`);

  const trkpts = Array.from(doc.getElementsByTagNameNS('*', 'trkpt'));
  if (trkpts.length < 2) throw new Error(`الملف مفيهوش نقط كفاية: ${fileName}`);

  const raw: { time: number; lat: number; lon: number; hr: number | null; speed: number | null }[] = [];
  for (const p of trkpts) {
    const lat = Number(p.getAttribute('lat'));
    const lon = Number(p.getAttribute('lon'));
    const timeText = p.getElementsByTagNameNS('*', 'time')[0]?.textContent;
    if (!Number.isFinite(lat) || !Number.isFinite(lon) || !timeText) continue;
    const time = Date.parse(timeText);
    if (!Number.isFinite(time)) continue;
    const hrText = childValue(p, 'hr');
    const spText = childValue(p, 'speed');
    const hr = hrText != null && hrText !== '' ? Number(hrText) : null;
    const speed = spText != null && spText !== '' ? Number(spText) : null;
    raw.push({ time, lat, lon, hr: hr && hr > 0 ? hr : null, speed: speed != null && Number.isFinite(speed) ? speed : null });
  }
  raw.sort((a, b) => a.time - b.time);
  // Drop duplicate timestamps.
  const pts = raw.filter((p, i) => i === 0 || p.time !== raw[i - 1].time);
  if (pts.length < 2) throw new Error(`الملف مفيهوش نقط كفاية: ${fileName}`);

  const t0 = pts[0].time;
  const hasSpeed = pts.every((p) => p.speed != null);
  const points: TrackPoint[] = pts.map((p) => ({
    t: (p.time - t0) / 1000,
    lat: p.lat,
    lon: p.lon,
    hr: p.hr,
    speedKmh: hasSpeed ? (p.speed as number) * 3.6 : null,
  }));
  if (!hasSpeed) fillComputedSpeed(points);

  const name = doc.getElementsByTagNameNS('*', 'trk')[0]?.getElementsByTagNameNS('*', 'name')[0]?.textContent?.trim() || fileName;
  return {
    id: String(t0),
    fileName,
    name,
    startTime: t0,
    points,
    speedSource: hasSpeed ? 'device' : 'computed',
  };
}

/** Centred 3-sample speed from positions, for watches that do not write speed. */
function fillComputedSpeed(points: TrackPoint[]) {
  for (let i = 0; i < points.length; i++) {
    const a = points[Math.max(0, i - 1)];
    const b = points[Math.min(points.length - 1, i + 1)];
    const dt = b.t - a.t;
    points[i].speedKmh = dt > 0 ? (haversine(a.lat, a.lon, b.lat, b.lon) / dt) * 3.6 : 0;
  }
}

/** Start time encoded in Zepp file names (Zepp20260715201838.gpx), if present. */
export function startFromFileName(fileName: string): string | null {
  const m = fileName.match(/(\d{14})/);
  return m ? m[1] : null;
}
