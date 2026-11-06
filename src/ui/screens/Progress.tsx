import { useMemo, useState } from 'react';
import { BENCHMARKS } from '../../analysis/benchmarks';
import { buildInsights, strengthsAndPlan } from '../../analysis/insights';
import { averageScores, scoreMatches } from '../../analysis/profile';
import type { MatchAnalysis } from '../../analysis/types';
import { Trend } from '../charts';
import { Card } from '../Card';
import { useApp } from '../ctx';
import { ROLE_LABEL, WEEKDAYS, fmt, int } from '../format';
import { exportCsv } from '../exporters';
import { IN_ARTIFACT } from '../../env';
import { NoMatch } from './Match';

type Metric = { key: string; label: string; unit: string; get: (m: MatchAnalysis) => number | null; d: number; explain: string };

const METRICS: Metric[] = [
  { key: 'sph', label: 'سبرينت/ساعة', unit: 'سبرينت', get: (m) => m.sprintsPerActiveHour, d: 1, explain: 'عدد السبرينتات في كل ساعة لعب. أحسن مقياس للشدة.' },
  { key: 'mpm', label: 'متر/دقيقة', unit: 'متر', get: (m) => m.mPerMin, d: 0, explain: 'قد إيه بتتحرك في كل دقيقة لعب.' },
  { key: 'dist', label: 'المسافة', unit: 'متر', get: (m) => m.distanceM, d: 0, explain: 'المسافة الكلية. بتتأثر بطول الماتش.' },
  { key: 'max', label: 'أقصى سرعة', unit: 'كم/س', get: (m) => m.maxSpeed, d: 1, explain: 'أسرع لحظة في كل ماتش.' },
  { key: 'hr', label: 'متوسط النبض', unit: 'نبضة', get: (m) => m.hrAvg, d: 0, explain: 'متوسط نبضك في وقت اللعب.' },
];

export function Progress() {
  const { analyses, selected } = useApp();
  const [mk, setMk] = useState('sph');
  const [scoreView, setScoreView] = useState<'match' | 'avg'>('match');
  const scored = useMemo(() => scoreMatches(analyses), [analyses]);
  if (!analyses.length) return <NoMatch />;
  const metric = METRICS.find((x) => x.key === mk)!;
  const vals = analyses.map((m) => metric.get(m));
  const selIdx = analyses.findIndex((m) => m.id === selected?.id);
  const others = vals.filter((v, i) => v != null && i !== selIdx) as number[];
  const avg = others.length ? others.reduce((a, b) => a + b, 0) / others.length : null;
  const cur = selIdx >= 0 ? vals[selIdx] : null;
  const diff = cur != null && avg ? Math.round((100 * (cur - avg)) / avg) : null;
  const useAvg = scoreView === 'avg' && analyses.length >= 3;
  const scores = useAvg ? averageScores(scored) : (selected && scored.get(selected.id)) || [];
  const { strengths, weaknesses, weeks } = strengthsAndPlan(scores);
  const findings = buildInsights(analyses, analyses.filter((m) => m.orientationConfirmed));

  return (
    <div className="stack">
      <div className="tabs-inline" role="tablist">{METRICS.map((x) => <button key={x.key} className={mk === x.key ? 'on' : ''} onClick={() => setMk(x.key)}>{x.label}</button>)}</div>
      <Card title={metric.label} n={`${analyses.length} ماتش`} small={analyses.length < 4}
        lead={diff == null ? metric.explain : <>{selected?.label}: {Math.abs(diff) < 5 ? 'قريب من متوسطك.' : <><b className="num">{Math.abs(diff)}%</b> {diff > 0 ? 'أعلى' : 'أقل'} من متوسط باقي ماتشاتك.</>} <span className="muted">{metric.explain}</span></>}>
        <Trend labels={analyses.map((m) => m.label.slice(5).replace('-', '/'))} values={vals} selected={selIdx} unit={metric.unit} digits={metric.d} />
      </Card>

      <Card title="مستواك في كل حاجة" n={`${analyses.length} ماتش`} small={analyses.length < 4}
        lead="100 = أحسن ماتش ليك"
        actions={<div className="pill-toggle mini no-print"><button className={!useAvg ? 'on' : ''} onClick={() => setScoreView('match')}>الماتش ده</button><button className={useAvg ? 'on' : ''} disabled={analyses.length < 3} title={analyses.length < 3 ? 'محتاج 3 ماتشات على الأقل' : ''} onClick={() => setScoreView('avg')}>المتوسط</button></div>}>
        {analyses.length < 2 ? <p className="muted">محتاج ماتشين على الأقل عشان المقارنة.</p> : (
          <div className="scores">{scores.map((r) => (
            <div key={r.key} className={`score ${r.key === 'overall' || r.key === 'fitness' ? 'composite' : ''}`} title={r.formula}>
              <span>{r.label}</span>
              <div className="meter"><i style={{ width: `${r.score ?? 0}%` }} /></div>
              <b className="num">{r.score ?? '—'}</b>
            </div>
          ))}</div>
        )}
      </Card>

      {analyses.length >= 2 && (
        <div className="cards-2">
          <Card title="أقوى حاجات عندك">
            <ul className="story">{strengths.map((s) => <li key={s.key} className="good"><b>{s.label}</b> <span className="muted small">{s.formula}</span></li>)}</ul>
            <h4>محتاجة شغل</h4>
            <ul className="story">{weaknesses.map((s) => <li key={s.key} className="warn"><b>{s.label}</b> <span className="muted small">{s.formula}</span></li>)}</ul>
          </Card>
          <Card title="خطة 8 أسابيع" lead="مبنية على أضعف 3 حاجات عندك." caveat="لو عندك أي حالة صحية، اسأل دكتورك قبل ما تزوّد الشدة.">
            <ol className="weeks">{weeks.map((w) => <li key={w.week}><b>أسبوع {w.week}: {w.focus}</b><ul>{w.sessions.map((s) => <li key={s}>{s}</li>)}</ul></li>)}</ol>
          </Card>
        </div>
      )}

      {findings.length > 0 && (
        <Card title="ملاحظات على كل ماتشاتك" caveat="دي حركتك بس، الساعة مش عارفة الكورة فين. «الثقة» معناها حجم العينة.">
          <ul className="story">{findings.map((f, i) => <li key={i} className={f.tone}>{f.text}<br /><span className="muted small num">{f.numbers} · {f.n} · ثقة {f.confidence}</span></li>)}</ul>
        </Card>
      )}

      <details className="more card">
        <summary>جدول المقارنة الكامل</summary>
        <div className="tbl-wrap">
          <table className="tbl">
            <thead><tr><th>الماتش</th><th>اليوم</th><th>المركز</th><th>سن الخصم</th><th>وقت اللعب</th>{METRICS.map((x) => <th key={x.key}>{x.label}</th>)}<th>سبرينتات</th></tr></thead>
            <tbody>{analyses.map((m) => (
              <tr key={m.id}><td>{m.label}</td><td>{WEEKDAYS[m.weekday]}</td><td>{ROLE_LABEL[m.role]}</td><td className="num">{m.opponentAge ?? '—'}</td><td className="num">{fmt(m.activeMin, 0)}</td>
                {METRICS.map((x) => <td key={x.key} className="num">{x.d === 0 ? int(x.get(m)) : fmt(x.get(m), x.d)}</td>)}<td className="num">{m.sprints.length}</td></tr>
            ))}</tbody>
          </table>
        </div>
        {!IN_ARTIFACT && <button className="btn small" onClick={() => exportCsv([['الماتش', 'اليوم', 'المركز', 'سن الخصم', 'وقت اللعب', ...METRICS.map((x) => x.label), 'سبرينتات'], ...analyses.map((m) => [m.label, WEEKDAYS[m.weekday], ROLE_LABEL[m.role], m.opponentAge, +m.activeMin.toFixed(1), ...METRICS.map((x) => { const v = x.get(m); return v == null ? null : +v.toFixed(x.d); }), m.sprints.length])], 'matches.csv')}>نزّل الجدول (Excel)</button>}
      </details>

      <details className="more card">
        <summary>مقارنة بلاعيبة محترفين</summary>
        <p className="small muted">المراجع دي لاعيبة نخبة اتقاسوا بأجهزة احترافية بتقيس 10 مرات في الثانية أو أكتر. ساعتك بتقيس مرة واحدة، فمفيش مقارنة مباشرة. ومفيش أرقام موثقة للهواة، فمش هنخترع رقم.</p>
        <ul className="plain">{BENCHMARKS.map((b) => <li key={b.id}><b>{b.metric}</b>: {b.verified && b.value ? <span className="num">{b.value}</span> : <span className="muted">لسه بنتأكد من الرقم</span>}<br /><span className="small muted" dir="ltr">{b.citation}</span></li>)}</ul>
      </details>
    </div>
  );
}
