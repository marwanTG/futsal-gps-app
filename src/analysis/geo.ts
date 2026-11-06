// Geometry helpers: haversine distance, local metre projection, pitch frame.

const R = 6371000;
const toRad = (d: number) => (d * Math.PI) / 180;
const toDeg = (r: number) => (r * 180) / Math.PI;

export function haversine(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(a)));
}

/** Equirectangular projection around the first point: x east +, y north +, metres. */
export function project(lat: number[], lon: number[]): { x: number[]; y: number[] } {
  const lat0 = lat[0] ?? 0;
  const lon0 = lon[0] ?? 0;
  const k = Math.cos(toRad(lat0));
  return {
    x: lon.map((l) => toRad(l - lon0) * R * k),
    y: lat.map((l) => toRad(l - lat0) * R),
  };
}

/** Bearing (deg clockwise from north) of the principal axis of a point cloud, in [0, 180). */
export function principalAxisBearing(x: number[], y: number[]): number {
  const n = x.length;
  if (n < 3) return 0;
  let mx = 0, my = 0;
  for (let i = 0; i < n; i++) { mx += x[i]; my += y[i]; }
  mx /= n; my /= n;
  let sxx = 0, syy = 0, sxy = 0;
  for (let i = 0; i < n; i++) {
    const dx = x[i] - mx, dy = y[i] - my;
    sxx += dx * dx; syy += dy * dy; sxy += dx * dy;
  }
  // Angle of the major axis measured from the x (east) axis.
  const theta = 0.5 * Math.atan2(2 * sxy, sxx - syy);
  // Convert to compass bearing: bearing = 90° - theta.
  return (((90 - toDeg(theta)) % 180) + 180) % 180;
}

/** Of axisBearing and axisBearing+180, pick the one closest to the user's bearing. */
export function snapBearing(userBearing: number, axisBearing: number): number {
  const a = axisBearing, b = (axisBearing + 180) % 360;
  return angleDiff(userBearing, a) <= angleDiff(userBearing, b) ? a : b;
}

export function angleDiff(a: number, b: number): number {
  const d = Math.abs((((a - b) % 360) + 360) % 360);
  return d > 180 ? 360 - d : d;
}

/**
 * Pitch-frame unit vectors for a given own-goal bearing.
 * forward = from own goal toward the opponent goal; right = across, left → right when facing forward.
 */
export function frameVectors(ownGoalBearing: number) {
  const b = toRad(ownGoalBearing);
  const fx = -Math.sin(b), fy = -Math.cos(b);
  return { fx, fy, rx: fy, ry: -fx };
}

export function percentile(sorted: number[], p: number): number {
  if (!sorted.length) return 0;
  const i = (sorted.length - 1) * p;
  const lo = Math.floor(i), hi = Math.ceil(i);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (i - lo);
}

export function median(values: number[]): number {
  return percentile([...values].sort((a, b) => a - b), 0.5);
}
