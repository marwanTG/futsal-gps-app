// Relative 0-100 player scores. Min-max normalised across the user's OWN
// matches only: 100 = his best match on that metric, 0 = his weakest.

import type { MatchAnalysis } from './types';

export interface ScoreDef {
  key: string;
  label: string;
  formula: string;
  /** Raw metric; higher is better. */
  value: (m: MatchAnalysis) => number | null;
}

const meanOf = (a: number[]) => (a.length ? a.reduce((s, v) => s + v, 0) / a.length : null);
const median = (a: number[]) => {
  if (!a.length) return null;
  const s = [...a].sort((x, y) => x - y);
  return s[Math.floor(s.length / 2)];
};

export function coverage(m: MatchAnalysis): number {
  const cells = new Set<number>();
  for (let i = 0; i < m.samples.u.length; i++) {
    cells.add(Math.min(9, Math.floor(m.samples.u[i] * 10)) * 10 + Math.min(9, Math.floor(m.samples.v[i] * 10)));
  }
  return cells.size / 100;
}

export const BASE_SCORES: ScoreDef[] = [
  { key: 'speed', label: 'السرعة', formula: 'أقصى سرعة في الماتش (كم/س)', value: (m) => m.maxSpeed },
  { key: 'accel', label: 'التسارع', formula: 'متوسط أعلى تسارع في كل سبرينت (م/ث²)', value: (m) => meanOf(m.sprints.map((s) => s.peakAccel)) },
  { key: 'explosive', label: 'الانفجارية', formula: 'عدد السبرينتات في كل ساعة لعب فعلي', value: (m) => m.sprintsPerActiveHour },
  { key: 'endurance', label: 'التحمل', formula: 'متوسط السرعة في آخر تلت ÷ أول تلت', value: (m) => (m.thirds[0].meanSpeed ? m.thirds[2].meanSpeed / m.thirds[0].meanSpeed : null) },
  { key: 'workrate', label: 'معدل الشغل', formula: 'متر في الدقيقة (وقت فعلي)', value: (m) => m.mPerMin },
  { key: 'mobility', label: 'التنقل', formula: 'نسبة مربعات الملعب (10×10) اللي عديت عليها', value: (m) => coverage(m) },
  { key: 'offball', label: 'الحركة من غير كورة', formula: 'عدد الانطلاقات (> حد الانطلاقة) في كل ساعة لعب فعلي', value: (m) => (m.activeMin ? m.bursts / (m.activeMin / 60) : null) },
  { key: 'recovery', label: 'الاستشفاء', formula: 'عكس متوسط وقت الراحة بين السبرينتات (أقل = أحسن)', value: (m) => { const r = median(m.sprints.map((s) => s.recoveryS).filter((x): x is number => x != null)); return r ? -r : null; } },
  { key: 'consistency', label: 'الثبات', formula: 'عكس التشتت في أقصى سرعة للسبرينتات (معامل الاختلاف)', value: (m) => { const v = m.sprints.map((s) => s.maxSpeed); const mu = meanOf(v); if (!mu || v.length < 3) return null; const sd = Math.sqrt(v.reduce((s, x) => s + (x - mu) ** 2, 0) / v.length); return -sd / mu; } },
];

export const COMPOSITES: { key: string; label: string; parts: string[] }[] = [
  { key: 'fitness', label: 'اللياقة العامة', parts: ['speed', 'accel', 'endurance', 'workrate', 'recovery'] },
  { key: 'overall', label: 'الأداء العام', parts: BASE_SCORES.map((s) => s.key) },
];

export interface ScoreRow { key: string; label: string; formula: string; score: number | null; raw: number | null }

/** Scores for every match. Needs at least two matches with a value, else null. */
export function scoreMatches(matches: MatchAnalysis[]): Map<string, ScoreRow[]> {
  const out = new Map<string, ScoreRow[]>(matches.map((m) => [m.id, []]));
  const byKey = new Map<string, Map<string, number | null>>();
  for (const def of BASE_SCORES) {
    const raw = matches.map((m) => def.value(m));
    const vals = raw.filter((v): v is number => v != null && Number.isFinite(v));
    const lo = Math.min(...vals), hi = Math.max(...vals);
    const scores = new Map<string, number | null>();
    matches.forEach((m, i) => {
      const r = raw[i];
      const score = r == null || vals.length < 2 ? null : hi === lo ? 50 : Math.round((100 * (r - lo)) / (hi - lo));
      scores.set(m.id, score);
      out.get(m.id)!.push({ key: def.key, label: def.label, formula: def.formula, score, raw: r });
    });
    byKey.set(def.key, scores);
  }
  for (const c of COMPOSITES) {
    for (const m of matches) {
      const parts = c.parts.map((k) => byKey.get(k)!.get(m.id)).filter((v): v is number => v != null);
      out.get(m.id)!.push({
        key: c.key,
        label: c.label,
        formula: `متوسط: ${c.parts.map((k) => BASE_SCORES.find((b) => b.key === k)!.label).join('، ')}`,
        score: parts.length ? Math.round(parts.reduce((a, b) => a + b, 0) / parts.length) : null,
        raw: null,
      });
    }
  }
  return out;
}

/** Average score per key across matches (for the overall profile). */
export function averageScores(scored: Map<string, ScoreRow[]>): ScoreRow[] {
  const rows = [...scored.values()];
  if (!rows.length) return [];
  return rows[0].map((r, idx) => {
    const vals = rows.map((row) => row[idx].score).filter((v): v is number => v != null);
    return { ...r, raw: null, score: vals.length ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : null };
  });
}
