import * as d3 from 'd3';
import { useMemo, useState } from 'react';
import type { ExclusionKind, GoalEnd, MatchAnalysis, MatchSettings } from '../../analysis/types';
import { angleDiff } from '../../analysis/geo';
import { HeatLayer, Pitch } from '../charts';
import { useApp } from '../ctx';
import { C, KIND_COLORS, KIND_LABEL, ROLE_LABEL, compassWord, dayLabel, fmt, minLabel } from '../format';
import { SatellitePicker } from '../Satellite';
import { IN_ARTIFACT } from '../../env';

export function Upload({ compact }: { compact?: boolean }) {
  const { addFiles } = useApp();
  const [over, setOver] = useState(false);
  const [busy, setBusy] = useState(false);
  const take = async (list: FileList | null) => {
    if (!list?.length) return;
    setBusy(true);
    await addFiles([...list]);
    setBusy(false);
  };
  return (
    <label className={`drop ${over ? 'over' : ''} ${compact ? 'compact' : ''}`}
      onDragOver={(e) => { e.preventDefault(); setOver(true); }} onDragLeave={() => setOver(false)}
      onDrop={(e) => { e.preventDefault(); setOver(false); take(e.dataTransfer.files); }}>
      <input type="file" multiple hidden onChange={(e) => take(e.target.files)} />
      <span className="drop-icon"><svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M12 16V4m0 0L7 9m5-5l5 5M5 20h14" /></svg></span>
      <div>
        <b>{busy ? 'بيتحلل…' : compact ? 'ضيف ماتش' : 'ارفع ملف الماتش'}</b>
        {!compact && <span>ملف GPX من تطبيق Zepp</span>}
      </div>
    </label>
  );
}

function statusOf(a: MatchAnalysis, s: MatchSettings) {
  const pendingStops = a.candidates.filter((c) => !s.dismissedCandidates.includes(c.id) && !s.exclusions.some((e) => e.id === c.id)).length;
  const missing: string[] = [];
  if (a.drift.suggestedTrimMin != null && s.trimEndMin == null) missing.push('نهاية الماتش');
  if (pendingStops) missing.push(`${pendingStops} وقفة`);
  if (!a.orientationConfirmed) missing.push('مرماك');
  return missing;
}

export function Matches({ onEdit }: { onEdit: (id: string) => void }) {
  const { analyses, settings, removeTrack, selectedId, setSelectedId } = useApp();
  return (
    <div className="stack">
      <Upload compact={analyses.length > 0} />
      {!analyses.length && (
        <div className="empty">
          <p>لسه مفيش ماتشات.</p>
        </div>
      )}
      <ul className="match-list">
        {[...analyses].reverse().map((a) => {
          const s = settings[a.id];
          const missing = statusOf(a, s);
          return (
            <li key={a.id} className={a.id === selectedId ? 'on' : ''}>
              <button className="match-row" onClick={() => setSelectedId(a.id)}>
                <span className="match-date">{dayLabel(a.date, a.weekday)}</span>
                <span className="match-meta num">{fmt(a.durationMin, 0)} د · {a.sprints.length} سبرينت</span>
                {missing.length ? <span className="chip warn">ناقص: {missing.join('، ')}</span> : <span className="chip ok">جاهز</span>}
              </button>
              <div className="row-actions">
                <button className={`btn ${missing.length ? 'primary' : ''}`} onClick={() => onEdit(a.id)}>{missing.length ? 'كمّل التظبيط' : 'عدّل'}</button>
                <button className="icon-btn danger" title="امسح الماتش" aria-label="امسح الماتش" onClick={() => removeTrack(a.id)}>
                  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M5 7h14M10 11v6m4-6v6M7 7l1 12h8l1-12M9 7V4h6v3" /></svg>
                </button>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function Strip({ a, s, highlight }: { a: MatchAnalysis; s: MatchSettings; highlight?: [number, number] }) {
  const W = 700, H = 90;
  const x = d3.scaleLinear().domain([0, a.rawDurationMin]).range([0, W]);
  const y = d3.scaleLinear().domain([0, Math.max(10, a.maxSpeed)]).range([H - 18, 6]);
  const step = Math.max(1, Math.floor(a.timeline.min.length / 700));
  const area = d3.area<number>().x((i) => x(a.timeline.min[i])).y0(H - 18).y1((i) => y(a.timeline.speed[i]))(d3.range(0, a.timeline.min.length, step)) ?? '';
  return (
    <svg className="chart strip" viewBox={`0 0 ${W} ${H}`} direction="ltr" preserveAspectRatio="none">
      <rect width={W} height={H} fill={C.card2} rx={10} />
      {s.exclusions.map((e) => <rect key={e.id} x={x(e.startMin)} width={Math.max(2, x(e.endMin) - x(e.startMin))} y={4} height={H - 22} fill={KIND_COLORS[e.kind]} fillOpacity={0.35} />)}
      {highlight && <rect x={x(highlight[0])} width={Math.max(2, x(highlight[1]) - x(highlight[0]))} y={2} height={H - 18} fill="none" stroke={C.lime} strokeWidth={2} vectorEffect="non-scaling-stroke" />}
      <path d={area} fill={C.cyan} fillOpacity={0.35} stroke={C.cyan} strokeWidth={1} vectorEffect="non-scaling-stroke" />
      {s.trimEndMin != null && <rect x={x(s.trimEndMin)} width={W - x(s.trimEndMin)} y={0} height={H - 16} fill={C.bg} fillOpacity={0.75} />}
      {s.orientation.swapsMin.map((m) => <line key={m} x1={x(m)} x2={x(m)} y1={0} y2={H - 16} stroke={C.gold} strokeWidth={2} vectorEffect="non-scaling-stroke" />)}
      {d3.range(0, a.rawDurationMin, 10).map((m) => <text key={m} x={x(m) + 2} y={H - 4} fontSize={11} fill={C.muted} fontFamily="Alexandria">{m}′</text>)}
    </svg>
  );
}

const STEPS = ['نهاية الماتش', 'الوقفات', 'مرماك', 'التفاصيل'];

export function Wizard({ id, onClose }: { id: string; onClose: () => void }) {
  const { analyses, settings, setSetting } = useApp();
  const [step, setStep] = useState(0);
  const a = analyses.find((x) => x.id === id);
  const s = settings[id];
  if (!a || !s) return null;
  const set = (p: Partial<MatchSettings>) => setSetting(id, p);

  return (
    <div className="sheet" role="dialog" aria-modal="true" aria-label="تظبيط الماتش">
      <div className="sheet-inner">
        <header className="sheet-head">
          <button className="icon-btn" onClick={onClose} aria-label="قفل">
            <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
          </button>
          <span className="muted">{dayLabel(a.date, a.weekday)}</span>
        </header>
        <div className="steps" role="tablist">
          {STEPS.map((l, i) => <button key={l} role="tab" aria-selected={i === step} className={i === step ? 'on' : i < step ? 'done' : ''} onClick={() => setStep(i)}><i />{l}</button>)}
        </div>
        <p className="step-count">خطوة {step + 1} من {STEPS.length}</p>
        {step === 0 && <StepTrim a={a} s={s} set={set} />}
        {step === 1 && <StepStops a={a} s={s} set={set} />}
        {step === 2 && <StepGoal a={a} s={s} set={set} />}
        {step === 3 && <StepDetails a={a} s={s} set={set} />}
        <footer className="sheet-foot">
          {step > 0 && <button className="btn" onClick={() => setStep(step - 1)}>رجوع</button>}
          {step < STEPS.length - 1
            ? <button className="btn primary grow" onClick={() => setStep(step + 1)}>تمام، كمّل</button>
            : <button className="btn primary grow" onClick={onClose}>خلصنا</button>}
        </footer>
      </div>
    </div>
  );
}

type StepProps = { a: MatchAnalysis; s: MatchSettings; set: (p: Partial<MatchSettings>) => void };

function StepTrim({ a, s, set }: StepProps) {
  const drift = a.drift.suggestedTrimMin;
  return (
    <div className="step">
      <h2>الماتش خلص إمتى؟</h2>
      <p className="muted">حرّك المؤشر لآخر الماتش.</p>
      {drift != null && (
        <div className="hint">
          <p>غالباً الماتش خلص في الدقيقة <b className="num">{minLabel(drift)}</b>، وبعدها كنت ماشي بره الملعب.</p>
          <button className="btn primary" onClick={() => set({ trimEndMin: Math.floor(drift * 10) / 10 })}>اقطع عند {minLabel(drift)}</button>
        </div>
      )}
      <Strip a={a} s={s} />
      <div className="trim">
        <input type="range" dir="ltr" min={1} max={a.rawDurationMin} step={0.1} value={s.trimEndMin ?? a.rawDurationMin}
          onChange={(e) => { const v = +e.target.value; set({ trimEndMin: v >= a.rawDurationMin - 0.05 ? null : v }); }} aria-label="نهاية الماتش" />
      </div>
      <p className="center big-num num">{s.trimEndMin == null ? `${minLabel(a.rawDurationMin)} (كله)` : minLabel(s.trimEndMin)}</p>
    </div>
  );
}

function StepStops({ a, s, set }: StepProps) {
  const [kind, setKind] = useState<ExclusionKind>('goalkeeper');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const addEx = (k: ExclusionKind, startMin: number, endMin: number, exId = `e${Date.now()}`) =>
    set({ exclusions: [...s.exclusions.filter((e) => e.id !== exId), { id: exId, kind: k, startMin: Math.min(startMin, endMin), endMin: Math.max(startMin, endMin) }].sort((p, q) => p.startMin - q.startMin) });
  const cands = a.candidates.filter((c) => !s.dismissedCandidates.includes(c.id));
  const decided = (cid: string) => s.exclusions.find((e) => e.id === cid)?.kind;
  return (
    <div className="step">
      <h2>الأوقات اللي كنت واقف فيها</h2>
      <p className="muted">كل وقفة كانت إيه؟</p>
      <Strip a={a} s={s} />
      {cands.length === 0 && <p className="hint">مفيش وقفات طويلة.</p>}
      <ul className="stops">
        {cands.map((c) => {
          const k = decided(c.id);
          return (
            <li key={c.id}>
              <div><b className="num">د {minLabel(c.startMin)} ← {minLabel(c.endMin)}</b><span className="muted small"> · {fmt(c.endMin - c.startMin, 0)} دقيقة شبه واقف</span></div>
              <div className="choice">
                {(['goalkeeper', 'rest', 'injury'] as ExclusionKind[]).map((kk) => (
                  <button key={kk} className={k === kk ? 'on' : ''} onClick={() => addEx(kk, c.startMin, c.endMin, c.id)}>{KIND_LABEL[kk]}</button>
                ))}
                <button onClick={() => set({ dismissedCandidates: [...s.dismissedCandidates, c.id], exclusions: s.exclusions.filter((e) => e.id !== c.id) })}>كنت بلعب</button>
              </div>
            </li>
          );
        })}
      </ul>
      <details className="more">
        <summary>ضيف وقت بإيدك</summary>
        <div className="ex-add">
          <select value={kind} onChange={(e) => setKind(e.target.value as ExclusionKind)} aria-label="النوع">
            {(Object.keys(KIND_LABEL) as ExclusionKind[]).map((k) => <option key={k} value={k}>{KIND_LABEL[k]}</option>)}
          </select>
          <input type="number" inputMode="decimal" step={0.5} min={0} value={from} onChange={(e) => setFrom(e.target.value)} placeholder="من دقيقة" aria-label="من دقيقة" />
          <input type="number" inputMode="decimal" step={0.5} min={0} value={to} onChange={(e) => setTo(e.target.value)} placeholder="لحد دقيقة" aria-label="لحد دقيقة" />
          <button className="btn" disabled={from === '' || to === ''} onClick={() => { addEx(kind, +from, +to); setFrom(''); setTo(''); }}>ضيف</button>
        </div>
      </details>
      {s.exclusions.filter((e) => !a.candidates.some((c) => c.id === e.id)).map((e) => (
        <div key={e.id} className="ex-item"><i style={{ background: KIND_COLORS[e.kind] }} />{KIND_LABEL[e.kind]} <span className="num">د {fmt(e.startMin)} ← {fmt(e.endMin)}</span>
          <button className="icon-btn" aria-label="شيل" onClick={() => set({ exclusions: s.exclusions.filter((x) => x.id !== e.id) })}>✕</button></div>
      ))}
    </div>
  );
}

function StepGoal({ a, s, set }: StepProps) {
  const { venues } = useApp();
  const [seg, setSeg] = useState(0);
  const [swapInput, setSwapInput] = useState('');
  const [sat, setSat] = useState(!IN_ARTIFACT);
  const [offline, setOffline] = useState(false);
  const words = { a: compassWord(a.frame.axisBearing), b: compassWord(a.frame.axisBearing + 180) };
  const o = s.orientation;
  const segs = a.frame.segments;
  const k = Math.min(seg, segs.length - 1);
  const cur = segs[k];
  const chosen = o.ends[k] ?? null;

  const pick = (end: GoalEnd) => {
    const ends = [...o.ends];
    ends[k] = end;
    // A swap flips ends: pre-fill later unset segments with the alternating end.
    for (let j = k + 1; j < ends.length; j++) if (ends[j] == null) ends[j] = (j - k) % 2 ? (end === 'a' ? 'b' : 'a') : end;
    set({ orientation: { ...o, ends } });
  };
  const addSwap = (m: number) => {
    if (!(m > 0 && m < a.durationMin) || o.swapsMin.some((x) => Math.abs(x - m) < 0.5)) return;
    const swapsMin = [...o.swapsMin, m].sort((p, q) => p - q);
    const idx = swapsMin.indexOf(m);
    const before = o.ends[idx] ?? null;
    const ends = [...o.ends];
    ends.splice(idx + 1, 0, before ? (before === 'a' ? 'b' : 'a') : null);
    set({ orientation: { swapsMin, ends } });
    setSwapInput('');
  };
  const removeSwap = (i: number) => {
    const swapsMin = o.swapsMin.filter((_, j) => j !== i);
    const ends = o.ends.filter((_, j) => j !== i + 1);
    set({ orientation: { swapsMin, ends } });
    setSeg(0);
  };

  const pts = useMemo(() => {
    const out: { u: number; v: number; w: number }[] = [];
    const st = a.axisSamples;
    for (let i = 0; i < st.t.length; i += 2) if (st.t[i] >= cur.startMin * 60 && st.t[i] < cur.endMin * 60) out.push({ u: st.rc[i], v: st.ra[i], w: 1 });
    return out;
  }, [a, cur.startMin, cur.endMin]);
  const track = useMemo(() => a.latlon.t.map((t, i) => [t, i] as const).filter(([t]) => t >= cur.startMin * 60 && t < cur.endMin * 60).map(([, i]) => [a.latlon.lat[i], a.latlon.lon[i]] as [number, number]), [a, cur.startMin, cur.endMin]);

  const gk = a.hints.goalkeeperEnds[k];
  const venue = venues.find((v) => v.name === s.venueName);
  const venueEnd: GoalEnd | null = venue && k === 0 ? (angleDiff(venue.bearing, a.frame.axisBearing) < 90 ? 'a' : 'b') : null;
  const suggestion = gk?.end ?? venueEnd;
  const swapHint = a.hints.swapMin != null && !o.swapsMin.some((m) => Math.abs(m - a.hints.swapMin!) < 3) ? a.hints.swapMin : null;

  return (
    <div className="step">
      <h2>مرماك كان فين؟</h2>
      <p className="muted">دوس على ناحية مرماك.</p>

      <div className="segs">
        {segs.map((sg, i) => (
          <button key={i} className={i === k ? 'on' : ''} onClick={() => setSeg(i)}>
            د {Math.round(sg.startMin)} ← {Math.round(sg.endMin)}{o.ends[i] ? ' ✓' : ''}
          </button>
        ))}
      </div>

      {swapHint != null && (
        <div className="hint">
          <p>مكانك في الملعب اتقلب حوالين الدقيقة <b className="num">{Math.round(swapHint)}</b>. بدّلتوا الجناب ساعتها؟</p>
          <button className="btn" onClick={() => addSwap(Math.round(swapHint * 2) / 2)}>أيوه، ضيف تبديل</button>
        </div>
      )}

      {sat ? (
        <SatellitePicker track={track} ends={a.axisEnds} corners={a.pitchCorners} words={words} chosen={chosen} onPick={pick} onFail={() => { setOffline(true); setSat(false); }} />
      ) : (
        <div className="picker">
          <Pitch topLabel={null} bottomLabel={null} className="picker-pitch">
            <HeatLayer points={pts} color={C.cyan} />
          </Pitch>
          <div className="needle" style={{ transform: `rotate(${-a.frame.axisBearing}deg)` }} aria-label="اتجاه الشمال">
            <svg viewBox="0 0 24 24" width="20" height="20"><path d="M12 2l6 18-6-4-6 4z" fill={C.coral} /></svg><b>ش</b>
          </div>
          {(['a', 'b'] as GoalEnd[]).map((end) => (
            <button key={end} className={`tap ${end === 'a' ? 'top' : 'bottom'} ${chosen === end ? 'on' : ''} ${!chosen && suggestion === end ? 'suggest' : ''}`} onClick={() => pick(end)}>
              {chosen === end ? 'مرماك ✓' : !chosen && suggestion === end ? 'مرماك؟ (اقتراح)' : 'مرماك هنا؟'}<small>ناحية {words[end]}</small>
            </button>
          ))}
        </div>
      )}

      {chosen && <p className="center"><b>مرماك ناحية {words[chosen]}</b>{segs.length > 1 ? ` في الجزء ده (د ${Math.round(cur.startMin)} ← ${Math.round(cur.endMin)})` : ''}</p>}
      {gk && <p className="hint">كنت حارس <b className="num">{fmt(gk.minutes, 0)}</b> دقيقة في الجزء ده، ووقفت ناحية {words[gk.end]}. فغالباً مرماك كان هناك.</p>}
      {!gk && venueEnd && <p className="hint">آخر مرة في «{s.venueName}» كان مرماك ناحية {words[venueEnd]}.</p>}

      {!IN_ARTIFACT && (
        <div className="sat-toggle">
          {offline && <p className="small muted">صورة الملعب محتاجة نت. اختار من رسمة حركتك، والسهم الأحمر بيشاور على الشمال.</p>}
          <button className="btn small" onClick={() => { setOffline(false); setSat(!sat); }}>{sat ? 'استخدم رسمة حركتي' : 'اعرض صورة الملعب'}</button>
        </div>
      )}
      {IN_ARTIFACT && <p className="small muted">السهم الأحمر بيشاور على الشمال.</p>}

      <details className="more" open={o.swapsMin.length > 0}>
        <summary>بدّلتوا الجناب في نص الماتش؟</summary>
        <p className="small muted">ضيف الدقيقة اللي بدّلتوا فيها، والماتش هيتقسم أجزاء. ينفع أكتر من تبديل.</p>
        <div className="ex-add">
          <input type="number" inputMode="decimal" step={0.5} min={1} value={swapInput} onChange={(e) => setSwapInput(e.target.value)} placeholder="في دقيقة" aria-label="دقيقة التبديل" />
          <button className="btn" disabled={swapInput === ''} onClick={() => addSwap(+swapInput)}>ضيف تبديل</button>
        </div>
        {o.swapsMin.map((m, i) => (
          <div key={m} className="ex-item"><i style={{ background: C.gold }} />تبديل في <span className="num">د {fmt(m)}</span>
            <button className="icon-btn" aria-label="شيل" onClick={() => removeSwap(i)}>✕</button></div>
        ))}
      </details>

      <label className="field">اسم الملعب (عشان أفتكر الاتجاه المرة الجاية)
        <input list="venues" value={s.venueName} onChange={(e) => set({ venueName: e.target.value })} placeholder="مثلاً: ملعب النادي" />
        <datalist id="venues">{venues.map((v) => <option key={v.name} value={v.name} />)}</datalist>
      </label>
    </div>
  );
}

function StepDetails({ a, s, set }: StepProps) {
  return (
    <div className="step">
      <h2>شوية تفاصيل</h2>
      <p className="muted">اختياري.</p>
      <label className="field">اسم الماتش<input value={s.label} onChange={(e) => set({ label: e.target.value })} placeholder={a.date} /></label>
      <div className="field">لعبت إيه؟
        <div className="choice">{Object.entries(ROLE_LABEL).map(([k, l]) => <button key={k} className={s.role === k ? 'on' : ''} onClick={() => set({ role: k as MatchSettings['role'] })}>{l}</button>)}</div>
      </div>
      <label className="field">متوسط سن الخصم تقريباً<input type="number" inputMode="numeric" min={10} max={70} value={s.opponentAge ?? ''} onChange={(e) => set({ opponentAge: e.target.value === '' ? null : +e.target.value })} placeholder="مثلاً 30" /></label>
    </div>
  );
}
