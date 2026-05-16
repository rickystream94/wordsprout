import { vi, describe, it, expect, beforeEach } from 'vitest';
import type { HttpRequest, InvocationContext } from '@azure/functions';

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

const mockAuthorise = vi.hoisted(() => vi.fn(async () => ({
  sub: 'user-1',
  email: 'user@test.com',
  iss: 'wordsprout',
  iat: 0,
  exp: 9999999999,
})));

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
vi.mock('../../middleware/authorise', () => ({ authorise: mockAuthorise }));
vi.mock('../../config/env', () => ({
  AI_DAILY_ENRICHMENT_LIMIT: 20,
  IS_LOCAL: true,
  APP_ENV: 'local',
}));

await import('../quota');

// ─── Helpers ──────────────────────────────────────────────────────────────────

function mockRequest(): HttpRequest {
  return {
    json: vi.fn().mockResolvedValue({}),
    headers: { get: () => null },
    params: {},
    method: 'GET',
    url: 'http://localhost/api/users/me/quota',
  } as unknown as HttpRequest;
}

const mockCtx = { log: vi.fn(), error: vi.fn(), warn: vi.fn() } as unknown as InvocationContext;

// ─── Tests ─────────────────────────────────────────────────────────────────────

describe('getQuota', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthorise.mockResolvedValue({
      sub: 'user-1',
      email: 'user@test.com',
      iss: 'wordsprout',
      iat: 0,
      exp: 9999999999,
    });
  });

  it('returns 200 with zero quota when no user document exists', async () => {
    mockCosmos.pointRead.mockResolvedValue(null);

    const handler = handlers.get('getQuota')!;
    const res = await handler(mockRequest(), mockCtx) as { status: number; jsonBody: unknown };

    expect(res.status).toBe(200);
    const body = res.jsonBody as Record<string, unknown>;
    expect(body.aiQuotaUsedToday).toBe(0);
    expect(body.aiDailyEnrichmentLimit).toBe(20);
    expect(body.aiQuotaResetAt).toBeTruthy();
  });

  it('returns current quota usage when quota window has not expired', async () => {
    const futureReset = new Date(Date.now() + 3600000).toISOString();
    mockCosmos.pointRead.mockResolvedValue({
      id: 'user-1',
      userId: 'user-1',
      type: 'user',
      aiQuotaUsedToday: 5,
      aiQuotaResetAt: futureReset,
    });

    const handler = handlers.get('getQuota')!;
    const res = await handler(mockRequest(), mockCtx) as { status: number; jsonBody: unknown };

    const body = res.jsonBody as Record<string, unknown>;
    expect(body.aiQuotaUsedToday).toBe(5);
    expect(body.aiQuotaResetAt).toBe(futureReset);
  });

  it('resets quota when aiQuotaResetAt is in the past', async () => {
    const pastReset = new Date(Date.now() - 3600000).toISOString();
    mockCosmos.pointRead.mockResolvedValue({
      id: 'user-1',
      userId: 'user-1',
      type: 'user',
      aiQuotaUsedToday: 15,
      aiQuotaResetAt: pastReset,
    });

    const handler = handlers.get('getQuota')!;
    const res = await handler(mockRequest(), mockCtx) as { status: number; jsonBody: unknown };

    const body = res.jsonBody as Record<string, unknown>;
    expect(body.aiQuotaUsedToday).toBe(0);
    // New reset time should be in the future
    expect(new Date(body.aiQuotaResetAt as string).getTime()).toBeGreaterThan(Date.now());
  });

  it('returns 401 when authorise throws 401', async () => {
    mockAuthorise.mockRejectedValue({ statusCode: 401, message: 'Missing token' });

    const handler = handlers.get('getQuota')!;
    const res = await handler(mockRequest(), mockCtx) as { status: number };

    expect(res.status).toBe(401);
  });
});
