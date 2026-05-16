import { vi, describe, it, expect, beforeEach } from 'vitest';
import type { HttpRequest } from '@azure/functions';

// ─── Hoist mock objects so vi.mock factories can reference them ───────────────

const mockJwt = vi.hoisted(() => ({
  decode: vi.fn(),
  verify: vi.fn(),
  sign: vi.fn(),
}));

const mockJwksClient = vi.hoisted(() => ({
  getSigningKey: vi.fn(),
}));

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

// ─── Module mocks ─────────────────────────────────────────────────────────────

vi.mock('jsonwebtoken', () => ({ default: mockJwt }));
vi.mock('jwks-rsa', () => ({
  default: vi.fn(() => mockJwksClient),
}));
vi.mock('../../services/cosmos', () => ({ cosmosClient: mockCosmos }));
vi.mock('../../config/env', () => ({
  IS_LOCAL: true,
  SESSION_SECRET: 'test-secret-for-hmac-sha256-at-least-32-chars-xxxx',
  ENTRA_CLIENT_ID: 'test-entra-client-id',
  GOOGLE_CLIENT_ID: 'test-google-client-id',
  APP_ENV: 'local',
}));

import { authorise } from '../authorise';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeRequest(authHeader?: string): HttpRequest {
  return {
    headers: {
      get: (name: string) =>
        name.toLowerCase() === 'authorization' ? (authHeader ?? null) : null,
    },
  } as unknown as HttpRequest;
}

const BACKEND_DECODED = {
  sub: 'user-1',
  email: 'user@test.com',
  provider: 'entra',
  iss: 'wordsprout',
  iat: 0,
  exp: 9999999999,
};

const ENTRA_DECODED = {
  sub: 'entra-user-1',
  email: 'entra@test.com',
  iss: 'https://login.microsoftonline.com/tenant/v2.0',
  aud: 'test-entra-client-id',
  iat: 0,
  exp: 9999999999,
};

// ─── Tests ─────────────────────────────────────────────────────────────────────

describe('authorise', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('throws 401 when Authorization header is missing', async () => {
    await expect(authorise(makeRequest())).rejects.toMatchObject({
      statusCode: 401,
    });
  });

  it('throws 401 when Authorization header does not start with "Bearer "', async () => {
    await expect(authorise(makeRequest('Basic abc123'))).rejects.toMatchObject({
      statusCode: 401,
    });
  });

  describe('backend-issued tokens (iss: wordsprout)', () => {
    it('returns decoded token when jwt.verify succeeds', async () => {
      mockJwt.decode.mockReturnValue({
        payload: { iss: 'wordsprout' },
        header: { alg: 'HS256' },
      });
      mockJwt.verify.mockReturnValue(BACKEND_DECODED);

      const result = await authorise(makeRequest('Bearer valid-backend-token'));

      expect(result.sub).toBe('user-1');
      expect(result.email).toBe('user@test.com');
    });

    it('throws 401 when jwt.verify throws for a backend token', async () => {
      mockJwt.decode.mockReturnValue({
        payload: { iss: 'wordsprout' },
        header: { alg: 'HS256' },
      });
      mockJwt.verify.mockImplementation(() => {
        throw new Error('jwt expired');
      });

      await expect(authorise(makeRequest('Bearer expired-token'))).rejects.toMatchObject({
        statusCode: 401,
      });
    });
  });

  describe('OIDC tokens (Entra ID) with IS_LOCAL=true', () => {
    it('returns decoded token with sub unchanged (no google: prefix)', async () => {
      mockJwt.decode.mockReturnValue({
        payload: { iss: 'https://login.microsoftonline.com/tenant/v2.0' },
        header: { kid: 'test-kid', alg: 'RS256' },
      });

      // Simulate async jwt.verify with callback
      mockJwt.verify.mockImplementation(
        (
          _token: string,
          secretCallback: (header: object, cb: Function) => void,
          _options: object,
          callback: (err: Error | null, decoded: unknown) => void,
        ) => {
          secretCallback({ kid: 'test-kid' }, (_err: unknown, _key: unknown) => {
            callback(null, ENTRA_DECODED);
          });
          mockJwksClient.getSigningKey.mockImplementation(
            (_kid: string, cb: Function) => cb(null, { getPublicKey: () => 'mock-key' }),
          );
        },
      );
      // Trigger via the mock
      mockJwt.verify.mockImplementation(
        (
          _token: string,
          getKey: (header: { kid: string }, cb: Function) => void,
          _opts: object,
          cb: (err: Error | null, decoded: unknown) => void,
        ) => {
          mockJwksClient.getSigningKey.mockImplementation(
            (_kid: string, keyCb: Function) => keyCb(null, { getPublicKey: () => 'mock-key' }),
          );
          getKey({ kid: 'test-kid' }, (err: unknown, key: unknown) => {
            if (err) cb(err as Error, null);
            else cb(null, ENTRA_DECODED);
          });
        },
      );

      const result = await authorise(makeRequest('Bearer entra-token'));

      expect(result.sub).toBe('entra-user-1');
    });

    it('throws 401 when OIDC verification fails', async () => {
      mockJwt.decode.mockReturnValue({
        payload: { iss: 'https://login.microsoftonline.com/tenant/v2.0' },
        header: { kid: 'bad-kid', alg: 'RS256' },
      });
      mockJwt.verify.mockImplementation(
        (_token: string, getKey: Function, _opts: object, cb: Function) => {
          getKey({ kid: 'bad-kid' }, (err: unknown, _key: unknown) => {
            cb(err, null);
          });
          mockJwksClient.getSigningKey.mockImplementation(
            (_kid: string, keyCb: Function) => keyCb(new Error('signing key not found'), null),
          );
        },
      );

      await expect(authorise(makeRequest('Bearer bad-entra-token'))).rejects.toMatchObject({
        statusCode: 401,
      });
    });
  });

  describe('Google tokens (iss: accounts.google.com)', () => {
    it('prefixes sub with "google:" for Google tokens', async () => {
      const GOOGLE_DECODED = {
        sub: 'google-sub-123',
        email: 'user@gmail.com',
        iss: 'accounts.google.com',
        aud: 'test-google-client-id',
        iat: 0,
        exp: 9999999999,
      };
      mockJwt.decode.mockReturnValue({
        payload: { iss: 'accounts.google.com' },
        header: { kid: 'google-kid', alg: 'RS256' },
      });
      mockJwt.verify.mockImplementation(
        (_token: string, getKey: Function, _opts: object, cb: Function) => {
          mockJwksClient.getSigningKey.mockImplementation(
            (_kid: string, keyCb: Function) => keyCb(null, { getPublicKey: () => 'mock-google-key' }),
          );
          getKey({ kid: 'google-kid' }, (err: unknown, key: unknown) => {
            if (err) cb(err, null);
            else cb(null, GOOGLE_DECODED);
          });
        },
      );

      const result = await authorise(makeRequest('Bearer google-token'));

      expect(result.sub).toBe('google:google-sub-123');
    });
  });
});
