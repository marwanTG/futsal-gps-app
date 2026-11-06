// Plain-language findings, strengths/weaknesses and the 8-week plan.
// Movement facts only: GPS does not know where the ball is.

import type { MatchAnalysis, PlayerProfile, Sprint } from './types';
import type { ScoreRow } from './profile';

export type Confidence = 'عالية' | 'متوسطة' | 'ضعيفة';

export interface Insight {
  text: string;
  numbers: string;
  n: string;
  confidence: Confidence;
  tone: 'good' | 'warn' | 'info';
}

const f1 = (v: number) => v.toFixed(1);
const conf = (n: number): Confidence => (n >= 40 ? 'عالية' : n >= 15 ? 'متوسطة' : 'ضعيفة');

export function fastestAndLongest(sprints: Sprint[]) {
  if (!sprints.length) return null;
  const fastest = sprints.reduce((a, b) => (b.maxSpeed > a.maxSpeed ? b : a));
  const longest = sprints.reduce((a, b) => (b.distanceM > a.distanceM ? b : a));
  return { fastest, longest };
}

export function buildInsights(matches: MatchAnalysis[], dirMatches: MatchAnalysis[]): Insight[] {
  const out: Insight[] = [];
  const sprints = matches.flatMap((m) => m.sprints);
  const nM = matches.length;
  if (!nM) return out;
  const label = (id: string) => matches.find((m) => m.id === id)?.label ?? '';

  const fl = fastestAndLongest(sprints);
  if (fl) {
    out.push({
      text: `أسرع سبرينت مش هو أطول سبرينت: الأسرع ${f1(fl.fastest.maxSpeed)} كم/س (${f1(fl.fastest.distanceM)} م) في ماتش ${label(fl.fastest.matchId)}، والأطول ${f1(fl.longest.distanceM)} م بسرعة ${f1(fl.longest.maxSpeed)} كم/س في ماتش ${label(fl.longest.matchId)}.`,
      numbers: `أسرع: ${f1(fl.fastest.maxSpeed)} كم/س · أطول: ${f1(fl.longest.distanceM)} م`,
      n: `${sprints.length} سبرينت · ${nM} ماتش`,
      confidence: conf(sprints.length),
      tone: 'info',
    });
  }

  const dirSprints = dirMatches.flatMap((m) => m.sprints);
  if (dirSprints.length) {
    const att = dirSprints.filter((s) => s.direction === 'attack').length;
    const def = dirSprints.length - att;
    const share = (100 * att) / dirSprints.length;
    out.push({
      text: share > 60 ? 'أغلب جريك السريع رايح ناحية مرمى الخصم.' : share < 40 ? 'أغلب جريك السريع راجع ناحية مرماك (رجوع دفاعي).' : 'جريك السريع متوازن بين الطلوع والرجوع.',
      numbers: `هجوم ${att} · دفاع ${def} (${f1(share)}% هجوم)`,
      n: `${dirSprints.length} سبرينت · ${dirMatches.length} ماتش اتجاهه مؤكد`,
      confidence: conf(dirSprints.length),
      tone: 'info',
    });
  }

  const thirds = [0, 1, 2].map((k) => {
    const rows = matches.map((m) => m.thirds[k]);
    const min = rows.reduce((s, r) => s + r.activeMin, 0);
    const sp = rows.reduce((s, r) => s + r.sprints, 0);
    const acc = rows.map((r) => r.meanPeakAccel).filter((v): v is number => v != null);
    return { perHour: min ? sp / (min / 60) : 0, acc: acc.length ? acc.reduce((a, b) => a + b, 0) / acc.length : null };
  });
  if (sprints.length >= 6) {
    const drop = thirds[0].perHour ? (thirds[2].perHour - thirds[0].perHour) / thirds[0].perHour : 0;
    out.push({
      text: drop < -0.2 ? 'عدد السبرينتات بيقل بوضوح في آخر تلت من وقت لعبك الفعلي.' : drop > 0.2 ? 'عدد السبرينتات بيزيد في آخر تلت، مفيش علامة تعب واضحة في الجري السريع.' : 'عدد السبرينتات ثابت تقريباً على مدار الماتش.',
      numbers: `سبرينت/ساعة: ${thirds.map((t) => f1(t.perHour)).join(' ← ')}` + (thirds.every((t) => t.acc != null) ? ` · تسارع: ${thirds.map((t) => (t.acc as number).toFixed(2)).join(' ← ')} م/ث²` : ''),
      n: `${sprints.length} سبرينت · ${nM} ماتش`,
      confidence: conf(sprints.length),
      tone: drop < -0.2 ? 'warn' : 'good',
    });
  }

  const rsa = matches.reduce((s, m) => s + m.rsaCount, 0);
  if (sprints.length) {
    out.push({
      text: `${rsa} سبرينت جه بعد أقل من دقيقة راحة من اللي قبله (سبرينتات متكررة).`,
      numbers: `${f1((100 * rsa) / sprints.length)}% من السبرينتات`,
      n: `${sprints.length} سبرينت`,
      confidence: conf(sprints.length),
      tone: 'info',
    });
  }

  const tagged = matches.filter((m) => m.opponentAge != null);
  const young = tagged.filter((m) => (m.opponentAge as number) < 32);
  const old = tagged.filter((m) => (m.opponentAge as number) >= 32);
  if (young.length && old.length) {
    const rate = (ms: MatchAnalysis[]) => {
      const min = ms.reduce((s, m) => s + m.activeMin, 0);
      return min ? ms.reduce((s, m) => s + m.sprints.length, 0) / (min / 60) : 0;
    };
    out.push({
      text: 'الشدة بتختلف حسب سن الخصم، فقارن الماتشات المتشابهة ببعض.',
      numbers: `خصم أصغر من 32: ${f1(rate(young))} سبرينت/ساعة · خصم 32+: ${f1(rate(old))} سبرينت/ساعة`,
      n: `${young.length} + ${old.length} ماتش`,
      confidence: young.length + old.length >= 6 ? 'متوسطة' : 'ضعيفة',
      tone: 'info',
    });
  }
  return out;
}

export interface PlanWeek { week: number; focus: string; sessions: string[] }

const AREAS: Record<string, { name: string; drills: string[] }> = {
  explosive: { name: 'الانفجارية', drills: ['6-8 انطلاقات 10 متر من الوقوف، راحة كاملة 60-90 ث', 'نط على صندوق واطي 3×6'] },
  accel: { name: 'التسارع', drills: ['انطلاقات 5-10 متر من أوضاع مختلفة (ضهرك للاتجاه، من جنب)', 'سحب مقاومة خفيفة أو طلوع منحدر 6×10 م'] },
  recovery: { name: 'الاستشفاء بين المجهودات', drills: ['سبرينتات متكررة: 6×15 م كل 30 ث، مجموعتين', 'جري خفيف 20-25 دقيقة يوم الراحة النشيطة'] },
  endurance: { name: 'التحمل', drills: ['جري متقطع 15 ث سريع / 15 ث مشي × 10-12 تكرار', 'جري ثابت 25-30 دقيقة بسرعة تقدر تتكلم فيها'] },
  workrate: { name: 'معدل الشغل', drills: ['ماتشات مصغرة 3 ضد 3 لمدة 3-4 دقايق × 4', 'جري مكوكي 20 م لمدة دقيقة × 5'] },
  mobility: { name: 'التنقل والرشاقة', drills: ['تمارين تغيير اتجاه بالأقماع (T-drill، زجزاج) 6 تكرارات', 'سلم رشاقة 8-10 دقايق'] },
  speed: { name: 'السرعة القصوى', drills: ['سبرينت 20-25 م بعد تسخين كامل × 5، راحة 2 دقيقة', 'انطلاقة طايرة: 10 م تدرج + 10 م أقصى سرعة × 4'] },
  offball: { name: 'الحركة من غير كورة', drills: ['تمرين فتح مساحة: انطلاقة قصيرة بعد كل تمريرة في الماتشات المصغرة', 'تكرارات 3-5 ثواني جري عالي مع فترات مشي'] },
  consistency: { name: 'الثبات', drills: ['نفس تمرين السبرينت كل أسبوع وسجّل الوقت', 'نوم ثابت ومياه كفاية قبل الماتشات'] },
};

/** Weakest base scores (lowest average) → strengths/weaknesses and an 8-week plan. */
export function strengthsAndPlan(avg: ScoreRow[]) {
  const base = avg.filter((r) => r.score != null && AREAS[r.key]);
  const sorted = [...base].sort((a, b) => (a.score as number) - (b.score as number));
  const weaknesses = sorted.slice(0, 3);
  const strengths = sorted.slice(-3).reverse();
  const focus = weaknesses.length ? weaknesses : [{ key: 'recovery', label: 'الاستشفاء', score: null, raw: null, formula: '' }];
  const weeks: PlanWeek[] = Array.from({ length: 8 }, (_, i) => {
    const area = AREAS[focus[i % focus.length].key];
    const deload = i === 3 || i === 7;
    return {
      week: i + 1,
      focus: deload ? `أسبوع تخفيف (${area.name})` : area.name,
      sessions: deload
        ? ['نفس التمارين بنص الحجم', 'ماتش عادي وقيس الفرق في التطبيق']
        : [...area.drills, i < 3 ? 'مرتين في الأسبوع' : 'تلات مرات في الأسبوع لو جسمك مستريح'],
    };
  });
  return { strengths, weaknesses, weeks };
}

/** Neutral, non-diagnostic heart-rate note. */
export function heartRateNote(matchMax: number | null, allTimeMax: number | null, profile: PlayerProfile): string | null {
  if (matchMax == null) return null;
  const agePred = profile.age ? 220 - profile.age : null;
  const nearTop = allTimeMax != null && matchMax >= 0.95 * allTimeMax;
  const aboveAge = agePred != null && matchMax > agePred;
  if (!nearTop && !aboveAge) return null;
  return `أعلى نبض هنا ${matchMax} نبضة/د${agePred ? ` (المتوقع حسب السن 220 − ${profile.age} = ${agePred})` : ''}. التطبيق مش أداة طبية؛ لو النبض العالي ده متكرر، كلّم دكتور عنه.`;
}

export interface StoryLine { text: string; tone: 'good' | 'warn' | 'info' }

/** Short plain sentences about one match, compared with the player's own average. */
export function matchStory(m: MatchAnalysis, all: MatchAnalysis[]): StoryLine[] {
  const out: StoryLine[] = [];
  const others = all.filter((x) => x.id !== m.id);
  const avg = (f: (x: MatchAnalysis) => number) => (others.length ? others.reduce((s, x) => s + f(x), 0) / others.length : null);
  const vs = (cur: number, ref: number | null) => (ref ? Math.round((100 * (cur - ref)) / ref) : null);

  const d = vs(m.sprintsPerActiveHour, avg((x) => x.sprintsPerActiveHour));
  if (d != null) {
    out.push(Math.abs(d) < 8
      ? { text: 'عدد السبرينتات قريب من متوسطك العادي.', tone: 'info' }
      : d > 0 ? { text: `جريت سريع أكتر من العادي: ${d}% سبرينتات زيادة عن متوسطك في نفس الوقت.`, tone: 'good' }
      : { text: `جريت سريع أقل من العادي: ${-d}% سبرينتات أقل من متوسطك في نفس الوقت.`, tone: 'warn' });
  }

  const fl = fastestAndLongest(m.sprints);
  if (fl && fl.fastest !== fl.longest) {
    out.push({ text: `أسرع سبرينت كان ${f1(fl.fastest.maxSpeed)} كم/س في الدقيقة ${Math.floor(fl.fastest.startMin)}، وأطول سبرينت كان ${Math.round(fl.longest.distanceM)} متر.`, tone: 'info' });
  }

  const [t1, , t3] = m.thirds;
  if (m.sprints.length >= 6 && t1.sprintsPerHour) {
    const ch = Math.round((100 * (t3.sprintsPerHour - t1.sprintsPerHour)) / t1.sprintsPerHour);
    out.push(ch <= -20
      ? { text: `في آخر الماتش السبرينتات قلّت ${-ch}% عن أوله. ده ممكن يكون تعب.`, tone: 'warn' }
      : ch >= 20 ? { text: `في آخر الماتش جريت سريع أكتر من أوله (+${ch}%). مفيش علامة تعب.`, tone: 'good' }
      : { text: 'مجهودك كان ثابت من أول الماتش لآخره.', tone: 'good' });
  }

  if (m.orientationConfirmed && m.sprints.length >= 4) {
    const att = m.sprints.filter((s) => s.direction === 'attack').length;
    const share = Math.round((100 * att) / m.sprints.length);
    out.push({ text: share >= 60 ? `معظم جريك السريع كان طالع للهجوم (${share}%).` : share <= 40 ? `معظم جريك السريع كان راجع للدفاع (${100 - share}%).` : `جريك السريع كان متقسم بين الهجوم (${att}) والدفاع (${m.sprints.length - att}).`, tone: 'info' });
  }

  if (m.rsaCount >= 2) out.push({ text: `${m.rsaCount} مرات عملت سبرينت ورا سبرينت بأقل من دقيقة راحة.`, tone: 'info' });
  return out;
}
