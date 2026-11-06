import { createContext, useContext, useRef, useState, type ReactNode } from 'react';
import { svgToPng } from './exporters';
import { IN_ARTIFACT } from '../env';

interface CardProps {
  title: string;
  /** One plain sentence under the title: what the chart says. */
  lead?: ReactNode;
  /** Sample size, e.g. "34 سبرينت · 4 ماتش". */
  n?: string;
  /** Mark small samples visually. */
  small?: boolean;
  caveat?: string;
  className?: string;
  children: ReactNode;
  actions?: ReactNode;
}

export function Card({ title, lead, n, small, caveat, className, children, actions }: CardProps) {
  const ref = useRef<HTMLElement>(null);
  const savePng = () => {
    const svg = ref.current?.querySelector('svg.chart') as SVGSVGElement | null;
    if (svg) svgToPng(svg, `${title.replace(/\s+/g, '-')}.png`);
  };
  return (
    <section ref={ref} className={`card ${className ?? ''}`}>
      <header className="card-head">
        <div>
          <h3>{title}</h3>
          {lead && <p className="lead">{lead}</p>}
        </div>
        <div className="card-tools">
          {actions}
          {!IN_ARTIFACT && <button className="icon-btn no-print" onClick={savePng} title="حفظ الرسمة كصورة" aria-label="حفظ الرسمة كصورة">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M12 4v11m0 0l-4-4m4 4l4-4M5 19h14" /></svg>
          </button>}
        </div>
      </header>
      {children}
      {(n || caveat) && (
        <footer className="card-foot">
          {n && <span className={`n-badge ${small ? 'small' : ''}`} title={small ? 'العينة صغيرة: متبنيش عليها استنتاج' : 'حجم العينة'}>{small ? 'عينة صغيرة · ' : ''}{n}</span>}
          {caveat && <span className="caveat">{caveat}</span>}
        </footer>
      )}
    </section>
  );
}

// Tooltip shared by all charts.
type TipFn = (e: { clientX: number; clientY: number } | null, content?: ReactNode) => void;
const TipCtx = createContext<TipFn>(() => {});
export const useTip = () => useContext(TipCtx);

export function TipProvider({ children }: { children: ReactNode }) {
  const [tip, setTip] = useState<{ x: number; y: number; content: ReactNode } | null>(null);
  const show: TipFn = (e, content) => setTip(e ? { x: e.clientX, y: e.clientY, content } : null);
  return (
    <TipCtx.Provider value={show}>
      {children}
      {tip && (
        <div className="tooltip" style={{ left: Math.min(tip.x + 12, window.innerWidth - 230), top: tip.y + 14 }}>
          {tip.content}
        </div>
      )}
    </TipCtx.Provider>
  );
}

/** Big number tile with a plain-language explanation underneath. */
export function Stat({ label, value, unit, explain, color }: { label: string; value: string; unit?: string; explain?: string; color?: string }) {
  return (
    <div className="stat">
      <span className="stat-label">{label}</span>
      <span className="stat-value num" style={color ? { color } : undefined}>{value}</span>
      {unit && <span className="stat-unit">{unit}</span>}
      {explain && <span className="stat-explain">{explain}</span>}
    </div>
  );
}
