import { startTransition, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth } from '../auth.jsx';
import { setToken } from '../native/platform.js';
import { Field, ErrorBox } from '../components/ui.jsx';

const WORD = 'מחיקה';

/** Delete the account from inside the app (required by the App Store), and on the site. */
export default function DeleteAccount() {
  const { setMe } = useAuth();
  const nav = useNavigate();
  const [typed, setTyped] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [done, setDone] = useState(false);

  const remove = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api.del('/me/account', { confirm: typed.trim() });
      await setToken(null);
      setDone(true);
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  };

  const leave = () => startTransition(() => { setMe(null); nav('/', { replace: true }); });

  if (done) {
    return (
      <div className="narrow card center">
        <h1>החשבון נמחק</h1>
        <p>תודה שהיית חלק מהקהילה 💛 תמיד אפשר להירשם מחדש.</p>
        <button className="btn primary" onClick={leave}>לדף הבית</button>
      </div>
    );
  }

  return (
    <div className="narrow">
      <Link to="/me" className="back">→ חזרה לפרופיל</Link>
      <h1 className="page-title">מחיקת החשבון</h1>
      <div className="card">
        <p><b>המחיקה סופית ואי אפשר לבטל אותה.</b> יימחקו:</p>
        <ul>
          <li>הפרופיל, פרטי הקשר והכתובת</li>
          <li>ההגשות לקמפיינים וההיסטוריה שלך</li>
          <li>פרטי הבנק השמורים וההתראות לטלפון</li>
        </ul>
        <p className="small muted">
          חשבוניות וקבלות שהעלית נשמרות אצל נועה כמסמכי תשלום, כפי שהחוק מחייב.
          אם יש תשלום שעוד לא הועבר אלייך, הוא לא יבוטל, אבל כדאי לעדכן את נועה בווטסאפ.
        </p>
        <form className="form" onSubmit={remove}>
          <Field label={`לאישור, הקלידי "${WORD}"`} error={error?.fields?.confirm}>
            <input value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" />
          </Field>
          <ErrorBox error={error && !error.fields?.confirm ? error : null} />
          <button className="btn danger block" disabled={busy || typed.trim() !== WORD}>{busy ? 'מוחקת…' : 'מחיקת החשבון לצמיתות'}</button>
        </form>
      </div>
    </div>
  );
}
