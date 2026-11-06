// SVG charts. d3 is used for scales, shapes, density contours and zoom; React
// renders the markup. Time axes run left-to-right inside the RTL UI.

import * as d3 from 'd3';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { Sprint } from '../analysis/types';
import { ATT, C, DEF, fmt, minLabel } from './format';
import { useTip } from './Card';

const FONT = 'Alexandria, sans-serif';

// ---------- Pitch ----------
const PW = 200, PH = 400, PAD = 14, LABEL = 22;
export const px = (u: number) => PAD + u * PW;
export const py = (v: number) => PAD + LABEL + (1 - v) * PH;

export function Pitch({ children, topLabel = 'مرمى الخصم', bottomLabel = 'مرماك', className = '' }: {
  children?: React.ReactNode; topLabel?: string | null; bottomLabel?: string | null; className?: string;
}) {
  const top = PAD + LABEL, bottom = top + PH, cx = PAD + PW / 2;
  const area = (atTop: boolean) => {
    const y0 = atTop ? top : bottom, s = atTop ? 1 : -1, r = 60;
    return `M ${cx - 15 - r} ${y0} A ${r} ${r} 0 0 ${atTop ? 0 : 1} ${cx - 15} ${y0 + s * r} L ${cx + 15} ${y0 + s * r} A ${r} ${r} 0 0 ${atTop ? 0 : 1} ${cx + 15 + r} ${y0}`;
  };
  const H = PH + PAD * 2 + LABEL * 2;
  return (
    <svg className={`chart pitch ${className}`} viewBox={`0 0 ${PW + PAD * 2} ${H}`} role="img" aria-label="ملعب">
      <rect width={PW + PAD * 2} height={H} fill={C.card} />
      <rect x={PAD} y={top} width={PW} height={PH} fill={C.pitch} rx={6} />
      <g fill="none" stroke={C.pitchLine} strokeWidth={1.6}>
        <rect x={PAD} y={top} width={PW} height={PH} rx={6} />
        <line x1={PAD} x2={PAD + PW} y1={top + PH / 2} y2={top + PH / 2} />
        <circle cx={cx} cy={top + PH / 2} r={30} />
        <path d={area(true)} /><path d={area(false)} />
      </g>
      <rect x={cx - 16} y={top - 5} width={32} height={5} rx={1} fill={C.muted} />
      <rect x={cx - 16} y={bottom} width={32} height={5} rx={1} fill={C.lime} />
      {children}
      <g fontFamily={FONT} fontSize={12} textAnchor="middle">
        {topLabel && <text x={cx} y={PAD + 8} fill={C.muted}>{topLabel}</text>}
        {bottomLabel && <text x={cx} y={H - 8} fill={C.lime} fontWeight={600}>{bottomLabel}</text>}
      </g>
    </svg>
  );
}

export function densityPaths(points: { u: number; v: number; w: number }[]) {
  if (points.length < 5) return { contours: [] as d3.ContourMultiPolygon[], max: 1 };
  const contours = d3.contourDensity<{ u: number; v: number; w: number }>()
    .x((p) => px(p.u)).y((p) => py(p.v)).weight((p) => p.w)
    .size([PW + PAD * 2, PH + PAD * 2 + LABEL * 2]).bandwidth(13).thresholds(10)(points);
  return { contours, max: d3.max(contours, (c) => c.value) ?? 1 };
}

export function HeatLayer({ points, color = C.lime }: { points: { u: number; v: number; w: number }[]; color?: string }) {
  const { contours, max } = useMemo(() => densityPaths(points), [points]);
  return (
    <g>{contours.map((c, i) => <path key={i} d={d3.geoPath()(c) ?? ''} fill={color} fillOpacity={0.06 + 0.5 * (c.value / max) ** 1.3} />)}</g>
  );
}

export function GridLayer({ pct, count }: { pct: number[][]; count: number[][] }) {
  const max = Math.max(1, ...pct.flat());
  const cw = PW / 3, ch = PH / 3, top = PAD + LABEL;
  return (
    <g>
      {pct.map((row, r) => row.map((p, c) => {
        const x = PAD + c * cw, y = top + (2 - r) * ch, best = p === max && p > 0;
        return (
          <g key={`${r}${c}`}>
            <rect x={x + 2} y={y + 2} width={cw - 4} height={ch - 4} rx={8} fill={C.lime} fillOpacity={0.05 + 0.55 * (p / max)} />
            <text x={x + cw / 2} y={y + ch / 2 + 4} textAnchor="middle" fontFamily={FONT} fontSize={best ? 26 : 20} fontWeight={best ? 800 : 600} fill={C.text}>{p.toFixed(0)}%</text>
            <text x={x + cw / 2} y={y + ch / 2 + 22} textAnchor="middle" fontFamily={FONT} fontSize={10} fill={C.text} fillOpacity={0.55}>{Math.round(count[r][c])}</text>
          </g>
        );
      }))}
    </g>
  );
}

export function ArrowLayer({ sprints, color, highlight, onPick, label }: {
  sprints: Sprint[]; color: string; highlight?: Sprint | null; onPick?: (s: Sprint) => void; label: (s: Sprint) => string;
}) {
  const tip = useTip();
  const id = useMemo(() => `ah${Math.random().toString(36).slice(2, 7)}`, []);
  return (
    <g>
      <defs>
        <marker id={id} viewBox="0 0 10 10" refX="6" refY="5" markerWidth="4" markerHeight="4" orient="auto-start-reverse"><path d="M0 0 L10 5 L0 10 z" fill={color} /></marker>
        <marker id={`${id}h`} viewBox="0 0 10 10" refX="6" refY="5" markerWidth="4" markerHeight="4" orient="auto-start-reverse"><path d="M0 0 L10 5 L0 10 z" fill={C.gold} /></marker>
      </defs>
      {sprints.map((s) => {
        const hi = s === highlight;
        return (
          <g key={`${s.matchId}-${s.index}`} className="arrow" onClick={() => onPick?.(s)}
            onMouseMove={(e) => tip(e, <div><b>{label(s)} · دقيقة {minLabel(s.startMin)}</b><br />{fmt(s.maxSpeed)} كم/س · {fmt(s.distanceM, 0)} متر</div>)}
            onMouseLeave={() => tip(null)}>
            <line x1={px(s.startN.u)} y1={py(s.startN.v)} x2={px(s.endN.u)} y2={py(s.endN.v)} stroke="transparent" strokeWidth={14} />
            <line x1={px(s.startN.u)} y1={py(s.startN.v)} x2={px(s.endN.u)} y2={py(s.endN.v)}
              stroke={hi ? C.gold : color} strokeWidth={hi ? 4 : 2.6} strokeOpacity={hi ? 1 : 0.75} strokeLinecap="round" markerEnd={`url(#${hi ? id + 'h' : id})`} />
          </g>
        );
      })}
    </g>
  );
}

export function TrailReplay({ samples }: { samples: { t: number[]; u: number[]; v: number[] } }) {
  const n = samples.t.length;
  const [i, setI] = useState(0);
  const [playing, setPlaying] = useState(false);
  useEffect(() => {
    if (!playing) return;
    const h = setInterval(() => setI((k) => { if (k >= n - 1) { setPlaying(false); return k; } return Math.min(n - 1, k + 5); }), 50);
    return () => clearInterval(h);
  }, [playing, n]);
  const from = Math.max(0, i - 60);
  const path = d3.line<number>().x((k) => px(samples.u[k])).y((k) => py(samples.v[k])).curve(d3.curveCatmullRom)(d3.range(from, i + 1)) ?? '';
  return (
    <div>
      <Pitch>
        <path d={path} fill="none" stroke={C.cyan} strokeWidth={3} strokeOpacity={0.9} strokeLinecap="round" />
        {n > 0 && <circle cx={px(samples.u[i])} cy={py(samples.v[i])} r={7} fill={C.lime} stroke={C.bg} strokeWidth={2} />}
      </Pitch>
      <div className="scrubber no-print">
        <button className="btn primary round" onClick={() => { if (i >= n - 1) setI(0); setPlaying(!playing); }} aria-label={playing ? 'إيقاف' : 'تشغيل'}>
          {playing ? <svg viewBox="0 0 24 24" width="18" height="18"><rect x="6" y="5" width="4" height="14" fill="currentColor" /><rect x="14" y="5" width="4" height="14" fill="currentColor" /></svg>
            : <svg viewBox="0 0 24 24" width="18" height="18"><path d="M7 5v14l12-7z" fill="currentColor" /></svg>}
        </button>
        <input type="range" dir="ltr" min={0} max={Math.max(0, n - 1)} value={i} onChange={(e) => { setPlaying(false); setI(+e.target.value); }} aria-label="الوقت" />
        <span className="num">{n ? minLabel(samples.t[i] / 60) : '—'}</span>
      </div>
    </div>
  );
}

// ---------- Generic charts ----------
export function Bars({ labels, values, color = C.cyan, unit = '', height = 200, highlight, digits }: {
  labels: string[]; values: number[]; color?: string | string[]; unit?: string; height?: number; highlight?: number; digits?: number;
}) {
  const tip = useTip();
  const W = 360, H = height, m = { t: 22, r: 6, b: 30, l: 6 };
  const x = d3.scaleBand().domain(labels.map((_, i) => String(i))).range([m.l, W - m.r]).padding(0.22);
  const y = d3.scaleLinear().domain([0, Math.max(1e-9, d3.max(values) ?? 1)]).range([H - m.b, m.t]);
  const d = (v: number) => fmt(v, digits ?? (Number.isInteger(v) ? 0 : 1));
  return (
    <svg className="chart" viewBox={`0 0 ${W} ${H}`} direction="ltr">
      <rect width={W} height={H} fill={C.card} />
      <line x1={m.l} x2={W - m.r} y1={y(0)} y2={y(0)} stroke={C.line} />
      {values.map((v, i) => {
        const xi = x(String(i)) ?? 0, dim = highlight != null && highlight !== i;
        return (
          <g key={i} onMouseMove={(e) => tip(e, <span>{labels[i]}: <b className="num">{d(v)}</b> {unit}</span>)} onMouseLeave={() => tip(null)}>
            <rect x={xi} y={y(v)} width={x.bandwidth()} height={Math.max(0, y(0) - y(v))} rx={Math.min(8, x.bandwidth() / 2)}
              fill={Array.isArray(color) ? color[i % color.length] : color} fillOpacity={dim ? 0.35 : 1} />
            {v > 0 && x.bandwidth() > 16 && <text x={xi + x.bandwidth() / 2} y={y(v) - 6} textAnchor="middle" fontSize={11} fontWeight={600} fontFamily={FONT} fill={dim ? C.muted : C.text}>{d(v)}</text>}
            <text x={xi + x.bandwidth() / 2} y={H - 10} textAnchor="middle" fontSize={labels.length > 8 ? 8.5 : 11} fontFamily={FONT} fill={C.muted}>{labels[i]}</text>
          </g>
        );
      })}
    </svg>
  );
}

/** Horizontal share bar with direct labels. */
export function ShareBar({ parts }: { parts: { label: string; value: number; color: string }[] }) {
  const total = d3.sum(parts, (p) => p.value) || 1;
  return (
    <div className="share">
      <div className="share-bar">{parts.map((p) => <i key={p.label} style={{ flexGrow: p.value, background: p.color }} title={`${p.label}: ${Math.round((100 * p.value) / total)}%`} />)}</div>
      <ul className="share-legend">
        {parts.map((p) => <li key={p.label}><i style={{ background: p.color }} /><span>{p.label}</span><b className="num">{Math.round((100 * p.value) / total)}%</b></li>)}
      </ul>
    </div>
  );
}

export function SpeedTimeline({ min, speed, excluded, sprints, sprintThreshold }: {
  min: number[]; speed: number[]; excluded: boolean[]; sprints: Sprint[]; sprintThreshold: number;
}) {
  const tip = useTip();
  const ref = useRef<SVGSVGElement>(null);
  const W = 440, H = 230, m = { t: 14, r: 8, b: 28, l: 24 };
  const base = useMemo(() => d3.scaleLinear().domain([0, d3.max(min) ?? 1]).range([m.l, W - m.r]), [min]);
  const [k, setK] = useState<d3.ZoomTransform>(d3.zoomIdentity);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const z = d3.zoom<SVGSVGElement, unknown>().scaleExtent([1, 20])
      .translateExtent([[m.l, 0], [W - m.r, H]]).extent([[m.l, 0], [W - m.r, H]])
      .on('zoom', (e) => setK(e.transform));
    d3.select(el).call(z);
    return () => { d3.select(el).on('.zoom', null); };
  }, []);
  const x = k.rescaleX(base);
  // Smooth with a 5 s rolling mean so the line reads as effort, not noise.
  const smooth = useMemo(() => speed.map((_, i) => { let s = 0, c = 0; for (let j = Math.max(0, i - 2); j <= Math.min(speed.length - 1, i + 2); j++) { s += speed[j]; c++; } return s / c; }), [speed]);
  const ys = d3.scaleLinear().domain([0, Math.max(10, d3.max(speed) ?? 10)]).nice().range([H - m.b, m.t]);
  const step = Math.max(1, Math.floor(min.length / 1200 / k.k));
  const idx = d3.range(0, min.length, step);
  const area = d3.area<number>().x((i) => x(min[i])).y0(ys(0)).y1((i) => ys(smooth[i]))(idx) ?? '';
  const exRuns: [number, number][] = [];
  excluded.forEach((e, i) => { if (e && (i === 0 || !excluded[i - 1])) exRuns.push([min[i], min[i]]); if (e) exRuns[exRuns.length - 1][1] = min[i]; });
  const clip = useMemo(() => `tl${Math.random().toString(36).slice(2, 7)}`, []);
  return (
    <svg ref={ref} className="chart timeline" viewBox={`0 0 ${W} ${H}`} direction="ltr"
      onMouseMove={(e) => {
        const r = ref.current!.getBoundingClientRect();
        const i = d3.bisector((d: number) => d).center(min, x.invert(((e.clientX - r.left) / r.width) * W));
        if (i >= 0 && i < min.length) tip(e, <span className="num">د {minLabel(min[i])} · {fmt(speed[i])} كم/س</span>);
      }}
      onMouseLeave={() => tip(null)}>
      <defs>
        <clipPath id={clip}><rect x={m.l} y={0} width={W - m.l - m.r} height={H} /></clipPath>
        <linearGradient id={`${clip}g`} x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor={C.cyan} stopOpacity={0.55} /><stop offset="1" stopColor={C.cyan} stopOpacity={0.05} /></linearGradient>
      </defs>
      <rect width={W} height={H} fill={C.card} />
      {ys.ticks(3).map((tk) => <text key={tk} x={m.l - 6} y={ys(tk) + 4} fontSize={11} textAnchor="end" fontFamily={FONT} fill={C.muted}>{tk}</text>)}
      <g clipPath={`url(#${clip})`}>
        {exRuns.map(([a, b], i) => <rect key={i} x={x(a)} width={Math.max(1, x(b) - x(a))} y={m.t} height={H - m.b - m.t} fill={C.muted} fillOpacity={0.12} />)}
        <path d={area} fill={`url(#${clip}g)`} stroke={C.cyan} strokeWidth={1.4} />
        <line x1={m.l} x2={W - m.r} y1={ys(sprintThreshold)} y2={ys(sprintThreshold)} stroke={C.lime} strokeDasharray="5 5" strokeOpacity={0.7} />
        {sprints.map((s) => <circle key={s.index} cx={x(s.startMin)} cy={ys(s.maxSpeed)} r={4.5} fill={s.direction === 'attack' ? ATT : DEF} stroke={C.card} strokeWidth={1.5} />)}
      </g>
      {x.ticks(5).map((tk) => <text key={tk} x={x(tk)} y={H - 8} fontSize={11} textAnchor="middle" fontFamily={FONT} fill={C.muted}>{tk}′</text>)}
    </svg>
  );
}

/** One value per match, oldest → newest, selected match highlighted. */
export function Trend({ labels, values, selected, unit, digits = 1 }: { labels: string[]; values: (number | null)[]; selected?: number; unit: string; digits?: number }) {
  const tip = useTip();
  const W = 360, H = 190, m = { t: 26, r: 18, b: 30, l: 18 };
  const vals = values.map((v) => v ?? NaN);
  const x = d3.scalePoint<number>().domain(d3.range(values.length)).range([m.l, W - m.r]).padding(0.3);
  const ext = d3.extent(vals.filter(Number.isFinite)) as [number, number];
  const pad = ((ext[1] ?? 1) - (ext[0] ?? 0)) * 0.25 || 1;
  const y = d3.scaleLinear().domain([(ext[0] ?? 0) - pad, (ext[1] ?? 1) + pad]).range([H - m.b, m.t]);
  const avg = d3.mean(vals.filter(Number.isFinite)) ?? 0;
  const line = d3.line<number>().defined((v) => Number.isFinite(v)).x((_, i) => x(i) ?? 0).y((v) => y(v))(vals) ?? '';
  return (
    <svg className="chart" viewBox={`0 0 ${W} ${H}`} direction="ltr">
      <rect width={W} height={H} fill={C.card} />
      <line x1={m.l} x2={W - m.r} y1={y(avg)} y2={y(avg)} stroke={C.muted} strokeDasharray="4 4" strokeOpacity={0.6} />
      <text x={W - m.r} y={y(avg) - 5} textAnchor="end" fontSize={10} fontFamily={FONT} fill={C.muted}>متوسطك {fmt(avg, digits)}</text>
      <path d={line} fill="none" stroke={C.lime} strokeWidth={2.4} strokeLinejoin="round" />
      {vals.map((v, i) => Number.isFinite(v) && (
        <g key={i} onMouseMove={(e) => tip(e, <span>{labels[i]}: <b className="num">{fmt(v, digits)}</b> {unit}</span>)} onMouseLeave={() => tip(null)}>
          <circle cx={x(i)} cy={y(v)} r={i === selected ? 7 : 4.5} fill={i === selected ? C.lime : C.card} stroke={C.lime} strokeWidth={2.2} />
          {(i === selected || values.length <= 8) && <text x={x(i)} y={y(v) - 11} textAnchor="middle" fontSize={i === selected ? 13 : 10.5} fontWeight={i === selected ? 700 : 400} fontFamily={FONT} fill={i === selected ? C.text : C.muted}>{fmt(v, digits)}</text>}
          <text x={x(i)} y={H - 9} textAnchor="middle" fontSize={values.length > 8 ? 8.5 : 10.5} fontFamily={FONT} fill={i === selected ? C.lime : C.muted}>{labels[i]}</text>
        </g>
      ))}
    </svg>
  );
}
