import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './auth/AuthProvider';
import { initializeMsal } from './auth/msalConfig';
import { ThemeProvider } from './store/ThemeContext';
import { replayQueue } from './services/sync';
import { rebuildIndex } from './services/search';
import AppShell from './components/layout/AppShell';
import AuthGuard from './components/auth/AuthGuard';
import ErrorBoundary from './components/common/ErrorBoundary';
import Home from './pages/Home';
import PhrasebookView from './pages/PhrasebookView';
import Search from './pages/Search';
import Review from './pages/Review';
import Login from './pages/Login';
import RequestAccess from './pages/RequestAccess';
import AccessBlockedPage from './pages/AccessBlockedPage';
import './styles/tokens.css';
import './styles/global.css';

// ─── T016: Wire sync replay to online + visibilitychange events ───────────────
window.addEventListener('online', () => {
  replayQueue().catch(console.error);
});

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && navigator.onLine) {
    replayQueue().catch(console.error);
  }
});

// ─── Initialise MSAL before rendering ─────────────────────────────────────────
async function bootstrap() {
  await initializeMsal();

  // T033: Build MiniSearch index on startup (best-effort, non-blocking)
  rebuildIndex().catch(console.error);

  const root = document.getElementById('root');
  if (!root) throw new Error('Root element not found');

  createRoot(root).render(
    <StrictMode>
      <AuthProvider>
        <ThemeProvider>
          <BrowserRouter>
            <Routes>
              {/* Public routes */}
              <Route path="/login" element={<Login />} />
              <Route path="/request-access" element={<RequestAccess />} />
              <Route path="/access-blocked" element={<AccessBlockedPage />} />

              {/* Protected routes — require authentication */}
              <Route element={<AuthGuard />}>
                <Route element={<AppShell />}>
                  <Route path="/" element={<ErrorBoundary><Home /></ErrorBoundary>} />
                  <Route path="/phrasebooks/:id" element={<ErrorBoundary><PhrasebookView /></ErrorBoundary>} />
                  <Route path="/search" element={<ErrorBoundary><Search /></ErrorBoundary>} />
                  <Route path="/review" element={<ErrorBoundary><Review /></ErrorBoundary>} />
                </Route>
              </Route>
            </Routes>
          </BrowserRouter>
        </ThemeProvider>
      </AuthProvider>
    </StrictMode>,
  );
}

bootstrap().catch(console.error);
