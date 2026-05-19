import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';

// ─── Hoisted mocks ────────────────────────────────────────────────────────────

const {
  mockMeta, mockPhrasebooks, mockEntries, mockEnrichments, mockPendingSync, mockTransaction,
  mockPhrasebooksApi, mockEntriesApi, mockEnrichmentsApi, mockRebuildIndex,
} = vi.hoisted(() => {
  return {
    mockMeta: { get: vi.fn(async () => null as unknown), put: vi.fn(async () => undefined) },
    mockPhrasebooks: { count: vi.fn(async () => 0), clear: vi.fn(async () => undefined), bulkPut: vi.fn(async () => undefined) },
    mockEntries: { count: vi.fn(async () => 0), clear: vi.fn(async () => undefined), bulkPut: vi.fn(async () => undefined) },
    mockEnrichments: { count: vi.fn(async () => 0), clear: vi.fn(async () => undefined), bulkPut: vi.fn(async () => undefined) },
    mockPendingSync: { where: vi.fn(), add: vi.fn(async () => undefined) },
    mockTransaction: vi.fn(async (...args: unknown[]) => {
      const fn = args[args.length - 1] as () => Promise<void>;
      return fn();
    }),
    mockPhrasebooksApi: { list: vi.fn(async () => []) },
    mockEntriesApi: { list: vi.fn(async () => ({ items: [], nextContinuationToken: undefined })) },
    mockEnrichmentsApi: { list: vi.fn(async () => []) },
    mockRebuildIndex: vi.fn(async () => undefined),
  };
});

vi.mock('../db', () => ({
  db: {
    meta: mockMeta,
    phrasebooks: mockPhrasebooks,
    entries: mockEntries,
    enrichments: mockEnrichments,
    pendingSync: mockPendingSync,
    transaction: mockTransaction,
  },
}));

vi.mock('../api', () => ({
  ApiRequestError: class ApiRequestError extends Error {
    statusCode: number;
    constructor(statusCode: number, message: string) {
      super(message);
      this.statusCode = statusCode;
    }
  },
  getAccessToken: vi.fn(async () => 'mock-token'),
  phrasebooksApi: mockPhrasebooksApi,
  entriesApi: mockEntriesApi,
  enrichmentsApi: mockEnrichmentsApi,
}));

vi.mock('../search', () => ({ rebuildIndex: mockRebuildIndex }));

vi.mock('dexie-react-hooks', () => ({ useLiveQuery: vi.fn() }));

import {
  pullFromServer,
  enqueueMutation,
  isSyncing,
  getNextSyncAt,
  PULL_TTL_MS,
} from '../sync';

// ─── Tests ─────────────────────────────────────────────────────────────────────

describe('pullFromServer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPhrasebooks.count.mockResolvedValue(0);
    mockEnrichments.count.mockResolvedValue(0);
    mockMeta.get.mockResolvedValue(null);
    mockPendingSync.where.mockReturnValue({
      anyOf: vi.fn().mockReturnValue({
        count: vi.fn().mockResolvedValue(0),
      }),
    });
    mockEntriesApi.list.mockResolvedValue({ items: [], nextContinuationToken: undefined });
  });

  it('calls phrasebooksApi.list when db is empty', async () => {
    await pullFromServer();
    expect(mockPhrasebooksApi.list).toHaveBeenCalled();
  });

  it('skips network call when pull is fresh and db is not empty', async () => {
    // Both counts > 0 and fresh pull
    mockPhrasebooks.count.mockResolvedValue(5);
    mockEnrichments.count.mockResolvedValue(3);
    const freshPullTime = Date.now() - (PULL_TTL_MS / 2); // half the TTL, still fresh
    mockMeta.get.mockResolvedValue({ key: 'lastPull', value: String(freshPullTime) });

    await pullFromServer();

    expect(mockPhrasebooksApi.list).not.toHaveBeenCalled();
  });

  it('fetches data when pull is stale even with non-empty db', async () => {
    mockPhrasebooks.count.mockResolvedValue(5);
    mockEnrichments.count.mockResolvedValue(3);
    const stalePullTime = Date.now() - (PULL_TTL_MS + 60000); // past TTL
    mockMeta.get.mockResolvedValue({ key: 'lastPull', value: String(stalePullTime) });

    await pullFromServer();

    expect(mockPhrasebooksApi.list).toHaveBeenCalled();
  });

  it('rebuilds search index after pulling', async () => {
    await pullFromServer();
    expect(mockRebuildIndex).toHaveBeenCalled();
  });

  it('does not call phrasebooksApi.list when pull is already in progress', async () => {
    // Start two concurrent pulls; only the first should run
    const p1 = pullFromServer();
    const p2 = pullFromServer();
    await Promise.all([p1, p2]);

    // Due to in-progress guard, phrasebooksApi.list should be called only once
    expect(mockPhrasebooksApi.list).toHaveBeenCalledTimes(1);
  });
});

describe('enqueueMutation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPendingSync.add.mockResolvedValue(undefined);
    // Simulate offline to prevent immediate replayQueue trigger
    vi.stubGlobal('navigator', { onLine: false });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('adds a mutation to the pendingSync table', async () => {
    await enqueueMutation('/api/entries', 'POST', { sourceText: 'ciao' });

    expect(mockPendingSync.add).toHaveBeenCalledOnce();
    const [doc] = mockPendingSync.add.mock.calls[0] as unknown as [Record<string, unknown>];
    expect(doc.url).toBe('/api/entries');
    expect(doc.method).toBe('POST');
    expect(doc.status).toBe('pending');
  });

  it('serializes the body to JSON string', async () => {
    const body = { key: 'value' };
    await enqueueMutation('/api/test', 'PUT', body);

    const [doc] = mockPendingSync.add.mock.calls[0] as unknown as [Record<string, unknown>];
    expect(doc.body).toBe(JSON.stringify(body));
  });

  it('adds mutation without body when body is undefined', async () => {
    await enqueueMutation('/api/entries/1', 'DELETE');

    const [doc] = mockPendingSync.add.mock.calls[0] as unknown as [Record<string, unknown>];
    expect(doc.body).toBeUndefined();
    expect(doc.method).toBe('DELETE');
  });
});

describe('isSyncing / getNextSyncAt', () => {
  it('isSyncing returns a boolean', () => {
    expect(typeof isSyncing()).toBe('boolean');
  });

  it('getNextSyncAt returns a number', () => {
    expect(typeof getNextSyncAt()).toBe('number');
  });
});

describe('replayQueue — permanent-400 discards', () => {
  const mockFetch = vi.fn();

  // Reuse the hoisted pendingSync mock, extend it with update/delete for replayQueue
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('fetch', mockFetch);
    (mockPendingSync as Record<string, unknown>).update = vi.fn(async () => undefined);
    (mockPendingSync as Record<string, unknown>).delete = vi.fn(async () => undefined);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  /** Wire pendingSync to return one mutation, and fetch to return a 400 with a specific message. */
  async function runWithError(mutationId: number, responseMessage: string) {
    const mutation = {
      id: mutationId,
      url: 'http://localhost:7071/api/entries/entry-1',
      method: 'PUT' as const,
      body: '{}',
      retryCount: 0,
      status: 'pending',
      createdAt: new Date().toISOString(),
    };

    mockPendingSync.where.mockReturnValue({
      anyOf: vi.fn().mockReturnValue({
        toArray: vi.fn(async () => [mutation]),
        count: vi.fn(async () => 1),
      }),
    });

    mockFetch.mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => ({ message: responseMessage }),
    });

    const { replayQueue } = await import('../sync');
    await replayQueue();
  }

  it('discards a mutation when server responds with delta-guard error', async () => {
    await runWithError(1, 'learningScore delta must be between -5 and +10');
    expect((mockPendingSync as Record<string, unknown>).delete).toHaveBeenCalledWith(1);
  });

  it('discards a mutation when server responds with sourceText allowlist error', async () => {
    await runWithError(2, 'sourceText contains invalid characters. Only letters, numbers, spaces and common punctuation are allowed.');
    expect((mockPendingSync as Record<string, unknown>).delete).toHaveBeenCalledWith(2);
  });

  it('discards a mutation when server responds with targetText allowlist error', async () => {
    await runWithError(3, 'targetText contains invalid characters. Only letters, numbers, spaces and common punctuation are allowed.');
    expect((mockPendingSync as Record<string, unknown>).delete).toHaveBeenCalledWith(3);
  });
});
