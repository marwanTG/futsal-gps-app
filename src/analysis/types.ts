// Shared types for the analysis module. Everything here is pure data so it can
// be persisted, exported to JSON and tested without a DOM.

export interface TrackPoint {
  /** Seconds since the first point. */
  t: number;
  lat: number;
  lon: number;
  hr: number | null;
  /** Device speed in km/h (null when the file has no speed field). */
  speedKmh: number | null;
}

export interface ParsedTrack {
  /** Stable id = start time in ms (used to de-duplicate uploads). */
  id: string;
  fileName: string;
  name: string;
  startTime: number;
  points: TrackPoint[];
  /** 'device' when every point carried the Zepp speed field. */
  speedSource: 'device' | 'computed';
}

export type ExclusionKind = 'goalkeeper' | 'rest' | 'injury';

export interface Exclusion {
  id: string;
  kind: ExclusionKind;
  startMin: number;
  endMin: number;
}

export type Role = 'field' | 'goalkeeper' | 'libero';

export type GoalEnd = 'a' | 'b';

export interface Orientation {
  /** Minutes at which teams swapped ends, ascending. */
  swapsMin: number[];
  /** One entry per segment (swapsMin.length + 1). */
  ends: (GoalEnd | null)[];
}

export const emptyOrientation = (): Orientation => ({ swapsMin: [], ends: [null] });

export interface MatchSettings {
  label: string;
  venueName: string;
  /**
   * Pitch orientation as segments split at side-swap minutes. Each segment says
   * which end of the movement axis was the player's own goal: 'a' = the end in
   * the direction of the axis bearing, 'b' = the opposite end, null = not set.
   */
  orientation: Orientation;
  role: Role;
  opponentAge: number | null;
  /** End-of-match trim in minutes from start (null = keep everything). */
  trimEndMin: number | null;
  exclusions: Exclusion[];
  /** Candidate ids the user marked as normal play. */
  dismissedCandidates: string[];
}

export interface Thresholds {
  standing: number;
  walking: number;
  /** Burst threshold (jogging/running boundary), km/h. */
  burst: number;
  sprint: number;
  burstMinSec: number;
  rsaSec: number;
  accelEvent: number;
  accelMinSec: number;
}

export const DEFAULT_THRESHOLDS: Thresholds = {
  standing: 1,
  walking: 4,
  burst: 6,
  sprint: 8,
  burstMinSec: 2,
  rsaSec: 60,
  accelEvent: 0.5,
  accelMinSec: 2,
};

export interface PlayerProfile {
  age: number | null;
  heightCm: number | null;
  weightKg: number | null;
  hrMaxOverride: number | null;
  healthNotes: string;
}

export interface Sprint {
  matchId: string;
  index: number;
  startMin: number;
  durationS: number;
  distanceM: number;
  maxSpeed: number;
  peakAccel: number;
  avgHr: number | null;
  /** Local metres (east/north). */
  start: { x: number; y: number };
  end: { x: number; y: number };
  /** Normalised pitch frame 0..1 (u across, v own goal → opponent goal). */
  startN: { u: number; v: number };
  endN: { u: number; v: number };
  /** Metres moved along the goal axis (positive = toward the opponent goal). */
  alongM: number;
  direction: 'attack' | 'defense';
  recoveryS: number | null;
}

export interface Candidate {
  id: string;
  startMin: number;
  endMin: number;
  radiusM: number;
  meanSpeed: number;
}

export interface Third {
  activeMin: number;
  sprints: number;
  sprintsPerHour: number;
  meanSpeed: number;
  meanPeakAccel: number | null;
  meanHr: number | null;
  meanRecoveryS: number | null;
}

export interface CoreStats {
  activeMin: number;
  avgSpeed: number;
  maxSpeed: number;
  mPerMin: number;
  sprints: number;
  sprintsPerActiveHour: number;
}

export interface MatchAnalysis {
  id: string;
  label: string;
  date: string;
  weekday: number;
  role: Role;
  opponentAge: number | null;
  orientationConfirmed: boolean;
  speedSource: 'device' | 'computed';
  rawDurationMin: number;
  durationMin: number;
  activeMin: number;
  distanceM: number;
  activeDistanceM: number;
  mPerMin: number;
  avgSpeed: number;
  medianSpeed: number;
  maxSpeed: number;
  zoneSec: { standing: number; walking: number; jogging: number; running: number; sprint: number };
  officialZoneSec: number[];
  hsrM: number;
  sprintM: number;
  bursts: number;
  sprints: Sprint[];
  sprintsPerActiveHour: number;
  sprintsPerHour: number;
  accelCount: number;
  decelCount: number;
  maxAccel: number;
  maxDecel: number;
  accelHist: number[];
  hrAvg: number | null;
  hrMax: number | null;
  hrZoneSec: number[];
  hrZoneMax: number | null;
  excludedMin: { goalkeeper: number; rest: number; injury: number };
  fieldMin: number;
  thirds: Third[];
  speedCurve: { min: number; speed: number; mPerMin: number }[];
  rsaCount: number;
  recoveryHist: number[];
  drift: { suggestedTrimMin: number | null; maxDistM: number };
  candidates: Candidate[];
  frame: {
    axisBearing: number;
    segments: { startMin: number; endMin: number; end: GoalEnd | null; ownGoalBearing: number }[];
  };
  /** Suggestions for the orientation step. */
  hints: {
    /** Per segment: the end the player stood at while marked as goalkeeper. */
    goalkeeperEnds: ({ end: GoalEnd; minutes: number } | null)[];
    /** Likely side-swap minute from a flip in mean position, or null. */
    swapMin: number | null;
  };
  /** Active samples in the raw axis frame (0..1, ra = 1 toward end 'a'), for the orientation picker. */
  axisSamples: { t: number[]; rc: number[]; ra: number[] };
  /** Track points (lat/lon) for the satellite view, thinned. */
  latlon: { t: number[]; lat: number[]; lon: number[] };
  /** Lat/lon of the two axis ends (for the satellite picker). */
  axisEnds: { a: [number, number]; b: [number, number] };
  /** Estimated pitch outline (lat/lon corners) from the 1st-99th percentile box. */
  pitchCorners: [number, number][];
  /** Without exclusions (only trim applied) for the "impact of exclusions" view. */
  withoutExclusions: CoreStats;
  /** Per-sample arrays for maps (active samples only). */
  samples: { t: number[]; u: number[]; v: number[]; dt: number[]; inSprint: boolean[] };
  /** Full trimmed timeline for charts (every sample). */
  timeline: { min: number[]; speed: number[]; hr: (number | null)[]; excluded: boolean[] };
}

export const RECOVERY_BINS = [0, 30, 60, 120, 180, 300];
export const ACCEL_BINS = [0.5, 0.75, 1, 1.5, 2, 2.5, 3];
export const OFFICIAL_ZONES = [0, 1, 6, 10, 15, 18];
