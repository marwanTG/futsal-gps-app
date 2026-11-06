// Labels, number formatting and the colour palette. SVG uses these literal
// colours (not CSS variables) so exported PNGs render the same.

import type { ExclusionKind, Role } from '../analysis/types';

export const C = {
  bg: '#0B0D12',
  card: '#171A22',
  card2: '#12151C',
  line: '#262B36',
  pitch: '#13261A',
  pitchLine: '#2E4A38',
  text: '#F4F5F7',
  muted: '#8A90A0',
  lime: '#9DFF6A',
  cyan: '#6AD8FF',
  coral: '#FF8A6A',
  gold: '#FFD36A',
};

/** Attack / defense colours used everywhere. */
export const ATT = C.lime;
export const DEF = C.coral;

/** Speed zones, standing → sprint. */
export const ZONE_COLORS = ['#2A303C', '#3D5A73', C.cyan, '#C6E86A', C.lime];
export const HR_COLORS = ['#2A303C', '#3D5A73', C.cyan, C.gold, C.coral];
export const KIND_COLORS: Record<ExclusionKind, string> = { goalkeeper: C.cyan, rest: '#8A90A0', injury: C.coral };

export const WEEKDAYS = ['الأحد', 'الاتنين', 'التلات', 'الأربع', 'الخميس', 'الجمعة', 'السبت'];
export const MONTHS = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];
export const KIND_LABEL: Record<ExclusionKind, string> = { goalkeeper: 'كنت حارس', rest: 'راحة / دكة', injury: 'وقف إصابة' };
export const ROLE_LABEL: Record<Role, string> = { field: 'لاعب ملعب', goalkeeper: 'حارس', libero: 'ليبرو' };

export const fmt = (v: number | null | undefined, d = 1) => (v == null || !Number.isFinite(v) ? '—' : v.toFixed(d));
export const int = (v: number | null | undefined) => (v == null || !Number.isFinite(v) ? '—' : Math.round(v).toLocaleString('en-US'));
export const minLabel = (m: number) => `${Math.floor(m)}:${String(Math.round((m % 1) * 60) % 60).padStart(2, '0')}`;
/** "الأربع 15 يوليو" from YYYY-MM-DD. */
export const dayLabel = (date: string, weekday: number) => {
  const [, mo, d] = date.split('-').map(Number);
  return `${WEEKDAYS[weekday]} ${d} ${MONTHS[mo - 1]}`;
};
export const pct = (a: number, b: number) => (b ? Math.round((100 * a) / b) : 0);

export const ACCEL_CAVEAT = 'الساعة بتقيس مرة كل ثانية، فالسرعة والتسارع هنا أقل من الحقيقة شوية.';
export const GPS_CAVEAT = 'الساعة مش عارفة الكورة فين: دي حركتك إنت بس.';

const COMPASS = ['الشمال', 'الشمال الشرقي', 'الشرق', 'الجنوب الشرقي', 'الجنوب', 'الجنوب الغربي', 'الغرب', 'الشمال الغربي'];
/** Compass bearing (deg) → Arabic direction word. */
export const compassWord = (bearing: number) => COMPASS[Math.round((((bearing % 360) + 360) % 360) / 45) % 8];
