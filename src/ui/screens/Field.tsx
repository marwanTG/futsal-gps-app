import { useMemo, useState } from 'react';
import { grid3 } from '../../analysis/analyze';
import { fastestAndLongest } from '../../analysis/insights';
import type { MatchAnalysis, Sprint } from '../../analysis/types';
import { ArrowLayer, GridLayer, HeatLayer, Pitch, TrailReplay } from '../charts';
import { Card } from '../Card';
import { useApp } from '../ctx';
import { ATT, DEF } from '../format';
import { NoMatch, SetupBanner } from './Match';

export function ScopeToggle({ scope, setScope }: { scope: 'match' | 'all'; setScope: (s: 'match' | 'all') => void }) {
  return (
    <div className="pill-toggle no-print" role="tablist">
      <button className={scope === 'match' ? 'on' : ''} onClick={() => setScope('match')}>الماتش ده</button>
      <button className={scope === 'all' ? 'on' : ''} onClick={() => setScope('all')}>كل الماتشات</button>
    </div>
  );
}

const ROW = ['قريب من مرماك', 'في نص الملعب', 'قريب من مرمى الخصم'];
const COL = ['على الشمال', 'في النص', 'على اليمين'];

function topCell(pct: number[][]) {
  let best = [0, 0];
  pct.forEach((row, r) => row.forEach((p, c) => { if (p > pct[best[0]][best[1]]) best = [r, c]; }));
  return { r: best[0], c: best[1], p: Math.round(pct[best[0]][best[1]]) };
}

type View = 'heat' | 'grid' | 'arrows' | 'replay';

export function Field() {
  const { selected, dirMatches, analyses, openSprint, includeUnconfirmed, setIncludeUnconfirmed } = useApp();
  const [scope, setScope] = useState<'match' | 'all'>('match');
  const [view, setView] = useState<View>('arrows');
  const [dir, setDir] = useState<'all' | 'attack' | 'defense'>('all');
  const [heatSprints, setHeatSprints] = useState(false);
  const matches: MatchAnalysis[] = scope === 'match' ? (selected ? [selected] : []) : dirMatches;
  const sprints = matches.flatMap((m) => m.sprints);
  const label = (s: Sprint) => analyses.find((m) => m.id === s.matchId)?.label ?? '';

  const heatPts = useMemo(() => {
    const out: { u: number; v: number; w: number }[] = [];
    for (const m of matches) for (let i = 0; i < m.samples.u.length; i += 2) if (!heatSprints || m.samples.inSprint[i]) out.push({ u: m.samples.u[i], v: m.samples.v[i], w: m.samples.dt[i] });
    return out;
  }, [matches, heatSprints]);
  const grid = useMemo(() => grid3(matches.flatMap((m) => m.samples.u.map((u, i) => ({ u, v: m.samples.v[i], w: m.samples.dt[i] })))), [matches]);

  if (!analyses.length) return <NoMatch />;
  const att = sprints.filter((s) => s.direction === 'attack');
  const def = sprints.filter((s) => s.direction === 'defense');
  const shown = dir === 'attack' ? att : dir === 'defense' ? def : sprints;
  const fastest = fastestAndLongest(shown)?.fastest ?? null;
  const tc = topCell(grid.pct);
  const unconfirmed = scope === 'match' ? selected && !selected.orientationConfirmed : analyses.length > dirMatches.length;

  return (
    <div className="stack">
      {scope === 'match' && <SetupBanner />}
      <div className="toolbar">
        <ScopeToggle scope={scope} setScope={setScope} />
        {scope === 'all' && analyses.length > dirMatches.length && (
          <label className="check small"><input type="checkbox" checked={includeUnconfirmed} onChange={(e) => setIncludeUnconfirmed(e.target.checked)} />ضمّ الماتشات اللي مرماها مش متحدد</label>
        )}
      </div>
      <div className="tabs-inline" role="tablist">
        {([['arrows', 'هجوم ودفاع'], ['heat', 'أماكني'], ['grid', 'الملعب 9 مربعات'], ['replay', 'إعادة']] as [View, string][])
          .filter(([v]) => v !== 'replay' || scope === 'match')
          .map(([v, l]) => <button key={v} className={view === v ? 'on' : ''} onClick={() => setView(v)}>{l}</button>)}
      </div>

      {!matches.length && <div className="empty"><p>مفيش ماتشات مرماها متحدد. حدده من «ماتشاتي».</p></div>}

      {matches.length > 0 && view === 'arrows' && (
        <Card title="جريك السريع رايح فين؟" n={`${shown.length} سبرينت · ${matches.length} ماتش`} small={shown.length < 15}
          lead={<><b style={{ color: ATT }}>هجوم {att.length}</b> · <b style={{ color: DEF }}>دفاع {def.length}</b> · الدهبي الأسرع</>}
          caveat={unconfirmed ? 'حدد مرماك الأول عشان الاتجاه يبقى صح' : undefined}
          actions={<div className="pill-toggle mini no-print">{(['all', 'attack', 'defense'] as const).map((d) => <button key={d} className={dir === d ? 'on' : ''} onClick={() => setDir(d)}>{{ all: 'الكل', attack: 'هجوم', defense: 'دفاع' }[d]}</button>)}</div>}>
          <div className="pitch-box">
            <Pitch>
              {dir !== 'defense' && <ArrowLayer sprints={att} color={ATT} highlight={fastest} onPick={openSprint} label={label} />}
              {dir !== 'attack' && <ArrowLayer sprints={def} color={DEF} highlight={fastest} onPick={openSprint} label={label} />}
            </Pitch>
          </div>
        </Card>
      )}

      {matches.length > 0 && view === 'heat' && (
        <Card title="كنت بتلعب فين؟" n={`${matches.length} ماتش`} lead={<>أكتر مكان: {ROW[tc.r]} {COL[tc.c]}</>}
          actions={<div className="pill-toggle mini no-print"><button className={!heatSprints ? 'on' : ''} onClick={() => setHeatSprints(false)}>كل الوقت</button><button className={heatSprints ? 'on' : ''} onClick={() => setHeatSprints(true)}>السبرينتات</button></div>}>
          <div className="pitch-box"><Pitch><HeatLayer points={heatPts} /></Pitch></div>
        </Card>
      )}

      {matches.length > 0 && view === 'grid' && (
        <Card title="وقتك في كل حتة" n={`${matches.length} ماتش`} lead={<>أكتر مربع: <b>{ROW[tc.r]} {COL[tc.c]}</b> (<span className="num">{tc.p}%</span>)</>}
          >
          <div className="pitch-box"><Pitch><GridLayer pct={grid.pct} count={grid.count} /></Pitch></div>
        </Card>
      )}

      {view === 'replay' && scope === 'match' && selected && (
        <Card title="إعادة الماتش">
          <div className="pitch-box"><TrailReplay samples={selected.samples} /></div>
        </Card>
      )}
    </div>
  );
}
