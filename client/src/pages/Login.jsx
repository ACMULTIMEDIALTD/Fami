import { DEMO } from '../demo/flag.js';
import { useState } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth } from '../auth.jsx';
import { Field, ErrorBox } from '../components/ui.jsx';
import { useMeta } from '../meta.js';

const safeNext = (n) => (n && /^\/(?![/\\])/.test(n) ? n : null);

export default function Login() {
  const { me, refresh } = useAuth();
  const nav = useNavigate();
  const [params] = useSearchParams();
  const next = safeNext(params.get('next'));
  const meta = useMeta();
  const mailEnabled = meta?.mail_enabled !== false;
  const [chosenMode, setMode] = useState('magic'); // creators hate passwords
  // Until email is set up on the server, sign-in links can't be sent: password only
  const mode = mailEnabled ? chosenMode : 'password';
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState(params.get('error') === 'link_expired' ? 'הקישור פג תוקף או שכבר נעשה בו שימוש. אפשר לבקש קישור חדש.' : null);

  if (me) return <Navigate to={next || (me.user.role === 'admin' ? '/admin' : '/dashboard')} replace />;

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      if (mode === 'magic') {
        const r = await api.post('/auth/login', next ? { email, next } : { email });
        if (r.demo_logged_in) {
          await refresh();
          return;
        }
        setSent(true);
      } else {
        await api.post('/auth/login', { email, password });
        await refresh();
        nav(next || '/dashboard', { replace: true });
      }
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  };

  if (sent) {
    return (
      <div className="narrow card center">
        <h1>בדקי את המייל 💌</h1>
        <p>אם <b dir="ltr">{email}</b> רשום אצלנו, שלחנו אלייך קישור כניסה. הקישור תקף ל-30 דקות.</p>
        <p className="muted">לא הגיע? כדאי לבדוק בתיקיית הספאם ולסמן ״לא ספאם״, כדי שהמייל הבא יגיע לתיבה הראשית.</p>
        <button className="btn ghost" onClick={() => setSent(false)}>שליחה מחדש</button>
      </div>
    );
  }

  return (
    <div className="narrow">
      <h1 className="page-title">כניסה לקהילה</h1>
      {DEMO && <p className="demo-hint">בהדגמה אין מיילים: מספיק להקליד מייל ולהיכנס, או להשתמש בכפתורים בפס העליון.</p>}
      <form className="card form" onSubmit={submit}>
        <Field label="מייל">
          <input type="email" dir="ltr" required value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" autoFocus />
        </Field>
        {mode === 'password' && (
          <Field label="סיסמה">
            <input type="password" dir="ltr" required value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />
          </Field>
        )}
        <ErrorBox error={error} />
        <button className="btn primary block" disabled={busy}>
          {busy ? 'רגע…' : mode === 'magic' ? 'שלחו לי קישור כניסה' : 'כניסה'}
        </button>
        {mailEnabled && (
          <button type="button" className="linklike center-text" onClick={() => setMode(mode === 'magic' ? 'password' : 'magic')}>
            {mode === 'magic' ? 'כניסה עם סיסמה' : 'כניסה עם קישור למייל (בלי סיסמה)'}
          </button>
        )}
        {!mailEnabled && <p className="small muted center-text">שכחת סיסמה? כתבי לנועה בווטסאפ.</p>}
      </form>
      <p className="center-text">עדיין לא בקהילה? <Link to="/join">להרשמה</Link></p>
    </div>
  );
}
