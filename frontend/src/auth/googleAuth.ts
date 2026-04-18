// ─── Google credential store (sessionStorage-backed) ─────────────────────────
// Holds the raw GIS JWT credential string. Accessed by AuthProvider and api.ts.
// sessionStorage survives in-tab navigation and page reloads but is cleared
// when the tab/browser is closed — appropriate for a 1-hour Google ID token.

const SESSION_KEY = 'wordsprout:google_credential';

export function setGoogleCredential(token: string | null): void {
  if (token === null) {
    sessionStorage.removeItem(SESSION_KEY);
  } else {
    sessionStorage.setItem(SESSION_KEY, token);
  }
}

export function getGoogleCredential(): string | null {
  return sessionStorage.getItem(SESSION_KEY);
}

// ─── Token introspection (client-side decode, no signature verification) ──────

interface GoogleClaims {
  sub: string;
  email?: string;
  exp: number;
}

function decodeGoogleToken(token: string): GoogleClaims | null {
  try {
    const payload = token.split('.')[1];
    if (!payload) return null;
    return JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/'))) as GoogleClaims;
  } catch {
    return null;
  }
}

/** Returns true if a Google credential exists in sessionStorage and has not expired. */
export function isGoogleAuthenticated(): boolean {
  const token = getGoogleCredential();
  if (!token) return false;
  const claims = decodeGoogleToken(token);
  if (!claims) return false;
  return claims.exp * 1000 > Date.now();
}

/** Returns the email from a Google credential JWT, or null. */
export function getGoogleEmail(token: string): string | null {
  return decodeGoogleToken(token)?.email ?? null;
}

/**
 * Returns the namespaced userId for a Google credential.
 * Format: `google:{sub}` — matches the partition key used in Cosmos DB.
 */
export function getGoogleSub(token: string): string | null {
  const sub = decodeGoogleToken(token)?.sub;
  return sub ? `google:${sub}` : null;
}
