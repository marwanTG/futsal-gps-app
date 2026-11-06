import { describe, expect, it } from 'vitest';
import { analyzeMatch, detectBursts, grid3, sprintTimingHistogram, suggestSwap } from './analyze';
import { angleDiff, haversine, principalAxisBearing, snapBearing } from './geo';
import { parseGpx } from './parse';
import { DEFAULT_THRESHOLDS, type GoalEnd, type MatchSettings, type ParsedTrack, type Sprint } from './types';
import { jog, makeGpx, run, still } from '../test/synthetic';

const settings = (over: Partial<MatchSettings> = {}): MatchSettings => ({
  label: '', venueName: '', orientation: { swapsMin: [], ends: [null] }, role: 'field', opponentAge: null, trimEndMin: null, exclusions: [], dismissedCandidates: [], ...over,
});

describe('geo', () => {
  it('haversine: 1 degree of latitude is about 111 km', () => {
    expect(haversine(30, 31, 31, 31)).toBeCloseTo(111195, -2);
  });
  it('principal axis of a north-south cloud is ~0°, east-west ~90°', () => {
    const ns = Array.from({ length: 50 }, (_, i) => i);
    expect(principalAxisBearing(ns.map(() => 0), ns)).toBeCloseTo(0, 5);
    expect(principalAxisBearing(ns, ns.map(() => 0))).toBeCloseTo(90, 5);
  });
  it('snapBearing picks the axis end closest to the user bearing', () => {
    expect(snapBearing(170, 5)).toBe(185);
    expect(snapBearing(20, 5)).toBe(5);
  });
});

describe('parse', () => {
  it('reads hr and converts device speed m/s → km/h', () => {
    const tr = parseGpx(makeGpx([...still(3), ...run(3, 9)]), 'Zepp20260715201838.gpx');
    expect(tr.points).toHaveLength(6);
    expect(tr.speedSource).toBe('device');
    expect(tr.points[4].speedKmh).toBeCloseTo(9, 1);
    expect(tr.points[4].hr).toBe(175);
    expect(tr.id).toBe(String(Date.UTC(2026, 6, 15, 20, 18, 38)));
  });
  it('computes speed from positions when the watch did not write it', () => {
    const tr = parseGpx(makeGpx([...still(3), ...run(10, 9)], undefined, false), 'other.gpx');
    expect(tr.speedSource).toBe('computed');
    expect(tr.points[8].speedKmh).toBeCloseTo(9, 0);
  });
});

describe('bursts and sprints', () => {
  const t = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
  it('needs ≥2 s above the burst threshold and a peak above the sprint threshold', () => {
    const speed = [0, 7, 9, 9, 7, 0, 7, 0, 7, 7];
    const bursts = detectBursts(t, speed, t.map(() => false), DEFAULT_THRESHOLDS);
    expect(bursts.map((b) => [b.start, b.end])).toEqual([[1, 4], [8, 9]]);
    expect(bursts.filter((b) => b.maxSpeed > 8)).toHaveLength(1);
  });
  it('never spans an excluded sample', () => {
    const speed = [0, 9, 9, 9, 9, 9, 9, 0, 0, 0];
    const masked = t.map((ti) => ti === 3);
    const bursts = detectBursts(t, speed, masked, DEFAULT_THRESHOLDS);
    expect(bursts.map((b) => [b.start, b.end])).toEqual([[1, 2], [4, 6]]);
  });
});

describe('analyzeMatch', () => {
  const track = parseGpx(makeGpx([...jog(120), ...run(4, 10, 1), ...jog(120), ...run(4, 10, -1), ...jog(120)]), 'm.gpx');
  const dirs = (sp: Sprint[]) => sp.map((s) => s.direction);

  /** Which axis end lies toward a compass bearing for this track. */
  const endToward = (tr: ParsedTrack, compass: number): GoalEnd =>
    angleDiff(analyzeMatch(tr, settings(), DEFAULT_THRESHOLDS).frame.axisBearing, compass) < 90 ? 'a' : 'b';
  const south = () => endToward(track, 180);
  const north = () => endToward(track, 0);

  it('classifies attack/defense by direction of travel, not start position', () => {
    // Own goal to the south → running north is attack.
    const a = analyzeMatch(track, settings({ orientation: { swapsMin: [], ends: [south()] } }), DEFAULT_THRESHOLDS);
    expect(dirs(a.sprints)).toEqual(['attack', 'defense']);
    expect(a.orientationConfirmed).toBe(true);
    // Own goal to the north mirrors it.
    const b = analyzeMatch(track, settings({ orientation: { swapsMin: [], ends: [north()] } }), DEFAULT_THRESHOLDS);
    expect(dirs(b.sprints)).toEqual(['defense', 'attack']);
  });

  it('each segment after a side swap has its own goal end', () => {
    const a = analyzeMatch(track, settings({ orientation: { swapsMin: [3], ends: [south(), north()] } }), DEFAULT_THRESHOLDS);
    expect(dirs(a.sprints)).toEqual(['attack', 'attack']);
    expect(a.frame.segments).toHaveLength(2);
    const partial = analyzeMatch(track, settings({ orientation: { swapsMin: [3], ends: [south(), null] } }), DEFAULT_THRESHOLDS);
    expect(partial.orientationConfirmed).toBe(false);
  });

  it('suggests the goal end from goalkeeper spells and detects a side swap', () => {
    // Keeper near the south end for 2 min, play, then keeper near the north end after swapping.
    const keeperSouth = Array.from({ length: 120 }, () => ({ dEast: 0, dNorth: 0, speedKmh: 0.3, hr: 120 }));
    const steps = [...run(10, 7, -1), ...keeperSouth, ...run(10, 7, 1), ...jog(400), ...run(20, 7, 1), ...keeperSouth, ...run(20, 7, -1), ...jog(400)];
    const tr = parseGpx(makeGpx(steps), 'gk2.gpx');
    const base = analyzeMatch(tr, settings(), DEFAULT_THRESHOLDS);
    const gkAt = (startS: number) => ({ id: `g${startS}`, kind: 'goalkeeper' as const, startMin: startS / 60, endMin: (startS + 120) / 60 });
    const swapMin = (10 + 120 + 10 + 400) / 60;
    const a = analyzeMatch(tr, settings({ exclusions: [gkAt(10), gkAt(560)], orientation: { swapsMin: [swapMin], ends: [null, null] } }), DEFAULT_THRESHOLDS);
    const southEnd = angleDiff(base.frame.axisBearing, 180) < 90 ? 'a' : 'b';
    expect(a.hints.goalkeeperEnds[0]?.end).toBe(southEnd);
    expect(a.hints.goalkeeperEnds[1]?.end).not.toBe(southEnd);
  });

  it('exclusions remove sprints and active time', () => {
    const base = analyzeMatch(track, settings(), DEFAULT_THRESHOLDS);
    const ex = analyzeMatch(track, settings({ exclusions: [{ id: 'e', kind: 'goalkeeper', startMin: 1.9, endMin: 2.2 }] }), DEFAULT_THRESHOLDS);
    expect(base.sprints).toHaveLength(2);
    expect(ex.sprints).toHaveLength(1);
    expect(ex.activeMin).toBeLessThan(base.activeMin);
    expect(ex.excludedMin.goalkeeper).toBeCloseTo(0.3, 5);
    expect(ex.withoutExclusions.sprints).toBe(2);
  });

  it('sprint record has distance, peak acceleration and recovery', () => {
    const a = analyzeMatch(track, settings(), DEFAULT_THRESHOLDS);
    const [s1, s2] = a.sprints;
    expect(s1.durationS).toBe(4);
    expect(s1.distanceM).toBeCloseTo((3 * 10) / 3.6, 0);
    expect(s1.maxSpeed).toBeCloseTo(10, 1);
    expect(s1.peakAccel).toBeCloseTo((10 - 5) / 3.6, 1);
    expect(s2.recoveryS).toBeCloseTo(121, 0);
  });

  it('suggests low-movement candidates without labelling them', () => {
    const tr = parseGpx(makeGpx([...jog(200), ...still(150), ...jog(200)]), 'gk.gpx');
    const a = analyzeMatch(tr, settings(), DEFAULT_THRESHOLDS);
    expect(a.candidates).toHaveLength(1);
    expect(a.candidates[0].startMin).toBeGreaterThan(3);
    expect(a.candidates[0].endMin).toBeLessThan(6);
  });

  it('flags a drifting tail and the trim removes it', () => {
    const drift = Array.from({ length: 200 }, () => ({ dEast: 2, dNorth: 0, speedKmh: 1, hr: 100 }));
    const tr = parseGpx(makeGpx([...jog(600), ...drift]), 'drift.gpx');
    const a = analyzeMatch(tr, settings(), DEFAULT_THRESHOLDS);
    expect(a.drift.suggestedTrimMin).not.toBeNull();
    expect(a.drift.suggestedTrimMin!).toBeGreaterThan(9.5);
    const trimmed = analyzeMatch(tr, settings({ trimEndMin: a.drift.suggestedTrimMin }), DEFAULT_THRESHOLDS);
    expect(trimmed.distanceM).toBeLessThan(a.distanceM - 300);
  });
});

describe('suggestSwap', () => {
  it('finds the minute where mean position flips sides', () => {
    const t = Array.from({ length: 50 * 60 }, (_, i) => i);
    const along = t.map((ti) => (ti < 25 * 60 ? 6 : -6) + Math.sin(ti / 7) * 4);
    expect(suggestSwap(t, along, t.map(() => false))).toBeCloseTo(25, 0);
    expect(suggestSwap(t, t.map((ti) => Math.sin(ti / 7) * 4 + 3), t.map(() => false))).toBeNull();
  });
});

describe('aggregations', () => {
  it('folds sprints after minute 60 into the last 5-minute bin', () => {
    const sp = [2, 57, 61, 80].map((m) => ({ startMin: m }) as Sprint);
    const h = sprintTimingHistogram(sp, 5, 60);
    expect(h).toHaveLength(12);
    expect(h[0]).toBe(1);
    expect(h[11]).toBe(3);
  });
  it('3x3 grid returns percent of its own total', () => {
    const g = grid3([{ u: 0.1, v: 0.1 }, { u: 0.1, v: 0.1 }, { u: 0.9, v: 0.9 }, { u: 1, v: 1 }]);
    expect(g.pct[0][0]).toBe(50);
    expect(g.pct[2][2]).toBe(50);
    expect(g.total).toBe(4);
  });
});
