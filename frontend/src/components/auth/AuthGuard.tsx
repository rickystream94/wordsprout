import { useEffect, useState } from 'react';
import { Navigate, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../../auth/AuthProvider';
import { quotaApi } from '../../services/api';
import { ApiRequestError } from '../../services/api';
import { pullFromServer } from '../../services/sync';

type AllowlistState = 'checking' | 'allowed' | 'blocked';

/**
 * Wraps protected routes.
 * - Redirects to /login if not OAuth-authenticated.
 * - Probes GET /api/users/me/quota to verify allow-list membership.
 * - Redirects to /access-blocked on 403.
 * - Renders a loading state while the probe is in-flight.
 */
export default function AuthGuard() {
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [allowlistState, setAllowlistState] = useState<AllowlistState>('checking');

  useEffect(() => {
    if (!isAuthenticated) return;

    let cancelled = false;

    quotaApi.get()
      .then(() => {
        if (!cancelled) {
          setAllowlistState('allowed');
          // Fire-and-forget: pull server data into IndexedDB so the app is
          // populated on a fresh device or after a long absence.
          pullFromServer().catch(console.error);
        }
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        if (err instanceof ApiRequestError && err.statusCode === 403) {
          navigate('/access-blocked', { replace: true });
        } else if (err instanceof ApiRequestError && err.statusCode === 401) {
          // Token missing or expired — treat as unauthenticated
          navigate('/login', { replace: true });
        } else {
          // Network error or unexpected — allow through; individual pages handle their own errors
          setAllowlistState('allowed');
        }
      });

    return () => { cancelled = true; };
  // Re-check whenever auth state changes (e.g. after Google login)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated]);

  if (!isAuthenticated) return <Navigate to="/login" replace />;

  if (allowlistState === 'checking') {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100dvh' }}>
        <span aria-live="polite" aria-busy="true" style={{ color: 'var(--text-muted)', fontSize: 'var(--text-sm)' }}>
          Checking access…
        </span>
      </div>
    );
  }

  return <Outlet />;
}
