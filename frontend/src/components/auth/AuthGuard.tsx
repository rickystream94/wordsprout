import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../../auth/AuthProvider';

/**
 * Wraps protected routes. Redirects to /login if unauthenticated.
 */
export default function AuthGuard() {
  const { isAuthenticated } = useAuth();
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return <Outlet />;
}
