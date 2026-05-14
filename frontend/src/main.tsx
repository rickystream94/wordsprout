import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './auth/AuthProvider';
import { clearSession, getStoredAccessToken } from './auth/sessionTokens';
import { initializeMsal } from './auth/msalConfig';
import { ThemeProvider } from './store/ThemeContext';
import { replayQueue, pullFromServer, SYNC_INTERVAL_MS, PULL_TTL_MS } from './services/sync';
import { rebuildIndex } from './services/search';
import AppShell from './components/layout/AppShell';
import AuthGuard from './components/auth/AuthGuard';
import AuthenticatedRoute from './components/auth/AuthenticatedRoute';
import ErrorBoundary from './components/common/ErrorBoundary';
import Home from './pages/Home';
import PhrasebookView from './pages/PhrasebookView';
import Search from './pages/Search';
import Review from './pages/Review';
import Login from './pages/Login';
import RequestAccess from './pages/RequestAccess';
import AccessBlockedPage from './pages/AccessBlockedPage';
import NotFound from './pages/NotFound';
import PrivacyPolicy from './pages/PrivacyPolicy';
import Terms from './pages/Terms';
import About from './pages/About';
import './styles/tokens.css';
import './styles/global.css';

// Public routes that never need sync and must not be redirected away from
const PUBLIC_ROUTES = ['/login', '/about', '/privacy', '/terms', '/access-blocked', '/request-access'];
const isPublicRoute = () => PUBLIC_ROUTES.some(r => window.location.pathname.startsWith(r));

// ─── T016: Wire sync replay + inbound pull to online + visibilitychange events ─
window.addEventListener('online', () => {
  if (!getStoredAccessToken()) return;
  replayQueue().catch(console.error);
  pullFromServer().catch(console.error);
});

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && navigator.onLine && getStoredAccessToken()) {
    replayQueue().catch(console.error);
    pullFromServer().catch(console.error);
  }
});

// Periodic outbound sync so queued mutations don't wait for events
setInterval(() => { if (getStoredAccessToken()) replayQueue().catch(console.error); }, SYNC_INTERVAL_MS);

// Periodic inbound pull so changes from other devices appear without needing a tab switch
setInterval(() => { if (getStoredAccessToken()) pullFromServer().catch(console.error); }, PULL_TTL_MS);

// ─── Handle permanent 403: sync queue cleared, redirect to access-blocked ─────
 window.addEventListener('wordsprout:access-revoked', () => {
  window.location.replace('/access-blocked');
});

// ─── Handle 401 from API: token expired, clear all session state ───────────────
// The AuthProvider listens for this event and updates React state, which causes
// AuthGuard to redirect to /login without a hard page reload — preserving
// in-progress state where possible.
window.addEventListener('wordsprout:session-expired', () => {
  // Clear backend session tokens
  clearSession();
  // Clear Google credential so AuthProvider re-evaluates
  localStorage.removeItem('wordsprout:google_credential');
  // Don't redirect away from public pages — the user doesn't need to be logged in there
  if (isPublicRoute()) return;
  // The hard redirect is kept as a fallback in case the React tree is not mounted
  // (e.g. during initial load). AuthProvider will prevent the redirect when it
  // handles the event first.
  window.location.replace('/login');
});

// ─── Normalise double-slash paths (e.g. //access-blocked → /access-blocked) ───
const _normalised = window.location.pathname.replace(/\/{2,}/g, '/');
if (_normalised !== window.location.pathname) {
  window.history.replaceState(
    null, '',
    _normalised + window.location.search + window.location.hash,
  );
}

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
              {/* Public routes — no auth required */}
              <Route path="/login" element={<Login />} />
              <Route path="/about" element={<About />} />
              <Route path="/privacy" element={<PrivacyPolicy />} />
              <Route path="/terms" element={<Terms />} />

              {/* Auth-required (token present) but not necessarily allow-listed */}
              <Route element={<AuthenticatedRoute />}>
                <Route path="/access-blocked" element={<AccessBlockedPage />} />
                <Route path="/request-access" element={<RequestAccess />} />
              </Route>

              {/* Protected routes — require authentication + allow-list */}
              <Route element={<AuthGuard />}>
                <Route element={<AppShell />}>
                  <Route path="/" element={<ErrorBoundary><Home /></ErrorBoundary>} />
                  <Route path="/phrasebooks/:id" element={<ErrorBoundary><PhrasebookView /></ErrorBoundary>} />
                  <Route path="/search" element={<ErrorBoundary><Search /></ErrorBoundary>} />
                  <Route path="/review" element={<ErrorBoundary><Review /></ErrorBoundary>} />
                </Route>
              </Route>

              {/* Catch-all — unmatched paths */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </ThemeProvider>
      </AuthProvider>
    </StrictMode>,
  );
}

bootstrap().catch(console.error);
