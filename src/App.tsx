import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { analyzeMatch } from './analysis/analyze';
import { parseGpx } from './analysis/parse';
import { DEFAULT_THRESHOLDS, emptyOrientation, type MatchSettings, type ParsedTrack, type PlayerProfile, type Sprint, type Thresholds } from './analysis/types';
import { store, type Venue } from './store';
import { TipProvider } from './ui/Card';
import { Ctx, sprintKey, type AppCtx } from './ui/ctx';
import { dayLabel } from './ui/format';
import { exportJson } from './ui/exporters';
import { Field } from './ui/screens/Field';
import { MatchView } from './ui/screens/Match';
import { Mine } from './ui/screens/Mine';
import { Progress } from './ui/screens/Progress';
import { Wizard } from './ui/screens/Setup';
import { Icon } from './ui/icons';
import { SprintList } from './ui/screens/Sprints';

const I = (d: string) => <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d={d} /></svg>;
const TABS: { id: TabId; label: string; icon: ReactNode }[] = [
  { id: 'match', label: 'الماتش', icon: I('M4 19V9m5 10V5m5 14v-7m5 7V8') },
  { id: 'field', label: 'الملعب', icon: I('M4 4h16v16H4zM4 12h16M12 4v16') },
  { id: 'sprints', label: 'السبرينتات', icon: I('M13 3L5 14h6l-1 7 8-11h-6z') },
  { id: 'progress', label: 'تطوري', icon: I('M3 17l6-6 4 4 8-8M15 7h6v6') },
  { id: 'mine', label: 'ماتشاتي', icon: I('M4 6h16M4 12h16M4 18h10') },
];
type TabId = 'match' | 'field' | 'sprints' | 'progress' | 'mine';

const DEFAULT_PROFILE: PlayerProfile = { age: null, heightCm: null, weightKg: null, hrMaxOverride: null, healthNotes: '' };

function defaultSettings(t: ParsedTrack): MatchSettings {
  const d = new Date(t.startTime);
  return {
    label: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`,
    venueName: '', orientation: emptyOrientation(), role: 'field', opponentAge: null, trimEndMin: null, exclusions: [], dismissedCandidates: [],
  };
}

/** Merge stored settings with defaults (older saves had a compass-bearing model). */
function migrate(t: ParsedTrack, stored?: Partial<MatchSettings>): MatchSettings {
  const s = { ...defaultSettings(t), ...stored };
  const o = s.orientation ?? emptyOrientation();
  const ends = [...o.ends];
  while (ends.length < o.swapsMin.length + 1) ends.push(null);
  s.orientation = { swapsMin: [...o.swapsMin], ends: ends.slice(0, o.swapsMin.length + 1) };
  return s;
}

function readTab(): TabId {
  try { const v = localStorage.getItem('tab2'); if (TABS.some((t) => t.id === v)) return v as TabId; } catch { /* ignore */ }
  return 'mine';
}

export default function App() {
  const [tracks, setTracks] = useState<ParsedTrack[]>([]);
  const [settings, setSettings] = useState<Record<string, MatchSettings>>({});
  const [thresholds, setThresholdsState] = useState<Thresholds>(DEFAULT_THRESHOLDS);
  const [profile, setProfileState] = useState<PlayerProfile>(DEFAULT_PROFILE);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [tab, setTabState] = useState<TabId>(readTab);
  const [includeUnconfirmed, setIncludeUnconfirmed] = useState(false);
  const [highlightSprint, setHighlight] = useState<string | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [presenting, setPresenting] = useState(false);
  const [wizardId, setWizardId] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const setTab = (t: TabId) => { setTabState(t); window.scrollTo({ top: 0 }); try { localStorage.setItem('tab2', t); } catch { /* ignore */ } };

  useEffect(() => {
    (async () => {
      const [tr, st, th, pr] = await Promise.all([store.loadTracks(), store.loadSettings(), store.getMeta<Thresholds>('thresholds'), store.getMeta<PlayerProfile>('profile')]);
      tr.sort((a, b) => a.startTime - b.startTime);
      setTracks(tr);
      setSettings(Object.fromEntries(tr.map((t) => [t.id, migrate(t, st[t.id])])));
      if (th) setThresholdsState({ ...DEFAULT_THRESHOLDS, ...th });
      if (pr) setProfileState({ ...DEFAULT_PROFILE, ...pr });
      setSelectedId(tr.length ? tr[tr.length - 1].id : null);
      if (!tr.length || readTab() === 'mine') setTabState('match');
      setLoaded(true);
    })();
  }, []);

  const setSetting = useCallback((id: string, patch: Partial<MatchSettings>) => {
    setSettings((prev) => {
      const next = { ...prev[id], ...patch };
      store.saveSettings(id, next);
      return { ...prev, [id]: next };
    });
  }, []);

  const addFiles = useCallback(async (files: File[]) => {
    const errs: string[] = [];
    const added: ParsedTrack[] = [];
    for (const f of files) {
      try {
        const t = parseGpx(await f.text(), f.name);
        if (tracks.some((x) => x.id === t.id) || added.some((x) => x.id === t.id)) continue;
        added.push(t);
      } catch (e) { errs.push((e as Error).message); }
    }
    setErrors(errs);
    if (!added.length) return;
    for (const t of added) { await store.saveTrack(t); await store.saveSettings(t.id, defaultSettings(t)); }
    setSettings((prev) => ({ ...prev, ...Object.fromEntries(added.map((t) => [t.id, defaultSettings(t)])) }));
    setTracks((prev) => [...prev, ...added].sort((a, b) => a.startTime - b.startTime));
    setSelectedId(added[added.length - 1].id);
    if (added.length === 1) setWizardId(added[0].id);
  }, [tracks]);

  const removeTrack = useCallback((id: string) => {
    store.deleteTrack(id);
    setTracks((prev) => prev.filter((t) => t.id !== id));
    setSelectedId((cur) => (cur === id ? null : cur));
  }, []);

  const hrRef = useMemo(() => {
    if (profile.hrMaxOverride) return profile.hrMaxOverride;
    let m = 0;
    for (const t of tracks) for (const p of t.points) if (p.hr && p.hr > m) m = p.hr;
    return m || null;
  }, [tracks, profile.hrMaxOverride]);

  const analyses = useMemo(
    () => tracks.filter((t) => settings[t.id]).map((t) => analyzeMatch(t, settings[t.id], thresholds, hrRef)),
    [tracks, settings, thresholds, hrRef],
  );
  const selected = analyses.find((a) => a.id === selectedId) ?? analyses[analyses.length - 1] ?? null;
  const dirMatches = analyses.filter((a) => includeUnconfirmed || a.orientationConfirmed);

  const venues = useMemo(() => {
    const map = new Map<string, Venue>();
    for (const a of analyses) {
      const s = settings[a.id], seg = a.frame.segments[0];
      if (s?.venueName && seg?.end) map.set(s.venueName, { name: s.venueName, bearing: seg.ownGoalBearing });
    }
    return [...map.values()];
  }, [analyses, settings]);

  const ctx: AppCtx = {
    tracks, settings, setSetting, analyses, selected, selectedId: selected?.id ?? null, setSelectedId,
    thresholds, setThresholds: (t) => { setThresholdsState(t); store.setMeta('thresholds', t); },
    profile, setProfile: (p) => { setProfileState(p); store.setMeta('profile', p); },
    venues, includeUnconfirmed, setIncludeUnconfirmed, dirMatches,
    openSprint: (s: Sprint) => { setHighlight(sprintKey(s)); setTab('sprints'); },
    highlightSprint, addFiles, removeTrack,
    openWizard: setWizardId,
    goMatches: () => setTab('mine'),
    goField: () => setTab('field'),
    pickFiles: () => fileInput.current?.click(),
  };

  const exportAll = () => exportJson({
    exportedAt: new Date().toISOString(), thresholds, profile: { ...profile, healthNotes: undefined },
    matches: analyses.map(({ samples: _s, timeline: _t, axisSamples: _a, latlon: _l, ...rest }) => ({ ...rest, settings: settings[rest.id] })),
  }, 'futsal-analysis.json');

  const screen = {
    match: <MatchView />, field: <Field />, sprints: <SprintList />, progress: <Progress />,
    mine: <Mine onExportJson={exportAll} onPresent={() => { setTab('match'); setPresenting(true); }} />,
  }[tab];

  return (
    <Ctx.Provider value={ctx}>
      <TipProvider>
        <div className={`app ${presenting ? 'presenting' : ''}`}>
          <header className="top no-print">
            <h1><span className="logo">{Icon.bolt(18)}</span>تحليل الخماسي</h1>
            {analyses.length > 0 && tab !== 'mine' && (
              <label className="match-pick">
                <span className="sr">الماتش</span>
                <select value={selected?.id ?? ''} onChange={(e) => setSelectedId(e.target.value)}>
                  {[...analyses].reverse().map((a) => <option key={a.id} value={a.id}>{dayLabel(a.date, a.weekday)}</option>)}
                </select>
              </label>
            )}
          </header>
          {errors.length > 0 && <div className="banner warn">{errors.join(' · ')}</div>}
          <main>{loaded ? screen : <div className="skeleton" />}</main>
          <nav className="bottom-nav no-print" aria-label="التنقل">
            {TABS.map((t) => (
              <button key={t.id} className={tab === t.id ? 'on' : ''} aria-current={tab === t.id ? 'page' : undefined} onClick={() => setTab(t.id)}>
                {t.icon}<span>{t.label}</span>
              </button>
            ))}
          </nav>
          <input ref={fileInput} type="file" multiple hidden
            onChange={(e) => { const f = e.target.files; if (f?.length) addFiles([...f]); e.target.value = ''; }} />
          {analyses.length > 0 && !presenting && (
            <button className="fab no-print" onClick={() => fileInput.current?.click()} aria-label="ارفع ماتش">{Icon.plus(30)}</button>
          )}
          {wizardId && <Wizard id={wizardId} onClose={() => { setWizardId(null); setTab('match'); }} />}
          {presenting && <Present onExit={() => setPresenting(false)} />}
        </div>
      </TipProvider>
    </Ctx.Provider>
  );
}

function Present({ onExit }: { onExit: () => void }) {
  const [i, setI] = useState(0);
  const [count, setCount] = useState(0);
  useEffect(() => {
    const cards = [...document.querySelectorAll('main .card')];
    setCount(cards.length);
    cards.forEach((c, k) => c.classList.toggle('slide-on', k === i));
    return () => cards.forEach((c) => c.classList.remove('slide-on'));
  }, [i]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onExit();
      if (e.key === 'ArrowLeft' || e.key === ' ') setI((k) => Math.min(k + 1, count - 1));
      if (e.key === 'ArrowRight') setI((k) => Math.max(k - 1, 0));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [count, onExit]);
  return (
    <div className="present-bar">
      <button className="btn" onClick={() => setI((k) => Math.max(k - 1, 0))}>السابق</button>
      <span className="num">{i + 1} / {count}</span>
      <button className="btn" onClick={() => setI((k) => Math.min(k + 1, count - 1))}>التالي</button>
      <button className="btn" onClick={onExit}>خروج</button>
    </div>
  );
}
