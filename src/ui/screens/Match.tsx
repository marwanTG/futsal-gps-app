import { matchStory } from '../../analysis/insights';
import type { MatchAnalysis } from '../../analysis/types';
import { ShareBar, SpeedTimeline } from '../charts';
import { Card } from '../Card';
import { useApp } from '../ctx';
import { AttackDefense, Batteries, Ring, SpeedGauge } from '../graphics';
import { Icon } from '../icons';
import { SatellitePicker } from '../Satellite';
import { IN_ARTIFACT } from '../../env';
import { compassWord } from '../format';
import { useMemo, useState } from 'react';
import { ACCEL_CAVEAT, C, HR_COLORS, ZONE_COLORS, fmt, int } from '../format';

/** First screen with no matches: one big button and three pictured steps. */
export function NoMatch() {
  const { pickFiles } = useApp();
  return (
    <div className="welcome">
      <div className="welcome-art" aria-hidden="true">
        <span className="wa-icon">{Icon.watch(34)}</span>
        <span className="wa-line" />
        <span className="wa-icon">{Icon.file(34)}</span>
        <span className="wa-line" />
        <span className="wa-icon on">{Icon.pitch(34)}</span>
      </div>
      <h2>حلّل ماتشك من ساعتك</h2>
      <button className="btn primary big" onClick={pickFiles}>{Icon.plus(24)} ارفع ماتش</button>
      <ol className="howto">
        <li><span className="howto-n num">1</span>افتح الماتش في تطبيق Zepp</li>
        <li><span className="howto-n num">2</span>صدّره كملف GPX</li>
        <li><span className="howto-n num">3</span>ارفعه هنا</li>
      </ol>
    </div>
  );
}

export function SetupBanner() {
  const { selected: a, openWizard } = useApp();
  if (!a || a.orientationConfirmed) return null;
  return (
    <button className="banner" onClick={() => openWizard(a.id)}>
      <span className="banner-icon">{Icon.pitch(22)}</span>
      <span>حدد مرماك كان فين</span>
      {Icon.chevron()}
    </button>
  );
}

export function MatchView() {
  const { selected: a, thresholds: th, analyses, goField } = useApp();
  if (!a) return <NoMatch />;
  const best = (f: (m: MatchAnalysis) => number) => Math.max(...analyses.map(f), 1e-9);
  const story = matchStory(a, analyses).slice(0, 2);
  const att = a.sprints.filter((s) => s.direction === 'attack').length;
  const thirds = a.thirds.map((t) => t.sprintsPerHour);
  const z = a.zoneSec;

  return (
    <div className="stack">
      <SetupBanner />
      <section className="hero-card">
        <div className="hero-main">
          <span className="hero-icon">{Icon.bolt(40)}</span>
          <span className="hero-num num">{a.sprints.length}</span>
          <b className="hero-word">سبرينت</b>
        </div>
        <p className="muted small">جري أسرع من {th.sprint} كم/س</p>
      </section>

      <div className="rings">
        <Ring value={a.distanceM} max={best((m) => m.distanceM)} display={int(a.distanceM)} unit="متر" label="المسافة" color={C.lime} icon={Icon.run(16)} />
        <Ring value={a.activeMin} max={best((m) => m.activeMin)} display={fmt(a.activeMin, 0)} unit="دقيقة" label="وقت اللعب" color={C.coral} icon={Icon.clock(16)} />
        <Ring value={a.hrAvg ?? 0} max={a.hrZoneMax ?? 200} display={fmt(a.hrAvg, 0)} unit="نبضة" label="متوسط النبض" color={C.gold} icon={Icon.heart(16)} />
      </div>
      <p className="ring-note muted small">الدايرة مليانة = أحسن ماتش ليك</p>

      <div className="cards-2">
        <Card title="أقصى سرعة"><SpeedGauge value={a.maxSpeed} threshold={th.sprint} /></Card>
        <Card title="هجوم ودفاع" actions={<button className="btn small" onClick={goField}>الملعب</button>}
          caveat={a.orientationConfirmed ? undefined : 'حدد مرماك الأول'}>
          <AttackDefense attack={att} defense={a.sprints.length - att} confirmed={a.orientationConfirmed} />
        </Card>
      </div>

      {!IN_ARTIFACT && <PitchPhoto />}

      <Card title="طاقتك على مدار الماتش" caveat="سبرينت في الساعة">
        <Batteries values={thirds} />
      </Card>

      {story.length > 0 && (
        <ul className="story-cards">{story.map((l, i) => <li key={i} className={l.tone}>{l.text}</li>)}</ul>
      )}

      <Card title="السرعة لحظة بلحظة" caveat="كل نقطة سبرينت">
        <SpeedTimeline min={a.timeline.min} speed={a.timeline.speed} excluded={a.timeline.excluded} sprints={a.sprints} sprintThreshold={th.sprint} />
      </Card>

      <div className="cards-2">
        <Card title="وقتك اتقسم إزاي">
          <ShareBar parts={[
            { label: 'واقف', value: z.standing, color: ZONE_COLORS[0] },
            { label: 'ماشي', value: z.walking, color: ZONE_COLORS[1] },
            { label: 'بهرول', value: z.jogging, color: ZONE_COLORS[2] },
            { label: 'بجري', value: z.running, color: ZONE_COLORS[3] },
            { label: 'سبرينت', value: z.sprint, color: ZONE_COLORS[4] },
          ]} />
        </Card>
        <Card title="النبض">
          <ShareBar parts={['هادي', 'خفيف', 'متوسط', 'عالي', 'أقصى'].map((l, i) => ({ label: l, value: a.hrZoneSec[i], color: HR_COLORS[i] }))} />
        </Card>
      </div>

      <details className="more card">
        <summary>كل الأرقام</summary>
        <table className="tbl">
          <tbody>
            <tr><td>مدة الماتش</td><td className="num">{fmt(a.durationMin)} د</td></tr>
            <tr><td>متر في الدقيقة</td><td className="num">{fmt(a.mPerMin)}</td></tr>
            <tr><td>متوسط السرعة</td><td className="num">{fmt(a.avgSpeed)} كم/س</td></tr>
            <tr><td>جري سريع (فوق {th.burst})</td><td className="num">{int(a.hsrM)} م</td></tr>
            <tr><td>مسافة السبرينت</td><td className="num">{int(a.sprintM)} م</td></tr>
            <tr><td>انطلاقات / فرامل</td><td className="num">{a.accelCount} / {a.decelCount}</td></tr>
            <tr><td>سبرينت ورا سبرينت</td><td className="num">{a.rsaCount}</td></tr>
            <tr><td>أعلى نبض</td><td className="num">{a.hrMax ?? '—'}</td></tr>
            <tr><td>حارس / راحة / إصابة</td><td className="num">{fmt(a.excludedMin.goalkeeper)} / {fmt(a.excludedMin.rest)} / {fmt(a.excludedMin.injury)} د</td></tr>
          </tbody>
        </table>
        <p className="small muted">{ACCEL_CAVEAT}</p>
      </details>
    </div>
  );
}

/** The real pitch from the watch's own GPS, with the track and the own goal. */
function PitchPhoto() {
  const { selected: a } = useApp();
  const [failed, setFailed] = useState(false);
  const track = useMemo(() => (a ? a.latlon.lat.map((lat, i) => [lat, a.latlon.lon[i]] as [number, number]) : []), [a]);
  if (!a || failed) return null;
  const words = { a: compassWord(a.frame.axisBearing), b: compassWord(a.frame.axisBearing + 180) };
  const end = a.frame.segments[0]?.end ?? null;
  return (
    <Card title="ملعبك" caveat={end ? `مرماك ناحية ${words[end]}` : undefined}>
      <SatellitePicker key={a.id} compact track={track} ends={a.axisEnds} corners={a.pitchCorners} words={words} chosen={end} onFail={() => setFailed(true)} />
    </Card>
  );
}
