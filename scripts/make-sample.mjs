// Generates a synthetic Zepp-style futsal match GPX for demos and smoke tests.
// Usage: node scripts/make-sample.mjs <out.gpx> [seed]
import { writeFileSync } from 'node:fs';

const out = process.argv[2] ?? 'work/sample.gpx';
let seed = Number(process.argv[3] ?? 7);
const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);

const LAT0 = 30.0444, LON0 = 31.2357, M = 111194.93;
const W = 20, L = 40; // pitch metres, long axis north-south, own goal south
let x = 10, y = 12, vx = 0, vy = 0, hr = 120;
const pts = [];
const start = Date.UTC(2026, 6, 22, 19, 30, 0);
const total = 55 * 60;
let sprintLeft = 0, sprintDir = 1;

for (let t = 0; t < total; t++) {
  const gk = t >= 20 * 60 && t < 23 * 60; // goalkeeper spell
  const drift = t >= 52 * 60; // watch left recording after the match
  let speed;
  if (drift) {
    x += 1.2; y += 0.3; speed = 4.3;
  } else if (gk) {
    x += (2 - x) * 0.05 + (rnd() - 0.5) * 0.3; y += (10 - y) * 0.05 + (rnd() - 0.5) * 0.3;
    x = Math.max(8, Math.min(12, x + 0)); y = Math.max(0.5, Math.min(3, y));
    speed = rnd() * 1.2;
  } else {
    if (sprintLeft <= 0 && rnd() < 0.012) { sprintLeft = 3 + Math.floor(rnd() * 4); sprintDir = y < L / 2 ? (rnd() < 0.7 ? 1 : -1) : (rnd() < 0.6 ? -1 : 1); }
    if (sprintLeft > 0) {
      const v = (9 + rnd() * 5) / 3.6;
      vx = (rnd() - 0.5) * 1; vy = sprintDir * v; sprintLeft--;
    } else {
      vx += (rnd() - 0.5) * 0.8 + (10 - x) * 0.01; vy += (rnd() - 0.5) * 0.8 + (L * 0.45 - y) * 0.006;
      const s = Math.hypot(vx, vy), max = 6.5 / 3.6;
      if (s > max) { vx *= max / s; vy *= max / s; }
    }
    x = Math.max(0.5, Math.min(W - 0.5, x + vx)); y = Math.max(0.5, Math.min(L - 0.5, y + vy));
    speed = Math.hypot(vx, vy) * 3.6;
  }
  hr += ((gk ? 125 : 140 + speed * 4.5) - hr) * 0.05 + (rnd() - 0.5) * 2;
  const lat = LAT0 + (y + (rnd() - 0.5) * 0.6) / M;
  const lon = LON0 + (x + (rnd() - 0.5) * 0.6) / (M * Math.cos((LAT0 * Math.PI) / 180));
  pts.push(`<trkpt lat="${lat.toFixed(7)}" lon="${lon.toFixed(7)}"><time>${new Date(start + t * 1000).toISOString().replace('.000', '')}</time><extensions><gpxtpx:TrackPointExtension><gpxtpx:hr>${Math.round(hr)}</gpxtpx:hr><gpxtpx:speed>${(speed / 3.6).toFixed(2)}</gpxtpx:speed></gpxtpx:TrackPointExtension></extensions></trkpt>`);
}

writeFileSync(out, `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="sample" xmlns="http://www.topografix.com/GPX/1/1" xmlns:gpxtpx="http://www.garmin.com/xmlschemas/TrackPointExtension/v1">
<trk><name>20260722193000 Soccer</name><trkseg>
${pts.join('\n')}
</trkseg></trk></gpx>`);
console.log(`wrote ${out} (${pts.length} points)`);
