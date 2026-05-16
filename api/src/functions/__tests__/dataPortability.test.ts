import { vi, describe, it, expect, beforeEach } from 'vitest';
import type { HttpRequest, InvocationContext } from '@azure/functions';
import type { DecodedToken, ExportPackage } from '../../models/types';

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
    authenticated: (fn: (req: HttpRequest, ctx: InvocationContext, token: DecodedToken) => Promise<unknown>) =>
      (req: HttpRequest, ctx: InvocationContext) => fn(req, ctx, TEST_TOKEN),
  };
});

await import('../dataPortability');

// ─── Helpers ──────────────────────────────────────────────────────────────────

const VALID_PACKAGE: ExportPackage = {
  schemaVersion: 1,
  app: 'wordsprout',
  exportedAt: new Date().toISOString(),
  data: {
    phrasebooks: [
      {
        id: 'pb-1',
        name: 'Test Book',
        sourceLanguageCode: 'it',
        targetLanguageCode: 'en',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ],
    entries: [
      {
        id: 'entry-1',
        phrasebookId: 'pb-1',
        sourceText: 'ciao',
        tags: [],
        learningScore: 0,
        lastReviewedDate: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ],
    enrichments: [],
  },
};

function mockRequest(opts: {
  body?: unknown;
  headers?: Record<string, string>;
  method?: string;
}): HttpRequest {
  return {
    json: vi.fn().mockResolvedValue(opts.body ?? VALID_PACKAGE),
    text: vi.fn().mockResolvedValue(JSON.stringify(opts.body ?? VALID_PACKAGE)),
    headers: {
      get: (name: string) => opts.headers?.[name.toLowerCase()] ?? null,
    },
    params: {},
    method: opts.method ?? 'POST',
    url: 'http://localhost/api/data/import',
    query: new URLSearchParams(),
  } as unknown as HttpRequest;
}

const mockCtx = { log: vi.fn(), error: vi.fn(), warn: vi.fn() } as unknown as InvocationContext;

// ─── importData tests ────────────────────────────────────────────────────────

describe('importData', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCosmos.queryByPartition.mockResolvedValue([]);
    mockCosmos.pointRead.mockResolvedValue(null);
  });

  it('returns 400 when body is not valid JSON', async () => {
    const badReq: HttpRequest = {
      json: vi.fn().mockRejectedValue(new SyntaxError('bad json')),
      headers: { get: () => null },
      params: {},
      method: 'POST',
      url: 'http://localhost/api/data/import',
    } as unknown as HttpRequest;

    const handler = handlers.get('data-import')!;
    const res = await handler(badReq, mockCtx) as { status: number };

    expect(res.status).toBe(400);
  });

  it('returns 422 when schemaVersion is missing', async () => {
    const handler = handlers.get('data-import')!;
    const res = await handler(
      mockRequest({ body: { app: 'wordsprout', data: {} } }),
      mockCtx,
    ) as { status: number };

    expect(res.status).toBe(422);
  });

  it('returns 422 when schemaVersion is not 1', async () => {
    const handler = handlers.get('data-import')!;
    const res = await handler(
      mockRequest({ body: { ...VALID_PACKAGE, schemaVersion: 2 } }),
      mockCtx,
    ) as { status: number };

    expect(res.status).toBe(422);
  });

  it('returns 422 when app is not "wordsprout"', async () => {
    const handler = handlers.get('data-import')!;
    const res = await handler(
      mockRequest({ body: { ...VALID_PACKAGE, app: 'other-app' } }),
      mockCtx,
    ) as { status: number };

    expect(res.status).toBe(422);
  });

  it('returns 422 when phrasebooks array is missing', async () => {
    const handler = handlers.get('data-import')!;
    const res = await handler(
      mockRequest({ body: { ...VALID_PACKAGE, data: { entries: [], enrichments: [] } } }),
      mockCtx,
    ) as { status: number };

    expect(res.status).toBe(422);
  });

  it('returns 422 when a phrasebook is missing required fields', async () => {
    const handler = handlers.get('data-import')!;
    const res = await handler(
      mockRequest({
        body: {
          ...VALID_PACKAGE,
          data: {
            ...VALID_PACKAGE.data,
            phrasebooks: [{ id: 'pb-1' }], // Missing name, sourceLanguageCode, etc.
          },
        },
      }),
      mockCtx,
    ) as { status: number };

    expect(res.status).toBe(422);
  });

  it('returns 422 when an entry is missing required fields', async () => {
    const handler = handlers.get('data-import')!;
    const res = await handler(
      mockRequest({
        body: {
          ...VALID_PACKAGE,
          data: {
            ...VALID_PACKAGE.data,
            entries: [{ id: 'entry-1' }], // Missing sourceText, phrasebookId
          },
        },
      }),
      mockCtx,
    ) as { status: number };

    expect(res.status).toBe(422);
  });

  it('returns 413 when Content-Length exceeds 10MB', async () => {
    const handler = handlers.get('data-import')!;
    const bigSize = 11 * 1024 * 1024;
    const res = await handler(
      mockRequest({ headers: { 'content-length': String(bigSize) } }),
      mockCtx,
    ) as { status: number };

    expect(res.status).toBe(413);
  });

  it('returns 200 with import results for valid package', async () => {
    const handler = handlers.get('data-import')!;
    const res = await handler(mockRequest({}), mockCtx) as { status: number; jsonBody: unknown };

    expect(res.status).toBe(200);
  });
});
