// "احفظ ماتشاتك" card: sign up by name (personal link) or by email code,
// then show the personal link and the online-saving status.

import { useState } from 'react';
import { CLOUD_ON, GOOGLE_ON, IN_APP_BROWSER, personalLink, signInWithGoogle, sendEmailLink, signUpByName } from '../../cloud';
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
  const [linkSent, setLinkSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const run = async (fn: () => Promise<void>) => {
    setBusy(true); setError('');
    try { await fn(); } catch (e) { setError(explain((e as Error).message)); } finally { setBusy(false); }
  };

  const byName = () => run(async () => { await signIn(await signUpByName(name)); });
  const askLink = () => run(async () => { await sendEmailLink(email, name); setLinkSent(true); });

  const validEmail = /^\S+@\S+\.\S+$/.test(email.trim());

  return (
    <Card noSave title="احفظ ماتشاتك" lead="عشان متضيعش لو فتحت اللينك من الأول أو من موبايل تاني.">
      {GOOGLE_ON && (IN_APP_BROWSER
        ? <p className="note">عشان تدخل بجوجل، افتح اللينك في كروم أو سفاري (من التلت نقط فوق ← فتح في المتصفح). أو احفظ باسمك تحت.</p>
        : <button className="btn google-btn" onClick={signInWithGoogle}>
          <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
            <path fill="#4285F4" d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.5a5.5 5.5 0 0 1-2.4 3.6v3h3.9c2.2-2.1 3.5-5.2 3.5-8.8z" />
            <path fill="#34A853" d="M12 24c3.2 0 6-1.1 7.9-2.9l-3.9-3c-1 .7-2.4 1.1-4 1.1-3.1 0-5.7-2.1-6.6-4.9h-4v3.1A12 12 0 0 0 12 24z" />
            <path fill="#FBBC05" d="M5.4 14.3a7.2 7.2 0 0 1 0-4.6V6.6h-4a12 12 0 0 0 0 10.8z" />
            <path fill="#EA4335" d="M12 4.8c1.7 0 3.3.6 4.5 1.8l3.4-3.4A12 12 0 0 0 1.4 6.6l4 3.1C6.3 6.9 8.9 4.8 12 4.8z" />
          </svg>
          ادخل بحساب جوجل (Gmail)
        </button>)}
      {GOOGLE_ON && <p className="small muted or-line">أو</p>}

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
          <label className="field">الإيميل<input type="email" inputMode="email" autoComplete="email" dir="ltr" value={email} disabled={linkSent} onChange={(e) => setEmail(e.target.value)} /></label>
          {!linkSent
            ? <button className="btn primary" disabled={busy || !validEmail} onClick={askLink}>{busy ? 'استنى…' : 'ابعتلي لينك الدخول'}</button>
            : <div className="note">
              <p>بعتنالك إيميل على <b dir="ltr">{email.trim()}</b>. افتحه ودوس <b>Sign in</b> وهتدخل على طول. (لو مش لاقيه، بص في الـ Spam)</p>
              <button className="btn small" onClick={() => setLinkSent(false)}>غيّر الإيميل</button>
            </div>}
          <p className="small muted">لو دخلت بالإيميل ده قبل كده، ماتشاتك القديمة هترجع.</p>
        </>}

        {error && <p className="note warn-text">{error}</p>}
        <p className="small muted">ماتشاتك (المكان والسرعة والنبض) هتتحفظ أونلاين، وصاحب التطبيق يقدر يشوفها. الملاحظات الصحية بتفضل على موبايلك بس. <a href="privacy.html" target="_blank" rel="noopener">سياسة الخصوصية</a></p>
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
  if (m.includes('rate') || m.includes('seconds')) return 'إيميلات كتير اتبعتت دلوقتي. ادخل بجوجل أو باسمك، أو جرب الإيميل كمان ساعة.';
  if (m.includes('invalid') && m.includes('email')) return 'الإيميل ده مش صحيح.';
  return 'حصلت مشكلة. جرب تاني.';
}
