import type { AccountInfo } from '@azure/msal-browser';
import { msalInstance } from '../auth/msalConfig';
import { API_BASE, IS_LOCAL } from '../config/env';
import type { ApiError } from '../types/models';

// ─── Token acquisition ────────────────────────────────────────────────────────

async function getAccessToken(): Promise<string | null> {
  if (IS_LOCAL) return 'local-bypass-token';

  const accounts = msalInstance.getAllAccounts();
  if (accounts.length === 0) return null;

  try {
    const result = await msalInstance.acquireTokenSilent({
      account: accounts[0] as AccountInfo,
      scopes: [`https://${import.meta.env.VITE_B2C_TENANT ?? ''}.onmicrosoft.com/api/user`],
    });
    return result.accessToken;
  } catch {
    return null;
  }
}

// ─── Error type guard ─────────────────────────────────────────────────────────

export class ApiRequestError extends Error {
  constructor(
    public statusCode: number,
    message: string,
    public body?: ApiError,
  ) {
    super(message);
    this.name = 'ApiRequestError';
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
    throw new ApiRequestError(
      response.status,
      errorBody?.message ?? `HTTP ${response.status}`,
      errorBody,
    );
  }

  // Handle 204 No Content
  if (response.status === 204) return undefined as unknown as T;

  return response.json() as Promise<T>;
}

// ─── Typed API methods ────────────────────────────────────────────────────────

import type {
  DBEnrichment,
  DBEntry,
  DBPhrasebook,
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
export const enrichApi = {
  enrich: (entryId: string): Promise<DBEnrichment> => {
    if (IS_LOCAL) {
      const now = new Date().toISOString();
      return Promise.resolve({
        id: `enrichment-${entryId}`,
        userId: 'test-user-local',
        entryId,
        exampleSentences: [
          'She felt a sense of serendipity when she found the book she had been looking for.',
          'The discovery was pure serendipity — no one had planned it.',
        ],
        synonyms: ['happy accident', 'fortunate coincidence', 'luck'],
        antonyms: ['misfortune', 'bad luck'],
        register: 'neutral',
        collocations: ['pure serendipity', 'by serendipity', 'serendipitous moment'],
        falseFriendWarning: undefined,
        generatedAt: now,
      });
    }
    return apiFetch<DBEnrichment>(`/entries/${entryId}/enrich`, { method: 'POST' });
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
