import type { IPublicClientApplication, AccountInfo } from '@azure/msal-browser';

// ─── Local cache ─────────────────────────────────────────────────────────────
// Profile photos are cached as data URLs for 24 hours to avoid repeated Graph
// calls on every page load. The cache key is scoped to the account's localAccountId
// so photos never bleed between accounts.

const CACHE_KEY_PREFIX = 'wordsprout:ms_photo:';
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

interface PhotoCache {
  dataUrl: string;
  cachedAt: number;
}

function readPhotoCache(localAccountId: string): string | null {
  try {
    const raw = localStorage.getItem(`${CACHE_KEY_PREFIX}${localAccountId}`);
    if (!raw) return null;
    const entry = JSON.parse(raw) as PhotoCache;
    if (Date.now() - entry.cachedAt > CACHE_TTL_MS) {
      localStorage.removeItem(`${CACHE_KEY_PREFIX}${localAccountId}`);
      return null;
    }
    return entry.dataUrl;
  } catch {
    return null;
  }
}

function writePhotoCache(localAccountId: string, dataUrl: string): void {
  const entry: PhotoCache = { dataUrl, cachedAt: Date.now() };
  try {
    localStorage.setItem(`${CACHE_KEY_PREFIX}${localAccountId}`, JSON.stringify(entry));
  } catch {
    // localStorage quota exceeded — silently skip caching
  }
}

export function clearMsPhotoCache(localAccountId: string): void {
  localStorage.removeItem(`${CACHE_KEY_PREFIX}${localAccountId}`);
}

// ─── Graph photo fetch ────────────────────────────────────────────────────────

/**
 * Fetches the signed-in Microsoft user's 48×48 profile photo via MS Graph.
 * Returns a data URL string on success, or null if the user has no photo or
 * the request fails for any reason. Results are cached in localStorage for 24h.
 */
export async function fetchMsProfilePhoto(
  account: AccountInfo,
  instance: IPublicClientApplication,
): Promise<string | null> {
  const cached = readPhotoCache(account.localAccountId);
  if (cached) return cached;

  let accessToken: string;
  try {
    const result = await instance.acquireTokenSilent({
      account,
      scopes: ['User.Read'],
    });
    accessToken = result.accessToken;
  } catch {
    // Silent token acquisition failed — skip photo rather than forcing interaction
    return null;
  }

  // Try the 48×48 thumbnail first; fall back to the unsized endpoint which
  // has broader support across account types (incl. some personal MSA accounts).
  let response: Response;
  try {
    response = await fetch('https://graph.microsoft.com/v1.0/me/photos/48x48/$value', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!response.ok) {
      response = await fetch('https://graph.microsoft.com/v1.0/me/photo/$value', {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
    }
  } catch {
    return null;
  }

  if (!response.ok) return null; // no photo available for this account

  const blob = await response.blob();
  return new Promise<string | null>((resolve) => {
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      writePhotoCache(account.localAccountId, dataUrl);
      resolve(dataUrl);
    };
    reader.onerror = () => resolve(null);
    reader.readAsDataURL(blob);
  });
}
