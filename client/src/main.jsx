import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, MemoryRouter } from 'react-router-dom';
import { DEMO } from './demo/flag.js';
import { AuthProvider } from './auth.jsx';
import App from './App.jsx';
import './styles.css';

// The demo runs inside an embedded frame / static host, so routing stays in memory.
const Router = DEMO ? MemoryRouter : BrowserRouter;

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <Router>
      <AuthProvider>
        <App />
      </AuthProvider>
    </Router>
  </StrictMode>,
);
