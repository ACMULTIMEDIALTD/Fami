import { useEffect, useState } from 'react';
import logoUrl from '../assets/logo.jpg';
import { DEMO } from '../demo/flag.js';
import { IS_NATIVE } from '../native/platform.js';

const KEY = 'install_hint_dismissed';
const isStandalone = () => window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone === true;
const isIos = () => /iphone|ipad|ipod/i.test(navigator.userAgent);
const isMobile = () => /android|iphone|ipad|ipod/i.test(navigator.userAgent);
const dismissed = () => { try { return localStorage.getItem(KEY) === '1'; } catch { return false; } };

/** Suggests adding the site to the home screen when a creator opens it in a phone browser. */
export default function InstallHint() {
  const [prompt, setPrompt] = useState(null); // Android/Chrome install prompt
  const [hidden, setHidden] = useState(() => IS_NATIVE || DEMO || dismissed() || isStandalone() || !isMobile());

  useEffect(() => {
    const onPrompt = (e) => { e.preventDefault(); setPrompt(e); };
    window.addEventListener('beforeinstallprompt', onPrompt);
    return () => window.removeEventListener('beforeinstallprompt', onPrompt);
  }, []);

  const close = () => {
    setHidden(true);
    try { localStorage.setItem(KEY, '1'); } catch { /* ignore */ }
  };
  const install = async () => {
    prompt.prompt();
    await prompt.userChoice.catch(() => {});
    close();
  };

  if (hidden || (!isIos() && !prompt)) return null;
  return (
    <div className="install-hint" role="note">
      <img src={logoUrl} alt="" />
      <div className="grow">
        <b>להוסיף את הקהילה למסך הבית?</b>
        {prompt
          ? <p>כניסה בלחיצה אחת, כמו אפליקציה.</p>
          : <p>בספארי: לחצי על כפתור השיתוף <span aria-hidden="true">⎋</span> ואז על ״הוספה למסך הבית״.</p>}
      </div>
      {prompt && <button className="btn primary sm" onClick={install}>הוספה</button>}
      <button className="icon-btn" onClick={close} aria-label="סגירה">×</button>
    </div>
  );
}
