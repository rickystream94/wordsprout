import { vi, describe, it, expect, beforeEach } from 'vitest';

// ─── Hoist mock objects so vi.mock factories can close over them ───────────────

const mockCosmos = vi.hoisted(() => ({
  upsert: vi.fn(async (doc: unknown) => doc),
  pointRead: vi.fn(async () => null as unknown),
  deleteItem: vi.fn(async () => undefined),
  queryById: vi.fn(async () => [] as unknown[]),
  queryByPartition: vi.fn(async () => [] as unknown[]),
  queryByPartitionPaginated: vi.fn(async () => ({ items: [], continuationToken: undefined })),
  deleteAllForPartition: vi.fn(async () => 0),
  queryByTagInPartition: vi.fn(async () => [] as unknown[]),
}));

vi.mock('../cosmos', () => ({ cosmosClient: mockCosmos }));
vi.mock('../../config/env', () => ({
  SESSION_SECRET: 'test-secret-for-hmac-sha256-at-least-32-chars-xxxx',
  SESSION_ACCESS_TTL: 900,
  SESSION_REFRESH_TTL: 604800,
  IS_LOCAL: true,
  APP_ENV: 'local',
  IS_DEV: false,
  IS_PROD: false,
}));

import { createSession, refreshSession, revokeSession, lookupSessionUser } from '../session';
import type { SessionDocument } from '../../models/types';

// ─── createSession ─────────────────────────────────────────────────────────────

describe('createSession', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns accessToken, refreshToken, and expiresIn=900', async () => {
    const result = await createSession('user-1', 'user@test.com', 'entra');

    expect(result.accessToken).toBeTruthy();
    expect(result.refreshToken).toBeTruthy();
    expect(result.expiresIn).toBe(900);
  });

  it('upserts a session document in cosmos', async () => {
    await createSession('user-1', 'user@test.com', 'entra');

    expect(mockCosmos.upsert).toHaveBeenCalledOnce();
  });

  it('stores a hashed token, not the raw refresh token', async () => {
    const result = await createSession('user-1', 'user@test.com', 'entra');
    const doc = mockCosmos.upsert.mock.calls[0][0] as SessionDocument;

    expect(doc.tokenHash).not.toBe(result.refreshToken);
    expect(doc.tokenHash).toHaveLength(64); // SHA-256 hex
  });

  it('sets correct fields on the session document', async () => {
    await createSession('user-1', 'user@test.com', 'entra');
    const doc = mockCosmos.upsert.mock.calls[0][0] as SessionDocument;

    expect(doc.type).toBe('session');
    expect(doc.userId).toBe('user-1');
    expect(doc.email).toBe('user@test.com');
    expect(doc.provider).toBe('entra');
    expect(doc.id).toMatch(/^session:/);
    expect(doc.ttl).toBe(604800);
  });

  it('generates different refresh tokens on successive calls', async () => {
    const a = await createSession('user-1', 'user@test.com', 'entra');
    const b = await createSession('user-1', 'user@test.com', 'entra');

    expect(a.refreshToken).not.toBe(b.refreshToken);
  });
});

// ─── refreshSession ─────────────────────────────────────────────────────────────

describe('refreshSession', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns null when session document not found', async () => {
    mockCosmos.pointRead.mockResolvedValue(null);

    const result = await refreshSession('raw-token', 'user-1');

    expect(result).toBeNull();
  });

  it('returns null and deletes document when session is expired', async () => {
    const expiredDoc: SessionDocument = {
      id: 'session:abc',
      userId: 'user-1',
      type: 'session',
      tokenHash: 'abc',
      provider: 'entra',
      email: 'user@test.com',
      expiresAt: new Date(Date.now() - 60000).toISOString(),
      ttl: 604800,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    mockCosmos.pointRead.mockResolvedValue(expiredDoc);

    const result = await refreshSession('raw-token', 'user-1');

    expect(result).toBeNull();
    expect(mockCosmos.deleteItem).toHaveBeenCalledOnce();
  });

  it('rotates tokens and returns new pair for a valid session', async () => {
    const validDoc: SessionDocument = {
      id: 'session:abc',
      userId: 'user-1',
      type: 'session',
      tokenHash: 'abc',
      provider: 'entra',
      email: 'user@test.com',
      expiresAt: new Date(Date.now() + 86400000).toISOString(),
      ttl: 604800,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    mockCosmos.pointRead.mockResolvedValue(validDoc);

    const result = await refreshSession('raw-token', 'user-1');

    expect(result).not.toBeNull();
    expect(result!.accessToken).toBeTruthy();
    expect(result!.refreshToken).toBeTruthy();
    expect(result!.expiresIn).toBe(900);
    // Old session deleted, new one upserted
    expect(mockCosmos.deleteItem).toHaveBeenCalledOnce();
    expect(mockCosmos.upsert).toHaveBeenCalledOnce();
  });
});

// ─── revokeSession ─────────────────────────────────────────────────────────────

describe('revokeSession', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls deleteItem with the derived document id', async () => {
    await revokeSession('raw-token', 'user-1');

    expect(mockCosmos.deleteItem).toHaveBeenCalledOnce();
    const [id, partitionKey] = mockCosmos.deleteItem.mock.calls[0] as [string, string];
    expect(id).toMatch(/^session:/);
    expect(partitionKey).toBe('user-1');
  });

  it('does not throw when deleteItem rejects (idempotent)', async () => {
    mockCosmos.deleteItem.mockRejectedValue(new Error('Not found'));

    await expect(revokeSession('raw-token', 'user-1')).resolves.toBeUndefined();
  });
});

// ─── lookupSessionUser ─────────────────────────────────────────────────────────

describe('lookupSessionUser', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns null when no session document found', async () => {
    mockCosmos.queryById.mockResolvedValue([]);

    const result = await lookupSessionUser('raw-token');

    expect(result).toBeNull();
  });

  it('returns null for an expired session', async () => {
    const expiredDoc: SessionDocument = {
      id: 'session:abc',
      userId: 'user-1',
      type: 'session',
      tokenHash: 'abc',
      provider: 'entra',
      email: 'user@test.com',
      expiresAt: new Date(Date.now() - 60000).toISOString(),
      ttl: 604800,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    mockCosmos.queryById.mockResolvedValue([expiredDoc]);

    const result = await lookupSessionUser('raw-token');

    expect(result).toBeNull();
  });

  it('returns user info for a valid non-expired session', async () => {
    const validDoc: SessionDocument = {
      id: 'session:abc',
      userId: 'user-1',
      type: 'session',
      tokenHash: 'abc',
      provider: 'entra',
      email: 'user@test.com',
      expiresAt: new Date(Date.now() + 86400000).toISOString(),
      ttl: 604800,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    mockCosmos.queryById.mockResolvedValue([validDoc]);

    const result = await lookupSessionUser('raw-token');

    expect(result).toEqual({ userId: 'user-1', email: 'user@test.com', provider: 'entra' });
  });
});
