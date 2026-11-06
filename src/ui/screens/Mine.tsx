import { heartRateNote } from '../../analysis/insights';
import { DEFAULT_THRESHOLDS, type Thresholds } from '../../analysis/types';
import { Card } from '../Card';
import { useApp } from '../ctx';
import { Matches } from './Setup';
import { IN_ARTIFACT } from '../../env';

export function Mine({ onExportJson, onPresent }: { onExportJson: () => void; onPresent: () => void }) {
  const { analyses, profile, setProfile, thresholds: th, setThresholds, openWizard } = useApp();
  const allMax = analyses.length ? Math.max(...analyses.map((m) => m.hrMax ?? 0)) || null : null;
  const note = heartRateNote(allMax, allMax, profile);
  const num = (v: string) => (v === '' ? null : +v);
  const field = (k: keyof Thresholds, label: string, step = 0.5) => (
    <label key={k} className="field">{label}<input type="number" inputMode="decimal" step={step} value={th[k]} onChange={(e) => setThresholds({ ...th, [k]: +e.target.value })} /></label>
  );

  return (
    <div className="stack">
      <Matches onEdit={openWizard} />

      {!IN_ARTIFACT && <Card title="تصدير">
        <div className="btn-row">
          <button className="btn" onClick={() => window.print()}>تقرير PDF</button>
          <button className="btn" onClick={onExportJson} disabled={!analyses.length}>كل الأرقام (JSON)</button>
          <button className="btn" onClick={onPresent} disabled={!analyses.length}>اعرضها زي سلايدز</button>
        </div>
        <p className="small muted">جدول Excel من صفحة السبرينتات أو من «تطوري». وأي رسمة تتحفظ صورة من الزرار اللي في ركنها.</p>
      </Card>}

      <Card title="بياناتك" lead="محفوظة على جهازك بس.">
        <div className="form-grid">
          <label className="field">السن<input type="number" inputMode="numeric" value={profile.age ?? ''} onChange={(e) => setProfile({ ...profile, age: num(e.target.value) })} /></label>
          <label className="field">الطول (سم)<input type="number" inputMode="numeric" value={profile.heightCm ?? ''} onChange={(e) => setProfile({ ...profile, heightCm: num(e.target.value) })} /></label>
          <label className="field">الوزن (كجم)<input type="number" inputMode="numeric" value={profile.weightKg ?? ''} onChange={(e) => setProfile({ ...profile, weightKg: num(e.target.value) })} /></label>
          <label className="field">أقصى نبض ليك<input type="number" inputMode="numeric" value={profile.hrMaxOverride ?? ''} placeholder={allMax ? `أعلى متسجل ${allMax}` : ''} onChange={(e) => setProfile({ ...profile, hrMaxOverride: num(e.target.value) })} /></label>
        </div>
        <label className="field">ملاحظات صحية<textarea rows={2} value={profile.healthNotes} onChange={(e) => setProfile({ ...profile, healthNotes: e.target.value })} /></label>
        {note && <p className="note">{note}</p>}
        <p className="small muted">التطبيق مش أداة طبية، ومش بيدي نصايح علاج أو مكملات.</p>
      </Card>

      <details className="more card">
        <summary>الحدود (متقدم)</summary>
        <div className="form-grid">
          {field('sprint', 'سبرينت فوق (كم/س)')}
          {field('burst', 'جري سريع فوق (كم/س)')}
          {field('burstMinSec', 'أقل مدة للسبرينت (ث)', 1)}
          {field('walking', 'مشي لحد (كم/س)')}
          {field('standing', 'واقف أقل من (كم/س)')}
          {field('rsaSec', 'سبرينت ورا سبرينت لو الراحة أقل من (ث)', 5)}
          {field('accelEvent', 'حد الانطلاقة (م/ث²)', 0.1)}
          {field('accelMinSec', 'أقل مدة للانطلاقة (ث)', 1)}
        </div>
        <p className="small muted">حد السبرينت الرسمي 18 كم/س، بس ساعة بتقيس مرة في الثانية في ملعب صغير نادراً بتقرا فوق 12-16. عشان كده الافتراضي 8.</p>
        <button className="btn small" onClick={() => setThresholds(DEFAULT_THRESHOLDS)}>رجّع الافتراضي</button>
      </details>

      <details className="more card">
        <summary>الأرقام بتتحسب إزاي؟</summary>
        <ul className="plain small">
          <li><b>السرعة</b> من الساعة نفسها. <b>المسافة</b> مجموع المسافات بين كل نقطتين.</li>
          <li><b>السبرينت</b>: جري فوق {th.burst} كم/س لمدة {th.burstMinSec} ثواني أو أكتر، ووصل فوق {th.sprint} كم/س.</li>
          <li><b>هجوم ودفاع</b>: من اتجاه الجري. لو رايح ناحية مرمى الخصم يبقى هجوم، مهما كنت بادئ منين.</li>
          <li><b>وقت اللعب</b>: الثواني اللي كنت بتتحرك فيها، من غير الحارس والراحة والإصابة. كل المعدلات محسوبة عليه.</li>
          <li><b>الملعب</b>: بيتحدد من حركتك إنت، وبيتلف بحيث مرماك يبقى تحت دايماً.</li>
          <li><b>الدقة</b>: الساعة بتقيس مرة في الثانية، فالسرعة والانطلاقات أقل من الحقيقة شوية. ومش عارفة الكورة فين.</li>
          <li>كل الحسابات على جهازك ومفيش داتا بتترفع. الخريطة الاختيارية بس بتطلب صور الملعب من النت.</li>
        </ul>
      </details>
    </div>
  );
}
