import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../../auth/AuthProvider';

/**
 * Requires the user to be OAuth-authenticated (token present).
 * Does NOT check the allow-list — use AuthGuard for that.
 * Covers "limbo" routes like /access-blocked and /request-access where
 * the user is signed in but not yet allowed to use the app.
 */
export default function AuthenticatedRoute() {
  const { isAuthenticated } = useAuth();
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return <Outlet />;
}
