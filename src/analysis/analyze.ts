// Per-match analysis pipeline. Pure function of (track, settings, thresholds).

import { detectDrift, findCandidates } from './detect';
import { haversine, percentile, principalAxisBearing, project } from './geo';
import {
  ACCEL_BINS, OFFICIAL_ZONES, RECOVERY_BINS, emptyOrientation,
  type CoreStats, type GoalEnd, type MatchAnalysis, type MatchSettings, type ParsedTrack, type Sprint, type Third, type Thresholds,
} from './types';

const MAX_GAP_S = 5;
const BURST_GAP_S = 3;

export interface Burst { start: number; end: number; durationS: number; maxSpeed: number }

/** Contiguous runs above the burst threshold that never cross an excluded sample. */
export function detectBursts(t: number[], speed: number[], masked: boolean[], th: Thresholds): Burst[] {
  const out: Burst[] = [];
  let i = 0;
  const n = t.length;
  while (i < n) {
    if (masked[i] || speed[i] <= th.burst) { i++; continue; }
    let j = i;
    while (j + 1 < n && !masked[j + 1] && speed[j + 1] > th.burst && t[j + 1] - t[j] <= BURST_GAP_S) j++;
    const durationS = t[j] - t[i] + 1;
    if (durationS >= th.burstMinSec) {
      let maxSpeed = 0;
      for (let k = i; k <= j; k++) maxSpeed = Math.max(maxSpeed, speed[k]);
      out.push({ start: i, end: j, durationS, maxSpeed });
    }
    i = j + 1;
  }
  return out;
}

/** Δspeed per second in m/s², zero across gaps or excluded samples. */
export function accelerations(t: number[], speed: number[], masked: boolean[]): number[] {
  return t.map((ti, i) => {
    if (i === 0 || masked[i] || masked[i - 1]) return 0;
    const dt = ti - t[i - 1];
    if (dt <= 0 || dt > 2) return 0;
    return (speed[i] - speed[i - 1]) / 3.6 / dt;
  });
}

function countRuns(values: number[], test: (v: number) => boolean, minLen: number): number {
  let count = 0, run = 0;
  for (const v of values) {
    if (test(v)) { run++; if (run === minLen) count++; } else run = 0;
  }
  return count;
}

function binCounts(values: number[], edges: number[]): number[] {
  const out = new Array(edges.length).fill(0);
  for (const v of values) {
    if (v < edges[0]) continue;
    let k = edges.length - 1;
    while (k > 0 && v < edges[k]) k--;
    out[k]++;
  }
  return out;
}

const mean = (a: number[]) => (a.length ? a.reduce((s, v) => s + v, 0) / a.length : 0);

function coreStats(t: number[], speed: number[], seg: number[], masked: boolean[], th: Thresholds): CoreStats {
  let activeSec = 0, dist = 0, wSpeed = 0, maxSpeed = 0;
  for (let i = 1; i < t.length; i++) {
    if (masked[i]) continue;
    const dt = Math.min(t[i] - t[i - 1], MAX_GAP_S);
    if (speed[i] > 0) { activeSec += dt; wSpeed += speed[i] * dt; }
    if (!masked[i - 1]) dist += seg[i];
    maxSpeed = Math.max(maxSpeed, speed[i]);
  }
  const sprints = detectBursts(t, speed, masked, th).filter((b) => b.maxSpeed > th.sprint).length;
  const activeMin = activeSec / 60;
  return {
    activeMin,
    avgSpeed: activeSec ? wSpeed / activeSec : 0,
    maxSpeed,
    mPerMin: activeMin ? dist / activeMin : 0,
    sprints,
    sprintsPerActiveHour: activeMin ? sprints / (activeMin / 60) : 0,
  };
}

export function analyzeMatch(
  track: ParsedTrack, s: MatchSettings, th: Thresholds, hrZoneMaxOverride: number | null = null,
): MatchAnalysis {
  const all = track.points;
  const fullT = all.map((p) => p.t);
  const fullXY = project(all.map((p) => p.lat), all.map((p) => p.lon));
  const drift = detectDrift(fullT, fullXY.x, fullXY.y);

  // Trim the end of the match.
  const trimS = s.trimEndMin != null ? s.trimEndMin * 60 : Infinity;
  let endIdx = all.length - 1;
  while (endIdx > 1 && all[endIdx].t > trimS) endIdx--;
  const pts = all.slice(0, endIdx + 1);
  const t = pts.map((p) => p.t);
  const x = fullXY.x.slice(0, endIdx + 1);
  const y = fullXY.y.slice(0, endIdx + 1);
  const speed = pts.map((p) => p.speedKmh ?? 0);
  const hr = pts.map((p) => p.hr);
  const n = t.length;

  const masked = t.map((ti) => s.exclusions.some((e) => ti >= e.startMin * 60 && ti <= e.endMin * 60));
  const none = new Array<boolean>(n).fill(false);
  const seg = t.map((_, i) => (i === 0 ? 0 : haversine(pts[i - 1].lat, pts[i - 1].lon, pts[i].lat, pts[i].lon)));
  const projSeg = t.map((_, i) => (i === 0 ? 0 : Math.hypot(x[i] - x[i - 1], y[i] - y[i - 1])));
  const dtArr = t.map((ti, i) => (i === 0 ? 0 : Math.min(ti - t[i - 1], MAX_GAP_S)));

  const candidates = findCandidates(t, x, y, speed, n - 1);

  // Pitch frame. The movement axis comes from the track itself; each
  // orientation segment says which end of that axis was the own goal.
  const ax: number[] = [], ay: number[] = [];
  for (let i = 0; i < n; i++) if (!masked[i]) { ax.push(x[i]); ay.push(y[i]); }
  const axisBearing = principalAxisBearing(ax, ay);
  const b = (axisBearing * Math.PI) / 180;
  const dax = Math.sin(b), day = Math.cos(b);
  const cx = mean(ax), cy = mean(ay);
  const ra = t.map((_, i) => (x[i] - cx) * dax + (y[i] - cy) * day);
  const rc = t.map((_, i) => (x[i] - cx) * day - (y[i] - cy) * dax);
  const sra = ra.filter((_, i) => !masked[i]).sort((p, q) => p - q);
  const src = rc.filter((_, i) => !masked[i]).sort((p, q) => p - q);
  const a1 = percentile(sra, 0.01), a99 = percentile(sra, 0.99);
  const c1 = percentile(src, 0.01), c99 = percentile(src, 0.99);
  const clip = (z: number) => Math.max(0, Math.min(1, z));
  const nra = (i: number) => clip((ra[i] - a1) / (a99 - a1 || 1));
  const nrc = (i: number) => clip((rc[i] - c1) / (c99 - c1 || 1));

  const o = s.orientation ?? emptyOrientation();
  const swaps = [...o.swapsMin].sort((p, q) => p - q);
  const segOf = (ti: number) => { let k = 0; while (k < swaps.length && ti >= swaps[k] * 60) k++; return k; };
  const endOf = (k: number): GoalEnd | null => o.ends[k] ?? null;
  // Own goal at end 'a' → forward (toward the opponent) is away from 'a'.
  const flip = t.map((ti) => endOf(segOf(ti)) === 'a');
  const v = t.map((_, i) => (flip[i] ? -ra[i] : ra[i]));
  const nu = (i: number) => (flip[i] ? 1 - nrc(i) : nrc(i));
  const nv = (i: number) => (flip[i] ? 1 - nra(i) : nra(i));
  const bounds = [0, ...swaps, t[n - 1] / 60];
  const segments = bounds.slice(0, -1).map((startMin, k) => {
    const end = endOf(k);
    return { startMin, endMin: bounds[k + 1], end, ownGoalBearing: end === 'b' ? (axisBearing + 180) % 360 : axisBearing };
  });
  const orientationConfirmed = segments.every((sg) => sg.end != null);

  // Hints: where the player stood while marked as goalkeeper, per segment.
  const goalkeeperEnds = segments.map((sg) => {
    let sum = 0, cnt = 0;
    for (const e of s.exclusions) {
      if (e.kind !== 'goalkeeper') continue;
      for (let i = 0; i < n; i++) {
        if (t[i] < e.startMin * 60 || t[i] > e.endMin * 60 || t[i] < sg.startMin * 60 || t[i] >= sg.endMin * 60) continue;
        sum += ra[i]; cnt++;
      }
    }
    return cnt >= 30 ? { end: (sum > 0 ? 'a' : 'b') as GoalEnd, minutes: cnt / 60 } : null;
  });
  const swapMin = suggestSwap(t, ra, masked);

  const latlon: MatchAnalysis['latlon'] = { t: [], lat: [], lon: [] };
  for (let i = 0; i < n; i += 2) if (!masked[i]) { latlon.t.push(t[i]); latlon.lat.push(pts[i].lat); latlon.lon.push(pts[i].lon); }
  const R = 6371000, lat0 = pts[0].lat, lon0 = pts[0].lon, k0 = Math.cos((lat0 * Math.PI) / 180);
  const toLL = (mx: number, my: number): [number, number] => [lat0 + (my / R) * (180 / Math.PI), lon0 + (mx / (R * k0)) * (180 / Math.PI)];
  const axisEnds = { a: toLL(cx + dax * a99, cy + day * a99), b: toLL(cx + dax * a1, cy + day * a1) };
  // Corner from (along, across) in the axis frame back to local metres.
  const corner = (al: number, ac: number) => toLL(cx + dax * al + day * ac, cy + day * al - dax * ac);
  const pitchCorners = [corner(a99, c1), corner(a99, c99), corner(a1, c99), corner(a1, c1)];

  // Speed, distance, zones.
  let activeSec = 0, wSpeed = 0, maxSpeed = 0, distanceM = 0, activeDistanceM = 0, hsrM = 0, sprintM = 0;
  const zoneSec = { standing: 0, walking: 0, jogging: 0, running: 0, sprint: 0 };
  const officialZoneSec = new Array(OFFICIAL_ZONES.length).fill(0);
  const activeSpeeds: number[] = [];
  for (let i = 1; i < n; i++) {
    distanceM += seg[i];
    if (masked[i]) continue;
    const dt = dtArr[i];
    const sp = speed[i];
    if (!masked[i - 1]) {
      activeDistanceM += seg[i];
      if (sp >= th.burst) hsrM += seg[i];
      if (sp >= th.sprint) sprintM += seg[i];
    }
    if (sp > 0) { activeSec += dt; wSpeed += sp * dt; activeSpeeds.push(sp); }
    maxSpeed = Math.max(maxSpeed, sp);
    if (sp < th.standing) zoneSec.standing += dt;
    else if (sp < th.walking) zoneSec.walking += dt;
    else if (sp < th.burst) zoneSec.jogging += dt;
    else if (sp < th.sprint) zoneSec.running += dt;
    else zoneSec.sprint += dt;
    let z = OFFICIAL_ZONES.length - 1;
    while (z > 0 && sp < OFFICIAL_ZONES[z]) z--;
    officialZoneSec[z] += dt;
  }
  const activeMin = activeSec / 60;
  const durationMin = t[n - 1] / 60;

  // Accelerations.
  const acc = accelerations(t, speed, masked);
  const accelCount = countRuns(acc, (a) => a > th.accelEvent, th.accelMinSec);
  const decelCount = countRuns(acc, (a) => a < -th.accelEvent, th.accelMinSec);
  const maxAccel = Math.max(0, ...acc);
  const maxDecel = Math.abs(Math.min(0, ...acc));
  const accelHist = binCounts(acc.filter((a) => a > 0), ACCEL_BINS);

  // Bursts and sprints.
  const bursts = detectBursts(t, speed, masked, th);
  const inSprint = new Array<boolean>(n).fill(false);
  const sprints: Sprint[] = [];
  let prevEnd: number | null = null;
  for (const b of bursts) {
    if (b.maxSpeed <= th.sprint) continue;
    let distance = 0, peak = 0, hrSum = 0, hrN = 0;
    for (let k = b.start; k <= b.end; k++) {
      inSprint[k] = true;
      if (k > b.start) distance += projSeg[k];
      peak = Math.max(peak, acc[k]);
      if (hr[k] != null) { hrSum += hr[k] as number; hrN++; }
    }
    const alongM = v[b.end] - v[b.start];
    sprints.push({
      matchId: track.id,
      index: sprints.length + 1,
      startMin: t[b.start] / 60,
      durationS: b.durationS,
      distanceM: distance,
      maxSpeed: b.maxSpeed,
      peakAccel: peak,
      avgHr: hrN ? hrSum / hrN : null,
      start: { x: x[b.start], y: y[b.start] },
      end: { x: x[b.end], y: y[b.end] },
      startN: { u: nu(b.start), v: nv(b.start) },
      endN: { u: nu(b.end), v: nv(b.end) },
      alongM,
      direction: alongM >= 0 ? 'attack' : 'defense',
      recoveryS: prevEnd == null ? null : t[b.start] - prevEnd,
    });
    prevEnd = t[b.end];
  }

  // Heart rate.
  const hrVals: number[] = [];
  for (let i = 0; i < n; i++) if (!masked[i] && hr[i] != null) hrVals.push(hr[i] as number);
  const hrMax = hrVals.length ? Math.max(...hrVals) : null;
  const hrZoneMax = hrZoneMaxOverride ?? hrMax;
  const hrZoneSec = [0, 0, 0, 0, 0];
  if (hrZoneMax) {
    for (let i = 1; i < n; i++) {
      if (masked[i] || hr[i] == null) continue;
      const pct = (hr[i] as number) / hrZoneMax;
      const z = pct < 0.6 ? 0 : pct < 0.7 ? 1 : pct < 0.8 ? 2 : pct < 0.9 ? 3 : 4;
      hrZoneSec[z] += dtArr[i];
    }
  }

  // Time per exclusion kind, clipped to the trimmed match.
  const excludedMin = { goalkeeper: 0, rest: 0, injury: 0 };
  for (const e of s.exclusions) {
    const len = Math.max(0, Math.min(e.endMin, durationMin) - Math.max(e.startMin, 0));
    excludedMin[e.kind] += len;
  }
  const fieldMin = Math.max(0, durationMin - excludedMin.goalkeeper - excludedMin.rest - excludedMin.injury);

  // Fatigue thirds over cumulative active time.
  const cum = new Array<number>(n).fill(0);
  for (let i = 1; i < n; i++) cum[i] = cum[i - 1] + (!masked[i] && speed[i] > 0 ? dtArr[i] : 0);
  const thirdOf = (i: number) => Math.min(2, Math.floor((cum[i] / (activeSec || 1)) * 3));
  const thirds: Third[] = [0, 1, 2].map((k) => {
    let sec = 0, ws = 0, hs = 0, hn = 0;
    for (let i = 1; i < n; i++) {
      if (masked[i] || speed[i] <= 0 || thirdOf(i) !== k) continue;
      sec += dtArr[i]; ws += speed[i] * dtArr[i];
      if (hr[i] != null) { hs += hr[i] as number; hn++; }
    }
    const sp = sprints.filter((sp) => thirdOf(t.findIndex((ti) => ti >= sp.startMin * 60)) === k);
    const recs = sp.map((x) => x.recoveryS).filter((r): r is number => r != null);
    return {
      activeMin: sec / 60,
      sprints: sp.length,
      sprintsPerHour: sec ? sp.length / (sec / 3600) : 0,
      meanSpeed: sec ? ws / sec : 0,
      meanPeakAccel: sp.length ? mean(sp.map((x) => x.peakAccel)) : null,
      meanHr: hn ? hs / hn : null,
      meanRecoveryS: recs.length ? mean(recs) : null,
    };
  });

  // 5-minute speed curve.
  const speedCurve: MatchAnalysis['speedCurve'] = [];
  for (let b = 0; b * 5 < durationMin; b++) {
    let sec = 0, ws = 0, d = 0;
    for (let i = 1; i < n; i++) {
      if (masked[i] || t[i] < b * 300 || t[i] >= (b + 1) * 300) continue;
      if (speed[i] > 0) { sec += dtArr[i]; ws += speed[i] * dtArr[i]; }
      if (!masked[i - 1]) d += seg[i];
    }
    speedCurve.push({ min: b * 5, speed: sec ? ws / sec : 0, mPerMin: sec ? d / (sec / 60) : 0 });
  }

  const recoveries = sprints.map((sp) => sp.recoveryS).filter((r): r is number => r != null);

  const samples: MatchAnalysis['samples'] = { t: [], u: [], v: [], dt: [], inSprint: [] };
  const axisSamples: MatchAnalysis['axisSamples'] = { t: [], rc: [], ra: [] };
  for (let i = 0; i < n; i++) {
    if (masked[i]) continue;
    axisSamples.t.push(t[i]); axisSamples.rc.push(nrc(i)); axisSamples.ra.push(nra(i));
    samples.t.push(t[i]); samples.u.push(nu(i)); samples.v.push(nv(i));
    samples.dt.push(dtArr[i] || 1); samples.inSprint.push(inSprint[i]);
  }

  const start = new Date(track.startTime);
  const date = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}-${String(start.getDate()).padStart(2, '0')}`;
  const activeHours = activeMin / 60;

  return {
    id: track.id,
    label: s.label || date,
    date,
    weekday: start.getDay(),
    role: s.role,
    opponentAge: s.opponentAge,
    orientationConfirmed,
    speedSource: track.speedSource,
    rawDurationMin: all[all.length - 1].t / 60,
    durationMin,
    activeMin,
    distanceM,
    activeDistanceM,
    mPerMin: activeMin ? activeDistanceM / activeMin : 0,
    avgSpeed: activeSec ? wSpeed / activeSec : 0,
    medianSpeed: activeSpeeds.length ? percentile(activeSpeeds.sort((a, b) => a - b), 0.5) : 0,
    maxSpeed,
    zoneSec,
    officialZoneSec,
    hsrM,
    sprintM,
    bursts: bursts.length,
    sprints,
    sprintsPerActiveHour: activeHours ? sprints.length / activeHours : 0,
    sprintsPerHour: durationMin ? sprints.length / (durationMin / 60) : 0,
    accelCount,
    decelCount,
    maxAccel,
    maxDecel,
    accelHist,
    hrAvg: hrVals.length ? mean(hrVals) : null,
    hrMax,
    hrZoneSec,
    hrZoneMax,
    excludedMin,
    fieldMin,
    thirds,
    speedCurve,
    rsaCount: sprints.filter((sp) => sp.recoveryS != null && sp.recoveryS < th.rsaSec).length,
    recoveryHist: binCounts(recoveries, RECOVERY_BINS),
    drift,
    candidates,
    frame: { axisBearing, segments },
    hints: { goalkeeperEnds, swapMin },
    axisSamples,
    latlon,
    axisEnds,
    pitchCorners,
    withoutExclusions: coreStats(t, speed, seg, none, th),
    samples,
    timeline: { min: t.map((ti) => ti / 60), speed, hr, excluded: masked },
  };
}

/**
 * Likely side swap: the minute where mean position along the axis in the 8 min
 * before and after has opposite signs and differs most (in pooled SDs).
 */
export function suggestSwap(t: number[], along: number[], masked: boolean[], winMin = 8): number | null {
  const dur = t[t.length - 1] / 60;
  let best: { m: number; score: number } | null = null;
  for (let m = winMin; m <= dur - winMin; m += 0.5) {
    const w = [[m - winMin, m], [m, m + winMin]].map(([a, b]) => {
      let s = 0, s2 = 0, c = 0;
      for (let i = 0; i < t.length; i++) {
        if (masked[i] || t[i] < a * 60 || t[i] >= b * 60) continue;
        s += along[i]; s2 += along[i] ** 2; c++;
      }
      const mu = c ? s / c : 0;
      return { mu, v: c ? s2 / c - mu * mu : 0, c };
    });
    if (w[0].c < 180 || w[1].c < 180 || w[0].mu * w[1].mu >= 0) continue;
    const score = Math.abs(w[0].mu - w[1].mu) / Math.sqrt((w[0].v + w[1].v) / 2 || 1);
    if (!best || score > best.score) best = { m, score };
  }
  return best && best.score > 1.2 ? best.m : null;
}

/** Sprint start-minute histogram; everything past `foldAt` lands in the last bin. */
export function sprintTimingHistogram(sprints: Sprint[], binMin = 5, foldAt = 60): number[] {
  const bins = new Array(Math.ceil(foldAt / binMin)).fill(0);
  for (const sp of sprints) bins[Math.min(bins.length - 1, Math.floor(sp.startMin / binMin))]++;
  return bins;
}

/** 3x3 grid as percent of total. rows: 0 = own-goal side … 2 = opponent side; cols left → right. */
export function grid3(points: { u: number; v: number; w?: number }[]): { pct: number[][]; count: number[][]; total: number } {
  const count = [0, 1, 2].map(() => [0, 0, 0]);
  let total = 0;
  for (const p of points) {
    const r = Math.min(2, Math.floor(p.v * 3));
    const c = Math.min(2, Math.floor(p.u * 3));
    const w = p.w ?? 1;
    count[r][c] += w;
    total += w;
  }
  return { pct: count.map((row) => row.map((c) => (total ? (100 * c) / total : 0))), count, total };
}
