import { vi, describe, it, expect, beforeEach } from 'vitest';
import type { HttpRequest, InvocationContext } from '@azure/functions';
import type { DecodedToken } from '../../models/types';

// ─── Hoist mocks ──────────────────────────────────────────────────────────────

const mockCosmos = vi.hoisted(() => ({
  pointRead: vi.fn(async () => null as unknown),
  upsert: vi.fn(async (doc: unknown) => doc),
  deleteItem: vi.fn(async () => undefined),
  queryByPartition: vi.fn(async () => [] as unknown[]),
  queryByPartitionPaginated: vi.fn(async () => ({ items: [], continuationToken: undefined })),
  deleteAllForPartition: vi.fn(async () => 3),
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
vi.mock('../../utils/http', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../utils/http')>();
  return {
    ...actual,
    authenticated: (fn: (req: HttpRequest, ctx: InvocationContext, token: DecodedToken) => Promise<unknown>) =>
      (req: HttpRequest, ctx: InvocationContext) => fn(req, ctx, TEST_TOKEN),
  };
});

await import('../account');

// ─── Helpers ──────────────────────────────────────────────────────────────────

function mockRequest(): HttpRequest {
  return {
    json: vi.fn().mockResolvedValue({}),
    headers: { get: () => null },
    params: {},
    method: 'DELETE',
    url: 'http://localhost/api/account',
  } as unknown as HttpRequest;
}

const mockCtx = { log: vi.fn(), error: vi.fn(), warn: vi.fn() } as unknown as InvocationContext;

// ─── Tests ─────────────────────────────────────────────────────────────────────

describe('account-delete', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCosmos.deleteAllForPartition.mockResolvedValue(3);
  });

  it('returns 204 after deleting all user data', async () => {
    const handler = handlers.get('account-delete')!;
    const res = await handler(mockRequest(), mockCtx) as { status: number };

    expect(res.status).toBe(204);
  });

  it('calls deleteAllForPartition with user sub as partition key', async () => {
    const handler = handlers.get('account-delete')!;
    await handler(mockRequest(), mockCtx);

    expect(mockCosmos.deleteAllForPartition).toHaveBeenCalledWith('user-1');
  });

  it('returns 500 when deleteAllForPartition throws', async () => {
    mockCosmos.deleteAllForPartition.mockRejectedValue(new Error('Cosmos error'));

    const handler = handlers.get('account-delete')!;
    const res = await handler(mockRequest(), mockCtx) as { status: number };

    expect(res.status).toBe(500);
  });
});
