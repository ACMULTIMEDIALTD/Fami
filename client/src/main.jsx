import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, MemoryRouter } from 'react-router-dom';
import { DEMO } from './demo/flag.js';
import { IS_NATIVE } from './native/platform.js';
import { AuthProvider } from './auth.jsx';
import App from './App.jsx';
import './styles.css';

// The demo runs inside an embedded frame / static host, so routing stays in memory.
const Router = DEMO ? MemoryRouter : BrowserRouter;
if (IS_NATIVE) document.documentElement.classList.add('native');

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <Router>
      <AuthProvider>
        <App />
      </AuthProvider>
    </Router>
  </StrictMode>,
);

// Installable website (PWA). Not in the native app (it has its own shell) or the demo build.
if (import.meta.env.PROD && !DEMO && !IS_NATIVE && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js').catch(() => {}));
}

// "נגיש לי" accessibility widget (nagish.li, v2.3, LGPL), served from /public/nagishli.
// Loaded after the app so it never delays the first screen. Not in the demo build, which can't load extra files.
if (!DEMO) {
  Object.assign(window, {
    nl_lang: 'he',
    nl_pos: 'bl', // bottom-left: the right side has the app's own buttons in RTL
    nl_color: 'red', // closest of the widget's palettes to the brand burgundy
    nl_dir: '/nagishli/nl-files/',
  });
  const s = document.createElement('script');
  s.src = '/nagishli/nagishli.js?v=2.3';
  s.charset = 'utf-8';
  s.defer = true;
  document.body.appendChild(s);
}
