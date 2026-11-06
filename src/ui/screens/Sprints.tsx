import { useEffect, useMemo, useState } from 'react';
import type { Sprint } from '../../analysis/types';
import { Card, Stat } from '../Card';
import { sprintKey, useApp } from '../ctx';
import { ACCEL_CAVEAT, ATT, C, DEF, fmt, minLabel } from '../format';
import { exportCsv } from '../exporters';
import { IN_ARTIFACT } from '../../env';
import { ScopeToggle } from './Field';
import { NoMatch } from './Match';

type Sort = 'time' | 'speed' | 'distance';

export function SprintList() {
  const { analyses, selected, highlightSprint, dirMatches } = useApp();
  const [scope, setScope] = useState<'match' | 'all'>('match');
  const [sort, setSort] = useState<Sort>('time');
  const [dir, setDir] = useState<'all' | 'attack' | 'defense'>('all');
  const dirOk = new Set(dirMatches.map((m) => m.id));
  const label = (id: string) => analyses.find((m) => m.id === id)?.label ?? '';

  useEffect(() => {
    if (!highlightSprint) return;
    if (selected && !highlightSprint.startsWith(selected.id + '-')) setScope('all');
    setDir('all');
    setTimeout(() => document.getElementById(`sp-${highlightSprint}`)?.scrollIntoView({ block: 'center', behavior: 'smooth' }), 80);
  }, [highlightSprint]);

  const rows = useMemo(() => {
    const base = (scope === 'match' && selected ? selected.sprints : analyses.flatMap((m) => m.sprints)).filter((s) => dir === 'all' || s.direction === dir);
    const key: Record<Sort, (s: Sprint) => number> = { time: (s) => -(Number(s.matchId) + s.startMin * 60000), speed: (s) => s.maxSpeed, distance: (s) => s.distanceM };
    return [...base].sort((a, b) => sort === 'time' && scope === 'match' ? a.startMin - b.startMin : key[sort](b) - key[sort](a));
  }, [analyses, selected, scope, sort, dir]);

  if (!analyses.length) return <NoMatch />;
  const top = rows.length ? Math.max(...rows.map((s) => s.maxSpeed)) : 1;
  const avg = rows.length ? rows.reduce((s, r) => s + r.maxSpeed, 0) / rows.length : null;
  const csv = () => exportCsv([['الماتش', 'الدقيقة', 'المدة ث', 'المسافة م', 'السرعة كم/س', 'تسارع م/ث²', 'نبض', 'الاتجاه', 'راحة قبله ث'],
    ...rows.map((s) => [label(s.matchId), +s.startMin.toFixed(2), s.durationS, +s.distanceM.toFixed(1), +s.maxSpeed.toFixed(2), +s.peakAccel.toFixed(2), s.avgHr == null ? null : Math.round(s.avgHr), s.direction === 'attack' ? 'هجوم' : 'دفاع', s.recoveryS == null ? null : Math.round(s.recoveryS)])], 'sprints.csv');

  return (
    <div className="stack">
      <div className="toolbar">
        <ScopeToggle scope={scope} setScope={setScope} />
        {!IN_ARTIFACT && <button className="btn small no-print" onClick={csv}>نزّل الجدول (Excel)</button>}
      </div>
      <div className="stats">
        <Stat label="عدد السبرينتات" value={String(rows.length)} color={C.lime} />
        <Stat label="أسرع واحد" value={fmt(rows.length ? top : null)} unit="كم/س" color={C.cyan} />
        <Stat label="متوسط السرعة" value={fmt(avg)} unit="كم/س" color={C.coral} />
      </div>
      <Card title="كل سبرينت لوحده" caveat={ACCEL_CAVEAT}
        actions={<div className="pill-toggle mini no-print">{(['time', 'speed', 'distance'] as Sort[]).map((k) => <button key={k} className={sort === k ? 'on' : ''} onClick={() => setSort(k)}>{{ time: 'بالترتيب', speed: 'الأسرع', distance: 'الأطول' }[k]}</button>)}</div>}>
        <div className="pill-toggle mini no-print filter">{(['all', 'attack', 'defense'] as const).map((d) => <button key={d} className={dir === d ? 'on' : ''} onClick={() => setDir(d)}>{{ all: 'الكل', attack: 'هجوم', defense: 'دفاع' }[d]}</button>)}</div>
        <ol className="sprints">
          {rows.map((s) => {
            const key = sprintKey(s);
            const sure = dirOk.has(s.matchId);
            return (
              <li key={key} id={`sp-${key}`} className={highlightSprint === key ? 'hl' : ''}>
                <div className="sp-main">
                  <b className="num sp-speed">{fmt(s.maxSpeed)}<small>كم/س</small></b>
                  <div className="sp-bar"><i style={{ width: `${(100 * s.maxSpeed) / top}%`, background: s.direction === 'attack' ? ATT : DEF }} /></div>
                </div>
                <div className="sp-meta">
                  <span className={`chip ${s.direction === 'attack' ? 'att' : 'def'}`}>{s.direction === 'attack' ? 'هجوم' : 'دفاع'}{sure ? '' : '؟'}</span>
                  <span className="num">د {minLabel(s.startMin)}</span>
                  <span className="num">{fmt(s.distanceM, 0)} م</span>
                  <span className="num">{s.durationS} ث</span>
                  {s.recoveryS != null && <span className="muted num">راحة {Math.round(s.recoveryS)} ث</span>}
                  {scope === 'all' && <span className="muted">{label(s.matchId)}</span>}
                </div>
              </li>
            );
          })}
        </ol>
      </Card>
    </div>
  );
}
