import type { AccountInfo } from '@azure/msal-browser';
import { InteractionRequiredAuthError } from '@azure/msal-browser';
import { msalInstance } from '../auth/msalConfig';
import { getGoogleCredential, isGoogleAuthenticated } from '../auth/googleAuth';
import {
  clearSession,
  getStoredAccessToken,
  getStoredRefreshToken,
  isAccessTokenExpiringSoon,
  storeSession,
} from '../auth/sessionTokens';
import { API_BASE, FEATURES_AI_ENABLED } from '../config/env';
import type { ApiError } from '../types/models';

// ─── Session API helpers (low-level, bypass apiFetch to avoid circular deps) ──

interface SessionResponse {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

// Deduplication: only one exchange request in-flight at a time
let exchangeInFlight: Promise<SessionResponse | null> | null = null;

export async function exchangeOidcForSession(oidcToken: string): Promise<SessionResponse | null> {
  if (exchangeInFlight) return exchangeInFlight;
  exchangeInFlight = (async () => {
    try {
      const res = await fetch(`${API_BASE}/auth/session`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${oidcToken}` },
      });
      if (!res.ok) return null;
      return (await res.json()) as SessionResponse;
    } catch {
      return null;
    } finally {
      exchangeInFlight = null;
    }
  })();
  return exchangeInFlight;
}

async function refreshSessionTokens(refreshToken: string): Promise<SessionResponse | null> {
  try {
    const res = await fetch(`${API_BASE}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });
    if (!res.ok) return null;
    return (await res.json()) as SessionResponse;
  } catch {
    return null;
  }
}

// ─── OIDC token acquisition (fallback when no session exists) ─────────────────

async function acquireOidcToken(): Promise<string | null> {
  // Try Microsoft MSAL silent acquire
  const accounts = msalInstance.getAllAccounts();
  if (accounts.length > 0) {
    try {
      const result = await msalInstance.acquireTokenSilent({
        account: accounts[0] as AccountInfo,
        scopes: ['openid', 'profile', 'email'],
      });
      return result.idToken;
    } catch (err) {
      // If interaction is needed, try popup (preserves page state)
      if (err instanceof InteractionRequiredAuthError) {
        try {
          const result = await msalInstance.acquireTokenPopup({
            scopes: ['openid', 'profile', 'email'],
          });
          return result.idToken;
        } catch {
          // Popup failed or was blocked
        }
      }
      // Other MSAL errors — fall through
    }
  }

  // Fall back to Google credential
  if (isGoogleAuthenticated()) {
    return getGoogleCredential();
  }

  return null;
}

// ─── Token acquisition (session-first) ────────────────────────────────────────

export async function getAccessToken(): Promise<string | null> {
  // 1. Fast path: stored backend access token is still valid
  const stored = getStoredAccessToken();
  if (stored && !isAccessTokenExpiringSoon()) {
    return stored;
  }

  // 2. Access token expired/expiring — try refreshing with stored refresh token
  const refreshToken = getStoredRefreshToken();
  if (refreshToken) {
    const refreshed = await refreshSessionTokens(refreshToken);
    if (refreshed) {
      storeSession(refreshed.accessToken, refreshed.refreshToken);
      return refreshed.accessToken;
    }
    // Refresh failed (token revoked/expired) — clear stale session
    clearSession();
  }

  // 3. No session — fall back to OIDC providers, then exchange for a new session
  const oidcToken = await acquireOidcToken();
  if (oidcToken) {
    const session = await exchangeOidcForSession(oidcToken);
    if (session) {
      storeSession(session.accessToken, session.refreshToken);
      return session.accessToken;
    }
    // Exchange failed but OIDC token is still valid — use it directly (backward compat)
    return oidcToken;
  }

  return null;
}

// ─── Error type guard ─────────────────────────────────────────────────────────

export class ApiRequestError extends Error {
  statusCode: number;
  body?: ApiError;

  constructor(
    statusCode: number,
    message: string,
    body?: ApiError,
  ) {
    super(message);
    this.name = 'ApiRequestError';
    this.statusCode = statusCode;
    this.body = body;
  }
}

// ─── Core fetch wrapper ───────────────────────────────────────────────────────

async function apiFetch<T>(
  path: string,
  options: RequestInit = {},
  authenticated = true,
): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (authenticated) {
    const token = await getAccessToken();
    if (token) headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE}${path}`, { ...options, headers });

  if (!response.ok) {
    let errorBody: ApiError | undefined;
    try {
      errorBody = (await response.json()) as ApiError;
    } catch {
      // ignore parse failure
    }
    const error = new ApiRequestError(
      response.status,
      errorBody?.message ?? `HTTP ${response.status}`,
      errorBody,
    );
    // 401 on an authenticated request = token expired or invalid → signal the app
    if (authenticated && response.status === 401) {
      window.dispatchEvent(new CustomEvent('wordsprout:session-expired'));
    }
    throw error;
  }

  // Handle 204 No Content
  if (response.status === 204) return undefined as unknown as T;

  return response.json() as Promise<T>;
}

// ─── Typed API methods ────────────────────────────────────────────────────────

import {
  getEnrichment,
  type DBEnrichment,
  type DBEntry,
  type DBPhrasebook,
} from '../services/db';
import type { Language, UserQuota } from '../types/models';

// Languages (unauthenticated)
export const languagesApi = {
  list: () => apiFetch<Language[]>('/languages', {}, false),
};

// Access requests (unauthenticated)
export const accessRequestsApi = {
  create: (email: string) =>
    apiFetch<void>('/access-requests', { method: 'POST', body: JSON.stringify({ email }) }, false),
};

// Phrasebooks
export const phrasebooksApi = {
  list: () => apiFetch<DBPhrasebook[]>('/phrasebooks'),
  get: (id: string) => apiFetch<DBPhrasebook>(`/phrasebooks/${id}`),
  create: (data: Omit<DBPhrasebook, 'id' | 'userId' | 'createdAt' | 'updatedAt' | 'entryCount'>) =>
    apiFetch<DBPhrasebook>('/phrasebooks', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: string, data: Partial<DBPhrasebook>) =>
    apiFetch<DBPhrasebook>(`/phrasebooks/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  delete: (id: string) =>
    apiFetch<void>(`/phrasebooks/${id}`, { method: 'DELETE' }),
};

// Entries
export interface EntryQueryParams {
  q?: string;
  phrasebookId?: string;
  tag?: string;
  partOfSpeech?: string;
  learningState?: string;
  limit?: number;
  offset?: number;
}

export const entriesApi = {
  list: (params: EntryQueryParams = {}) => {
    const qs = new URLSearchParams(
      Object.entries(params)
        .filter(([, v]) => v !== undefined)
        .map(([k, v]) => [k, String(v)]),
    ).toString();
    return apiFetch<DBEntry[]>(`/entries${qs ? `?${qs}` : ''}`);
  },
  get: (id: string) => apiFetch<DBEntry>(`/entries/${id}`),
  create: (data: Omit<DBEntry, 'id' | 'userId' | 'createdAt' | 'updatedAt'>) =>
    apiFetch<DBEntry>('/entries', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: string, data: Partial<DBEntry>) =>
    apiFetch<DBEntry>(`/entries/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  delete: (id: string) =>
    apiFetch<void>(`/entries/${id}`, { method: 'DELETE' }),
};

// AI enrichment

export const enrichmentsApi = {
  list: () => apiFetch<DBEnrichment[]>('/enrichments'),
};

export interface EnrichResponse {
  enrichment: DBEnrichment;
  entry?: DBEntry;
}

export const enrichApi = {
  enrich: async (entryId: string, sourceText?: string, targetText?: string): Promise<EnrichResponse> => {
    if (FEATURES_AI_ENABLED) {
      const now = new Date().toISOString();

      // Read existing enrichment so we can merge additively
      const existing = await getEnrichment(entryId);

      const mergeArrays = (existing: string[], incoming: string[]) => {
        const set = new Set(existing);
        for (const v of incoming) if (!set.has(v)) set.add(v);
        return [...set];
      };

      const enrichment: DBEnrichment = {
        id: existing?.id ?? `enrichment-${entryId}`,
        userId: 'test-user-local',
        entryId,
        exampleSentences: mergeArrays(
          existing?.exampleSentences ?? [],
          [
            'She felt a sense of serendipity when she found the book she had been looking for.',
            'The discovery was pure serendipity — no one had planned it.',
          ],
        ),
        synonyms: mergeArrays(existing?.synonyms ?? [], ['happy accident', 'fortunate coincidence', 'luck']),
        antonyms: mergeArrays(existing?.antonyms ?? [], ['misfortune', 'bad luck']),
        register: existing?.register || 'neutral',
        collocations: mergeArrays(existing?.collocations ?? [], ['pure serendipity', 'by serendipity', 'serendipitous moment']),
        falseFriendWarning: existing?.falseFriendWarning || undefined,
        generatedAt: now,
        editedAt: existing?.editedAt,
      };
      // Simulate translation when targetText is empty
      if (sourceText && !targetText) {
        return {
          enrichment,
          entry: {
            id: entryId,
            userId: 'test-user-local',
            phrasebookId: '',
            sourceText,
            targetText: `[mock translation of "${sourceText}"]`,
            partOfSpeech: 'noun' as const,
            tags: [],
            learningScore: 0,
            lastReviewedDate: null,
            createdAt: now,
            updatedAt: now,
          },
        };
      }
      return {
        enrichment,
        entry: {
          id: entryId,
          userId: 'test-user-local',
          phrasebookId: '',
          sourceText: sourceText ?? '',
          targetText,
          partOfSpeech: 'noun' as const,
          tags: [],
          learningScore: 0,
          lastReviewedDate: null,
          createdAt: now,
          updatedAt: now,
        },
      };
    }
    return apiFetch<EnrichResponse>(`/entries/${entryId}/enrich`, { method: 'POST' });
  },
  patchEnrichment: (entryId: string, data: Partial<DBEnrichment>) =>
    apiFetch<DBEnrichment>(`/entries/${entryId}/enrichment`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),
};

// Quota
export const quotaApi = {
  get: () => apiFetch<UserQuota>('/users/me/quota'),
};

// Account
export async function deleteAccount(): Promise<void> {
  await apiFetch<void>('/account', { method: 'DELETE' }, true);
}
