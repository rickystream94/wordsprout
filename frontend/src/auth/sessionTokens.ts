// ─── Backend session token store (localStorage-backed) ───────────────────────
// Holds the access + refresh token pair issued by POST /api/auth/session.
// The access token is a short-lived JWT (15 min); the refresh token is an
// opaque string valid for 30 days.

const ACCESS_KEY = 'wordsprout:access_token';
const REFRESH_KEY = 'wordsprout:refresh_token';

export function storeSession(accessToken: string, refreshToken: string): void {
  localStorage.setItem(ACCESS_KEY, accessToken);
  localStorage.setItem(REFRESH_KEY, refreshToken);
}

export function clearSession(): void {
  localStorage.removeItem(ACCESS_KEY);
  localStorage.removeItem(REFRESH_KEY);
}

export function getStoredRefreshToken(): string | null {
  return localStorage.getItem(REFRESH_KEY);
}

// ─── Access token introspection (client-side decode, no signature check) ──────

interface AccessTokenClaims {
  sub: string;
  email?: string;
  provider?: string;
  iss: string;
  exp: number;
}

function decodeAccessToken(token: string): AccessTokenClaims | null {
  try {
    const payload = token.split('.')[1];
    if (!payload) return null;
    return JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/'))) as AccessTokenClaims;
  } catch {
    return null;
  }
}

/**
 * Returns the stored access token if it exists and has not expired.
 * Returns null if missing or expired.
 */
export function getStoredAccessToken(): string | null {
  const token = localStorage.getItem(ACCESS_KEY);
  if (!token) return null;
  const claims = decodeAccessToken(token);
  if (!claims) return null;
  if (claims.exp * 1000 <= Date.now()) return null;
  return token;
}

/**
 * Returns true if a valid (non-expired) access token exists in localStorage.
 */
export function hasValidSession(): boolean {
  return getStoredAccessToken() !== null;
}

/**
 * Returns true if the stored access token expires within `bufferMs` milliseconds.
 * Returns true if there is no stored token (caller should treat as expired).
 */
export function isAccessTokenExpiringSoon(bufferMs = 60_000): boolean {
  const token = localStorage.getItem(ACCESS_KEY);
  if (!token) return true;
  const claims = decodeAccessToken(token);
  if (!claims) return true;
  return claims.exp * 1000 - Date.now() < bufferMs;
}
