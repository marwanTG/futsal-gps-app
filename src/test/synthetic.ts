// Builds Zepp-style GPX text from a simple per-second movement script.

export interface Step { dEast: number; dNorth: number; speedKmh: number; hr?: number }

const LAT0 = 30.05, LON0 = 31.23;
const M_PER_DEG_LAT = 111194.93;

export function makeGpx(steps: Step[], start = Date.UTC(2026, 6, 15, 20, 18, 38), withSpeed = true): string {
  let e = 0, nth = 0;
  const pts = steps.map((s, i) => {
    e += s.dEast; nth += s.dNorth;
    const lat = LAT0 + nth / M_PER_DEG_LAT;
    const lon = LON0 + e / (M_PER_DEG_LAT * Math.cos((LAT0 * Math.PI) / 180));
    const time = new Date(start + i * 1000).toISOString();
    const ext = `<extensions><gpxtpx:TrackPointExtension><gpxtpx:hr>${s.hr ?? 150}</gpxtpx:hr>${withSpeed ? `<gpxtpx:speed>${(s.speedKmh / 3.6).toFixed(3)}</gpxtpx:speed>` : ''}</gpxtpx:TrackPointExtension></extensions>`;
    return `<trkpt lat="${lat.toFixed(8)}" lon="${lon.toFixed(8)}"><time>${time}</time>${ext}</trkpt>`;
  });
  return `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="test" xmlns="http://www.topografix.com/GPX/1/1" xmlns:gpxtpx="http://www.garmin.com/xmlschemas/TrackPointExtension/v1">
<trk><name>20260715201838 Soccer</name><trkseg>${pts.join('')}</trkseg></trk></gpx>`;
}

/** n seconds standing still. */
export const still = (n: number, hr = 120): Step[] => Array.from({ length: n }, () => ({ dEast: 0, dNorth: 0, speedKmh: 0, hr }));

/** Run north (dirNorth=1) or south (-1) for n seconds at a speed. */
export const run = (n: number, kmh: number, dirNorth = 1): Step[] =>
  Array.from({ length: n }, () => ({ dEast: 0, dNorth: (dirNorth * kmh) / 3.6, speedKmh: kmh, hr: 175 }));

/** Jog around a 20 m wide area in the east direction, back and forth. */
export const jog = (n: number, kmh = 5): Step[] =>
  Array.from({ length: n }, (_, i) => ({ dEast: (Math.floor(i / 10) % 2 ? -1 : 1) * (kmh / 3.6), dNorth: (Math.floor(i / 25) % 2 ? -0.4 : 0.4), speedKmh: kmh, hr: 150 }));
