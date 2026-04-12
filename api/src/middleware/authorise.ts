import type { HttpRequest } from '@azure/functions';
import jwt from 'jsonwebtoken';
import jwksRsa from 'jwks-rsa';
import { B2C_CLIENT_ID, B2C_POLICY, B2C_TENANT, IS_LOCAL } from '../config/env';
import type { AllowList, DecodedToken } from '../models/types';
import { cosmosClient } from '../services/cosmos';

// ─── Hardcoded local-stage identity ──────────────────────────────────────────

const LOCAL_IDENTITY: DecodedToken = {
  sub: 'test-user-local',
  email: 'dev@local',
  emails: ['dev@local'],
  iat: 0,
  exp: 9999999999,
};

// ─── JWKS client (cached) ─────────────────────────────────────────────────────

function buildJwksClient() {
  const issuer = `https://${B2C_TENANT}.b2clogin.com/${B2C_TENANT}.onmicrosoft.com/${B2C_POLICY}/v2.0/`;
  const jwksUri = `${issuer}.well-known/jwks.json`;
  return jwksRsa({
    jwksUri,
    cache: true,
    cacheMaxEntries: 5,
    cacheMaxAge: 600_000, // 10 minutes
  });
}

let jwksClientInstance: ReturnType<typeof buildJwksClient> | null = null;
function getJwksClient() {
  if (!jwksClientInstance) jwksClientInstance = buildJwksClient();
  return jwksClientInstance;
}

// ─── authorise() ─────────────────────────────────────────────────────────────

/**
 * Validates the Bearer JWT and performs an allow-list point-read in Cosmos DB.
 *
 * Throws an object with `{ statusCode, message }` on failure — callers should
 * convert this to an HTTP error response.
 *
 * In `local` APP_ENV, skips all validation and returns a hardcoded identity.
 */
export async function authorise(req: HttpRequest): Promise<DecodedToken> {
  // ── Local stage bypass ──────────────────────────────────────────────────────
  if (IS_LOCAL) return LOCAL_IDENTITY;

  // ── Extract Bearer token ────────────────────────────────────────────────────
  const authHeader = req.headers.get('authorization') ?? '';
  if (!authHeader.startsWith('Bearer ')) {
    throw { statusCode: 401, message: 'Missing or malformed Authorization header' };
  }
  const token = authHeader.slice(7);

  // ── Validate JWT against B2C JWKS ──────────────────────────────────────────
  let decoded: DecodedToken;
  try {
    decoded = await verifyJwt(token);
  } catch {
    throw { statusCode: 401, message: 'Invalid or expired token' };
  }

  const userId = decoded.sub;

  // ── Allow-list point-read ───────────────────────────────────────────────────
  const allowListEntry = await cosmosClient.pointRead<AllowList>(
    `allowlist:${userId}`,
    userId,
  );

  if (!allowListEntry) {
    throw { statusCode: 403, message: 'Access not granted' };
  }

  return decoded;
}

// ─── JWT verification helper ──────────────────────────────────────────────────

function verifyJwt(token: string): Promise<DecodedToken> {
  return new Promise((resolve, reject) => {
    const issuer = `https://${B2C_TENANT}.b2clogin.com/${B2C_TENANT}.onmicrosoft.com/${B2C_POLICY}/v2.0/`;

    jwt.verify(
      token,
      (header, callback) => {
        getJwksClient().getSigningKey(header.kid!, (err, key) => {
          callback(err ?? null, key?.getPublicKey());
        });
      },
      {
        audience: B2C_CLIENT_ID,
        issuer,
        algorithms: ['RS256'],
      },
      (err, decoded) => {
        if (err || !decoded) return reject(err);
        resolve(decoded as DecodedToken);
      },
    );
  });
}
