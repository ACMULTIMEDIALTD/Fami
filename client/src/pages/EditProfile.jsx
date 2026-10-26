import { useEffect, useState } from 'react';
import { api } from '../api.js';
import { Spinner } from '../auth.jsx';
import { ErrorBox } from '../components/ui.jsx';
import ProfileWizard from '../components/ProfileWizard.jsx';

export default function EditProfile() {
  const [profile, setProfile] = useState(null);
  const [error, setError] = useState(null);
  const [saved, setSaved] = useState(false);
  const [key, setKey] = useState(0);

  useEffect(() => { api.get('/me/profile').then((r) => setProfile(r.profile)).catch(setError); }, []);

  if (error) return <ErrorBox error={error} />;
  if (!profile) return <Spinner />;

  return (
    <div className="narrow">
      <h1 className="page-title">הפרופיל שלי</h1>
      {saved && <div className="alert success" role="status">הפרופיל נשמר ✓</div>}
      <ProfileWizard
        key={key}
        initial={profile}
        submitLabel="שמירה"
        onSaved={(p) => { setProfile(p); setSaved(true); setKey((k) => k + 1); window.scrollTo(0, 0); }}
      />
    </div>
  );
}
