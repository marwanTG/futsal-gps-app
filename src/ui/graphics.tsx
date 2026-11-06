// Visual summary widgets for the match screen: ring, speed gauge, fatigue
// batteries, attack/defense mini pitch. Numbers are shown as shapes first.

import * as d3 from 'd3';
import type { ReactNode } from 'react';
import { ATT, C, DEF } from './format';

const FONT = 'Alexandria, sans-serif';

/** Ring filled by value/max, big number inside. */
export function Ring({ value, max, label, display, unit, color, icon }: {
  value: number; max: number; label: string; display: string; unit: string; color: string; icon?: ReactNode;
}) {
  const r = 42, c = 2 * Math.PI * r, f = Math.max(0, Math.min(1, max ? value / max : 0));
  return (
    <div className="ring">
      <svg viewBox="0 0 100 100" className="chart" role="img" aria-label={`${label} ${display} ${unit}`}>
        <rect width="100" height="100" fill={C.card} />
        <circle cx="50" cy="50" r={r} fill="none" stroke={C.card2} strokeWidth="9" />
        <circle cx="50" cy="50" r={r} fill="none" stroke={color} strokeWidth="9" strokeLinecap="round"
          strokeDasharray={`${c * f} ${c}`} transform="rotate(-90 50 50)" />
        <text x="50" y="52" textAnchor="middle" fontFamily={FONT} fontWeight={800} fontSize={display.length > 4 ? 17 : 22} fill={C.text}>{display}</text>
        <text x="50" y="67" textAnchor="middle" fontFamily={FONT} fontSize="9" fill={C.muted}>{unit}</text>
      </svg>
      <span className="ring-label">{icon}{label}</span>
    </div>
  );
}

/** Semicircle speedometer 0..maxScale km/h with the sprint threshold marked. */
export function SpeedGauge({ value, threshold, maxScale = 20 }: { value: number; threshold: number; maxScale?: number }) {
  const a = d3.scaleLinear().domain([0, maxScale]).range([-Math.PI / 2, Math.PI / 2]).clamp(true);
  const arc = d3.arc<{ s: number; e: number }>().innerRadius(62).outerRadius(78).startAngle((d) => d.s).endAngle((d) => d.e).cornerRadius(6);
  const ang = a(value);
  const tx = (ang0: number, rad: number) => [Math.sin(ang0) * rad, -Math.cos(ang0) * rad];
  const [nx, ny] = tx(ang, 56);
  const [sx, sy] = tx(a(threshold), 88);
  return (
    <svg viewBox="-100 -96 200 150" className="chart gauge" role="img" aria-label={`أقصى سرعة ${value.toFixed(1)} كم/س`}>
      <rect x="-100" y="-96" width="200" height="150" fill={C.card} />
      <path d={arc({ s: -Math.PI / 2, e: Math.PI / 2 }) ?? ''} fill={C.card2} />
      <path d={arc({ s: -Math.PI / 2, e: ang }) ?? ''} fill={C.cyan} />
      <line x1="0" y1="0" x2={nx} y2={ny} stroke={C.text} strokeWidth="4" strokeLinecap="round" />
      <circle r="7" fill={C.text} />
      <text x={sx} y={sy} textAnchor="middle" fontSize="9" fontFamily={FONT} fill={C.lime}>سبرينت</text>
      <text x="-70" y="14" textAnchor="middle" fontFamily={FONT} fontSize="9" fill={C.muted}>0</text>
      <text x="70" y="14" textAnchor="middle" fontFamily={FONT} fontSize="9" fill={C.muted}>{maxScale}</text>
      <text x="0" y="38" textAnchor="middle" fontFamily={FONT} fontWeight={800} fontSize="28" fill={C.text}>{value.toFixed(1)}</text>
      <text x="0" y="51" textAnchor="middle" fontFamily={FONT} fontSize="10" fill={C.muted}>كم/س</text>
    </svg>
  );
}

/** Three batteries: sprint rate in each third of playing time. */
export function Batteries({ values }: { values: number[] }) {
  const max = Math.max(1e-9, ...values);
  const labels = ['أول الماتش', 'النص', 'آخره'];
  return (
    <div className="batteries" role="img" aria-label={`سبرينت في الساعة: ${values.map((v) => v.toFixed(0)).join('، ')}`}>
      {values.map((v, i) => {
        const f = v / max;
        const color = f > 0.8 ? C.lime : f > 0.55 ? C.gold : C.coral;
        return (
          <div key={i} className="battery">
            <svg viewBox="0 0 40 70" className="chart">
              <rect width="40" height="70" fill={C.card} />
              <rect x="14" y="2" width="12" height="5" rx="2" fill={C.line} />
              <rect x="4" y="7" width="32" height="60" rx="7" fill="none" stroke={C.line} strokeWidth="3" />
              <rect x="9" y={12 + 50 * (1 - f)} width="22" height={50 * f} rx="4" fill={color} />
            </svg>
            <b className="num">{v.toFixed(0)}</b>
            <span>{labels[i]}</span>
          </div>
        );
      })}
    </div>
  );
}

/** Mini pitch with one big arrow up (attack) and one down (defense), sized by count. */
export function AttackDefense({ attack, defense, confirmed }: { attack: number; defense: number; confirmed: boolean }) {
  const total = Math.max(1, attack + defense);
  const w = (n: number) => 10 + 26 * (n / total);
  return (
    <svg viewBox="0 0 200 150" className="chart" role="img" aria-label={`هجوم ${attack}، دفاع ${defense}`}>
      <rect width="200" height="150" fill={C.card} />
      <rect x="10" y="8" width="180" height="134" rx="10" fill={C.pitch} />
      <g fill="none" stroke={C.pitchLine} strokeWidth="1.5"><line x1="10" y1="75" x2="190" y2="75" /><circle cx="100" cy="75" r="18" /></g>
      <rect x="84" y="4" width="32" height="5" rx="1" fill={C.muted} />
      <rect x="84" y="141" width="32" height="5" rx="1" fill={C.lime} />
      <g opacity={confirmed ? 1 : 0.45}>
        <path d={`M60 128 V40`} stroke={ATT} strokeWidth={w(attack)} strokeLinecap="round" />
        <path d="M60 18 L40 46 H80 Z" fill={ATT} />
        <path d={`M140 22 V110`} stroke={DEF} strokeWidth={w(defense)} strokeLinecap="round" />
        <path d="M140 132 L120 104 H160 Z" fill={DEF} />
      </g>
      <text x="60" y="92" textAnchor="middle" fontFamily={FONT} fontWeight={800} fontSize="26" fill={C.bg}>{attack}</text>
      <text x="140" y="72" textAnchor="middle" fontFamily={FONT} fontWeight={800} fontSize="26" fill={C.bg}>{defense}</text>
    </svg>
  );
}
