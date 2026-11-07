// "احفظ ماتشاتك" card: sign up by name (personal link) or by email code,
// then show the personal link and the online-saving status.

import { useState } from 'react';
import { CLOUD_ON, personalLink, sendEmailCode, signUpByName, verifyEmailCode } from '../../cloud';
import { Card } from '../Card';
import { useApp } from '../ctx';

type Mode = 'name' | 'email';

const STATUS: Record<string, string> = {
  saving: 'بيحفظ…',
  ok: 'محفوظ أونلاين ✓',
  offline: 'مفيش نت دلوقتي. هيتحفظ أول ما النت يرجع',
  off: '',
};

export function AccountCard() {
  const { account } = useApp();
  if (!CLOUD_ON) return null;
  return account ? <SignedIn /> : <SignIn />;
}

function SignIn() {
  const { signIn } = useApp();
  const [mode, setMode] = useState<Mode>('name');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [codeSent, setCodeSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const run = async (fn: () => Promise<void>) => {
    setBusy(true); setError('');
    try { await fn(); } catch (e) { setError(explain((e as Error).message)); } finally { setBusy(false); }
  };

  const byName = () => run(async () => { await signIn(await signUpByName(name)); });
  const askCode = () => run(async () => { await sendEmailCode(email); setCodeSent(true); });
  const byEmail = () => run(async () => { await signIn(await verifyEmailCode(email, code, name)); });

  const validEmail = /^\S+@\S+\.\S+$/.test(email.trim());

  return (
    <Card noSave title="احفظ ماتشاتك" lead="عشان متضيعش لو فتحت اللينك من الأول أو من موبايل تاني.">
      <div className="segs" role="tablist">
        <button role="tab" aria-selected={mode === 'name'} className={mode === 'name' ? 'on' : ''} onClick={() => setMode('name')}>باسمي</button>
        <button role="tab" aria-selected={mode === 'email'} className={mode === 'email' ? 'on' : ''} onClick={() => setMode('email')}>بالإيميل</button>
      </div>

      <div className="stack account-form">
        <label className="field">اسمك<input value={name} maxLength={60} autoComplete="name" onChange={(e) => setName(e.target.value)} /></label>

        {mode === 'name' && <>
          <p className="small muted">هتاخد لينك خاص بيك. أي موبايل يفتحه هيلاقي ماتشاتك.</p>
          <button className="btn primary" disabled={busy || !name.trim()} onClick={byName}>{busy ? 'استنى…' : 'احفظ'}</button>
        </>}

        {mode === 'email' && <>
          <label className="field">الإيميل<input type="email" inputMode="email" autoComplete="email" dir="ltr" value={email} disabled={codeSent} onChange={(e) => setEmail(e.target.value)} /></label>
          {!codeSent
            ? <button className="btn primary" disabled={busy || !validEmail} onClick={askCode}>{busy ? 'استنى…' : 'ابعتلي كود'}</button>
            : <>
              <label className="field">الكود اللي وصلك على الإيميل
                <input inputMode="numeric" autoComplete="one-time-code" dir="ltr" maxLength={10} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} />
              </label>
              <div className="btn-row">
                <button className="btn primary grow" disabled={busy || code.length < 6} onClick={byEmail}>{busy ? 'استنى…' : 'دخول'}</button>
                <button className="btn" disabled={busy} onClick={() => { setCodeSent(false); setCode(''); }}>غيّر الإيميل</button>
              </div>
            </>}
          <p className="small muted">لو دخلت بالإيميل ده قبل كده، ماتشاتك القديمة هترجع.</p>
        </>}

        {error && <p className="note warn-text">{error}</p>}
        <p className="small muted">ماتشاتك (المكان والسرعة والنبض) هتتحفظ أونلاين، وصاحب التطبيق يقدر يشوفها. الملاحظات الصحية بتفضل على موبايلك بس.</p>
      </div>
    </Card>
  );
}

function SignedIn() {
  const { account, syncState, signOut } = useApp();
  const [copied, setCopied] = useState(false);
  const [confirmOut, setConfirmOut] = useState(false);
  const [outError, setOutError] = useState('');
  const link = personalLink(account!.token);

  const copy = async () => {
    try { await navigator.clipboard.writeText(link); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch { /* ignore */ }
  };
  const share = async () => {
    try { await navigator.share({ title: 'ماتشاتي', text: 'لينك ماتشاتي في تحليل الخماسي', url: link }); } catch { /* cancelled */ }
  };
  const out = async () => {
    setOutError('');
    if (!(await signOut())) setOutError('في حاجات لسه متحفظتش أونلاين. استنى النت يرجع وجرب تاني.');
  };

  return (
    <Card noSave title={account!.name ? `أهلاً ${account!.name}` : 'ماتشاتك محفوظة'} lead={STATUS[syncState]}>
      <p className="small muted">ده اللينك الخاص بيك. احفظه أو ابعته لنفسك، هو اللي بيرجّعلك ماتشاتك من أي موبايل.{account!.email ? ` أو ادخل تاني بالإيميل ${account!.email}.` : ''}</p>
      <input className="link-box" dir="ltr" readOnly value={link} onFocus={(e) => e.target.select()} />
      <div className="btn-row">
        <button className="btn primary" onClick={copy}>{copied ? 'اتنسخ ✓' : 'انسخ اللينك'}</button>
        {'share' in navigator && <button className="btn" onClick={share}>ابعته لنفسك</button>}
      </div>
      {!confirmOut
        ? <button className="btn small" onClick={() => setConfirmOut(true)}>خروج</button>
        : <div className="note">
          <p>هتتشال الماتشات من الموبايل ده (بتفضل محفوظة أونلاين وترجع باللينك).</p>
          <div className="btn-row">
            <button className="btn small" onClick={out}>أيوه اخرج</button>
            <button className="btn small" onClick={() => setConfirmOut(false)}>لأ</button>
          </div>
          {outError && <p className="warn-text">{outError}</p>}
        </div>}
    </Card>
  );
}

function explain(msg: string) {
  const m = msg.toLowerCase();
  if (m.includes('failed to fetch') || m.includes('network')) return 'مفيش نت. جرب تاني.';
  if (m.includes('expired') || m.includes('invalid') || m.includes('otp')) return 'الكود غلط أو خلص وقته. اطلب كود جديد.';
  if (m.includes('rate') || m.includes('seconds')) return 'استنى دقيقة وبعدين اطلب كود تاني.';
  return 'حصلت مشكلة. جرب تاني.';
}
