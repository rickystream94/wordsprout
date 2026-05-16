import { vi, describe, it, expect, beforeEach } from 'vitest';
import type { HttpRequest, InvocationContext } from '@azure/functions';
import type { DecodedToken, Phrasebook, VocabularyEntry } from '../../models/types';

// ─── Hoist mocks ──────────────────────────────────────────────────────────────

const mockCosmos = vi.hoisted(() => ({
  pointRead: vi.fn(async () => null as unknown),
  upsert: vi.fn(async (doc: unknown) => doc),
  deleteItem: vi.fn(async () => undefined),
  queryByPartition: vi.fn(async () => [] as unknown[]),
  queryByPartitionPaginated: vi.fn(async () => ({ items: [], continuationToken: undefined })),
  deleteAllForPartition: vi.fn(async () => 0),
  queryById: vi.fn(async () => [] as unknown[]),
  queryByTagInPartition: vi.fn(async () => [] as unknown[]),
}));

const TEST_TOKEN: DecodedToken = {
  sub: 'user-1',
  email: 'user@test.com',
  iss: 'wordsprout',
  iat: 0,
  exp: 9999999999,
};

type HandlerFn = (req: HttpRequest, ctx: InvocationContext) => Promise<unknown>;
const handlers = vi.hoisted(() => new Map<string, HandlerFn>());

vi.mock('@azure/functions', () => ({
  app: {
    http: vi.fn((name: string, opts: { handler: HandlerFn }) => {
      handlers.set(name, opts.handler);
    }),
  },
}));
vi.mock('../../services/cosmos', () => ({ cosmosClient: mockCosmos }));
vi.mock('isomorphic-dompurify', () => ({
  default: { sanitize: (v: unknown) => (typeof v === 'string' ? v : '') },
}));
vi.mock('../../utils/http', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../utils/http')>();
  return {
    ...actual,
    // Bypass auth — inject test token directly
    authenticated: (fn: (req: HttpRequest, ctx: InvocationContext, token: DecodedToken) => Promise<unknown>) =>
      (req: HttpRequest, ctx: InvocationContext) => fn(req, ctx, TEST_TOKEN),
  };
});

// Import module to register handlers
await import('../entries');

// ─── Helpers ──────────────────────────────────────────────────────────────────

function mockRequest(opts: {
  body?: unknown;
  params?: Record<string, string>;
  method?: string;
  query?: URLSearchParams;
}): HttpRequest {
  return {
    json: vi.fn().mockResolvedValue(opts.body ?? {}),
    text: vi.fn().mockResolvedValue(JSON.stringify(opts.body ?? {})),
    headers: { get: () => null },
    params: opts.params ?? {},
    method: opts.method ?? 'POST',
    url: 'http://localhost/api/test',
    query: opts.query ?? new URLSearchParams(),
  } as unknown as HttpRequest;
}

const mockCtx = { log: vi.fn(), error: vi.fn(), warn: vi.fn() } as unknown as InvocationContext;

const MOCK_PHRASEBOOK: Phrasebook = {
  id: 'pb-1',
  userId: 'user-1',
  type: 'phrasebook',
  name: 'Test Book',
  sourceLanguage: 'Italian',
  targetLanguage: 'English',
  entryCount: 0,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

// ─── createEntry ───────────────────────────────────────────────────────────────

describe('createEntry', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCosmos.pointRead.mockResolvedValue(MOCK_PHRASEBOOK);
    mockCosmos.queryByPartition.mockResolvedValue([]);
  });

  it('returns 201 with new entry on success', async () => {
    const handler = handlers.get('entries-create')!;
    const res = await handler(
      mockRequest({ body: { phrasebookId: 'pb-1', sourceText: 'ciao' } }),
      mockCtx,
    ) as { status: number; jsonBody: unknown };

    expect(res.status).toBe(201);
    expect((res.jsonBody as Record<string, unknown>).sourceText).toBe('ciao');
    expect((res.jsonBody as Record<string, unknown>).userId).toBe('user-1');
  });

  it('returns 400 when phrasebookId is missing', async () => {
    const handler = handlers.get('entries-create')!;
    const res = await handler(
      mockRequest({ body: { sourceText: 'ciao' } }),
      mockCtx,
    ) as { status: number };

    expect(res.status).toBe(400);
  });

  it('returns 400 when sourceText is missing', async () => {
    const handler = handlers.get('entries-create')!;
    const res = await handler(
      mockRequest({ body: { phrasebookId: 'pb-1' } }),
      mockCtx,
    ) as { status: number };

    expect(res.status).toBe(400);
  });

  it('returns 404 when phrasebook is not found', async () => {
    mockCosmos.pointRead.mockResolvedValueOnce(null);

    const handler = handlers.get('entries-create')!;
    const res = await handler(
      mockRequest({ body: { phrasebookId: 'pb-missing', sourceText: 'ciao' } }),
      mockCtx,
    ) as { status: number };

    expect(res.status).toBe(404);
  });

  it('returns 409 when duplicate sourceText exists', async () => {
    const existingEntry: Partial<VocabularyEntry> = {
      id: 'existing-entry-1',
      type: 'entry',
      sourceText: 'ciao',
      phrasebookId: 'pb-1',
    };
    mockCosmos.queryByPartition.mockResolvedValue([existingEntry]);

    const handler = handlers.get('entries-create')!;
    const res = await handler(
      mockRequest({ body: { phrasebookId: 'pb-1', sourceText: 'ciao' } }),
      mockCtx,
    ) as { status: number };

    expect(res.status).toBe(409);
  });

  it('upserts the entry and increments phrasebook entryCount', async () => {
    const handler = handlers.get('entries-create')!;
    await handler(
      mockRequest({ body: { phrasebookId: 'pb-1', sourceText: 'ciao' } }),
      mockCtx,
    );

    expect(mockCosmos.upsert).toHaveBeenCalledTimes(2);
    // Second upsert updates phrasebook with entryCount=1
    const pbUpdate = mockCosmos.upsert.mock.calls[1][0] as Phrasebook;
    expect(pbUpdate.entryCount).toBe(1);
  });

  it('normalizes sourceText to lowercase', async () => {
    const handler = handlers.get('entries-create')!;
    const res = await handler(
      mockRequest({ body: { phrasebookId: 'pb-1', sourceText: 'CIAO' } }),
      mockCtx,
    ) as { status: number; jsonBody: unknown };

    expect(res.status).toBe(201);
    expect((res.jsonBody as Record<string, unknown>).sourceText).toBe('ciao');
  });
});

// ─── getEntry ──────────────────────────────────────────────────────────────────

describe('getEntry', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 200 with entry when found', async () => {
    const entry: Partial<VocabularyEntry> = {
      id: 'entry-1',
      userId: 'user-1',
      type: 'entry',
      sourceText: 'ciao',
    };
    mockCosmos.pointRead.mockResolvedValue(entry);

    const handler = handlers.get('entries-get')!;
    const res = await handler(
      mockRequest({ params: { id: 'entry-1' }, method: 'GET' }),
      mockCtx,
    ) as { status: number; jsonBody: unknown };

    expect(res.status).toBe(200);
    expect((res.jsonBody as Record<string, unknown>).id).toBe('entry-1');
  });

  it('returns 404 when entry not found', async () => {
    mockCosmos.pointRead.mockResolvedValue(null);

    const handler = handlers.get('entries-get')!;
    const res = await handler(
      mockRequest({ params: { id: 'missing-id' }, method: 'GET' }),
      mockCtx,
    ) as { status: number };

    expect(res.status).toBe(404);
  });

  it('returns 400 when id param is missing', async () => {
    const handler = handlers.get('entries-get')!;
    const res = await handler(
      mockRequest({ params: {}, method: 'GET' }),
      mockCtx,
    ) as { status: number };

    expect(res.status).toBe(400);
  });
});
