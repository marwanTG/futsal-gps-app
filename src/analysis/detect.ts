// Detection of low-movement candidate windows (goalkeeper OR bench: the user
// decides) and of GPS drift at the end of a recording.

import { percentile } from './geo';
import type { Candidate } from './types';

export interface CandidateOptions {
  halfWindowS: number;
  maxRadiusM: number;
  maxMeanSpeed: number;
  minDurationS: number;
}

export const CANDIDATE_DEFAULTS: CandidateOptions = {
  halfWindowS: 30,
  maxRadiusM: 6,
  maxMeanSpeed: 2,
  minDurationS: 90,
};

/** Windows where a 60 s neighbourhood stays inside a small radius at low speed. */
export function findCandidates(
  t: number[], x: number[], y: number[], speed: number[], endIndex: number,
  opts: CandidateOptions = CANDIDATE_DEFAULTS,
): Candidate[] {
  const n = Math.min(endIndex + 1, t.length);
  const ok = new Array<boolean>(n).fill(false);
  let lo = 0, hi = 0;
  for (let i = 0; i < n; i++) {
    while (t[lo] < t[i] - opts.halfWindowS) lo++;
    while (hi + 1 < n && t[hi + 1] <= t[i] + opts.halfWindowS) hi++;
    const count = hi - lo + 1;
    if (count < 10) continue;
    let mx = 0, my = 0, ms = 0;
    for (let j = lo; j <= hi; j++) { mx += x[j]; my += y[j]; ms += speed[j]; }
    mx /= count; my /= count; ms /= count;
    if (ms >= opts.maxMeanSpeed) continue;
    let r = 0;
    for (let j = lo; j <= hi; j++) r = Math.max(r, Math.hypot(x[j] - mx, y[j] - my));
    ok[i] = r < opts.maxRadiusM;
  }

  const out: Candidate[] = [];
  let i = 0;
  while (i < n) {
    if (!ok[i]) { i++; continue; }
    let j = i;
    while (j + 1 < n && ok[j + 1] && t[j + 1] - t[j] <= 3) j++;
    // The window test marks centres; extend by the half window on each side.
    const start = Math.max(0, t[i] - opts.halfWindowS);
    const end = Math.min(t[n - 1], t[j] + opts.halfWindowS);
    if (end - start >= opts.minDurationS) {
      let r = 0, mx = 0, my = 0, ms = 0, c = 0;
      for (let k = i; k <= j; k++) { mx += x[k]; my += y[k]; ms += speed[k]; c++; }
      mx /= c; my /= c;
      for (let k = i; k <= j; k++) r = Math.max(r, Math.hypot(x[k] - mx, y[k] - my));
      out.push({ id: `c${Math.round(start)}`, startMin: start / 60, endMin: end / 60, radiusM: r, meanSpeed: ms / c });
    }
    i = j + 1;
  }
  return out;
}

/**
 * Flags an implausible tail: the last stretch of the recording sitting far from
 * where the player spent the match. Returns the suggested trim minute or null.
 */
export function detectDrift(t: number[], x: number[], y: number[]): { suggestedTrimMin: number | null; maxDistM: number } {
  const n = t.length;
  if (n < 120) return { suggestedTrimMin: null, maxDistM: 0 };
  const core = Math.floor(n * 0.7);
  const cx = percentile(x.slice(0, core).sort((a, b) => a - b), 0.5);
  const cy = percentile(y.slice(0, core).sort((a, b) => a - b), 0.5);
  const d = x.map((xi, i) => Math.hypot(xi - cx, y[i] - cy));
  const p95 = percentile(d.slice(0, core).sort((a, b) => a - b), 0.95);
  const limit = Math.max(2 * p95, 50);
  const maxDistM = Math.max(...d);

  // Smallest k whose suffix is mostly outliers and lasts at least 30 s.
  let outliers = 0, best: number | null = null;
  for (let k = n - 1; k >= 0; k--) {
    if (d[k] > limit) outliers++;
    const len = n - k;
    if (outliers / len >= 0.8 && t[n - 1] - t[k] >= 30) best = k;
    if (len > 60 && outliers / len < 0.5) break;
  }
  if (best == null) return { suggestedTrimMin: null, maxDistM };
  while (best < n - 1 && d[best] <= limit) best++;
  return { suggestedTrimMin: t[best] / 60, maxDistM };
}
