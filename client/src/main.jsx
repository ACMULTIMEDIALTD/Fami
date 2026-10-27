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
