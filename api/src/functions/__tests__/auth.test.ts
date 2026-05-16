import { vi, describe, it, expect, beforeEach } from 'vitest';
import type { HttpRequest, InvocationContext } from '@azure/functions';

// ─── Hoist mocks ──────────────────────────────────────────────────────────────

const mockCosmos = vi.hoisted(() => ({
  pointRead: vi.fn(async () => null as unknown),
  upsert: vi.fn(async (doc: unknown) => doc),
  deleteItem: vi.fn(async () => undefined),
  queryById: vi.fn(async () => [] as unknown[]),
  queryByPartition: vi.fn(async () => [] as unknown[]),
  queryByPartitionPaginated: vi.fn(async () => ({ items: [], continuationToken: undefined })),
  deleteAllForPartition: vi.fn(async () => 0),
  queryByTagInPartition: vi.fn(async () => [] as unknown[]),
}));

const mockAuthorise = vi.hoisted(() => vi.fn(async () => ({
  sub: 'user-1',
  email: 'user@test.com',
  iss: 'wordsprout',
  iat: 0,
  exp: 9999999999,
})));

const mockCreateSession = vi.hoisted(() => vi.fn(async () => ({
  accessToken: 'test-access-token',
  refreshToken: 'test-refresh-token',
  expiresIn: 900,
})));
const mockLookupSessionUser = vi.hoisted(() => vi.fn(async () => null as unknown));
const mockRefreshSession = vi.hoisted(() => vi.fn(async () => null as unknown));
const mockRevokeSession = vi.hoisted(() => vi.fn(async () => undefined));

// Capture registered Azure Function handlers
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
vi.mock('../../services/session', () => ({
  createSession: mockCreateSession,
  lookupSessionUser: mockLookupSessionUser,
  refreshSession: mockRefreshSession,
  revokeSession: mockRevokeSession,
}));
vi.mock('../../config/env', () => ({
  IS_LOCAL: true,
  APP_ENV: 'local',
}));

// Import the module — this triggers app.http registrations
await import('../auth');

// ─── Helpers ──────────────────────────────────────────────────────────────────

function mockRequest(body: unknown = {}, headers: Record<string, string> = {}): HttpRequest {
  return {
    json: vi.fn().mockResolvedValue(body),
    text: vi.fn().mockResolvedValue(JSON.stringify(body)),
    headers: { get: (name: string) => headers[name.toLowerCase()] ?? null },
    params: {},
    method: 'POST',
    url: 'http://localhost/api/test',
  } as unknown as HttpRequest;
}

const mockCtx = { log: vi.fn(), error: vi.fn(), warn: vi.fn() } as unknown as InvocationContext;

// ─── POST /auth/session ───────────────────────────────────────────────────────

describe('auth-session-create', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthorise.mockResolvedValue({
      sub: 'user-1',
      email: 'user@test.com',
      iss: 'wordsprout',
      iat: 0,
      exp: 9999999999,
    });
    mockCreateSession.mockResolvedValue({
      accessToken: 'test-access-token',
      refreshToken: 'test-refresh-token',
      expiresIn: 900,
    });
  });

  it('returns 200 with session tokens on success', async () => {
    const handler = handlers.get('auth-session-create')!;
    const res = await handler(mockRequest(), mockCtx) as { status: number; jsonBody: unknown };

    expect(res.status).toBe(200);
    expect((res.jsonBody as Record<string, unknown>).accessToken).toBe('test-access-token');
  });

  it('calls createSession with sub and email from token', async () => {
    const handler = handlers.get('auth-session-create')!;
    await handler(mockRequest(), mockCtx);

    expect(mockCreateSession).toHaveBeenCalledWith('user-1', 'user@test.com', 'microsoft');
  });

  it('returns error response when authorise throws', async () => {
    mockAuthorise.mockRejectedValue({ statusCode: 401, message: 'Bad token' });

    const handler = handlers.get('auth-session-create')!;
    const res = await handler(mockRequest(), mockCtx) as { status: number };

    expect(res.status).toBe(401);
  });

  it('sets provider to "google" for google: prefixed sub', async () => {
    mockAuthorise.mockResolvedValue({
      sub: 'google:google-sub-123',
      email: 'user@gmail.com',
      iss: 'accounts.google.com',
      iat: 0,
      exp: 9999999999,
    });

    const handler = handlers.get('auth-session-create')!;
    await handler(mockRequest(), mockCtx);

    expect(mockCreateSession).toHaveBeenCalledWith('google:google-sub-123', 'user@gmail.com', 'google');
  });
});

// ─── POST /auth/refresh ───────────────────────────────────────────────────────

describe('auth-session-refresh', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 400 when refreshToken is missing from body', async () => {
    const handler = handlers.get('auth-session-refresh')!;
    const res = await handler(mockRequest({}), mockCtx) as { status: number };

    expect(res.status).toBe(400);
  });

  it('returns 401 when lookupSessionUser returns null', async () => {
    mockLookupSessionUser.mockResolvedValue(null);

    const handler = handlers.get('auth-session-refresh')!;
    const res = await handler(
      mockRequest({ refreshToken: 'old-token' }),
      mockCtx,
    ) as { status: number };

    expect(res.status).toBe(401);
  });

  it('returns 401 when refreshSession returns null', async () => {
    mockLookupSessionUser.mockResolvedValue({
      userId: 'user-1',
      email: 'user@test.com',
      provider: 'entra',
    });
    mockRefreshSession.mockResolvedValue(null);

    const handler = handlers.get('auth-session-refresh')!;
    const res = await handler(
      mockRequest({ refreshToken: 'stale-token' }),
      mockCtx,
    ) as { status: number };

    expect(res.status).toBe(401);
  });

  it('returns 200 with new tokens on successful rotation', async () => {
    mockLookupSessionUser.mockResolvedValue({
      userId: 'user-1',
      email: 'user@test.com',
      provider: 'entra',
    });
    mockRefreshSession.mockResolvedValue({
      accessToken: 'new-access-token',
      refreshToken: 'new-refresh-token',
      expiresIn: 900,
    });

    const handler = handlers.get('auth-session-refresh')!;
    const res = await handler(
      mockRequest({ refreshToken: 'valid-refresh-token' }),
      mockCtx,
    ) as { status: number; jsonBody: unknown };

    expect(res.status).toBe(200);
    expect((res.jsonBody as Record<string, unknown>).accessToken).toBe('new-access-token');
  });

  it('returns 400 when request body is not valid JSON', async () => {
    const badReq = {
      json: vi.fn().mockRejectedValue(new SyntaxError('Unexpected token')),
      headers: { get: () => null },
      params: {},
    } as unknown as HttpRequest;

    const handler = handlers.get('auth-session-refresh')!;
    const res = await handler(badReq, mockCtx) as { status: number };

    expect(res.status).toBe(400);
  });
});

// ─── DELETE /auth/session ─────────────────────────────────────────────────────

describe('auth-session-revoke', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 400 when refreshToken is missing', async () => {
    const handler = handlers.get('auth-session-revoke')!;
    const res = await handler(mockRequest({}), mockCtx) as { status: number };

    expect(res.status).toBe(400);
  });

  it('returns 204 even when session not found (idempotent)', async () => {
    mockLookupSessionUser.mockResolvedValue(null);

    const handler = handlers.get('auth-session-revoke')!;
    const res = await handler(
      mockRequest({ refreshToken: 'nonexistent-token' }),
      mockCtx,
    ) as { status: number };

    expect(res.status).toBe(204);
    expect(mockRevokeSession).not.toHaveBeenCalled();
  });

  it('revokes session and returns 204 when session found', async () => {
    mockLookupSessionUser.mockResolvedValue({
      userId: 'user-1',
      email: 'user@test.com',
      provider: 'entra',
    });

    const handler = handlers.get('auth-session-revoke')!;
    const res = await handler(
      mockRequest({ refreshToken: 'valid-refresh-token' }),
      mockCtx,
    ) as { status: number };

    expect(res.status).toBe(204);
    expect(mockRevokeSession).toHaveBeenCalledWith('valid-refresh-token', 'user-1');
  });
});
