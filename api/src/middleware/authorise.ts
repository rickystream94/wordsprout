import type { HttpRequest } from '@azure/functions';
import jwt from 'jsonwebtoken';
import jwksRsa from 'jwks-rsa';
import { ENTRA_CLIENT_ID, GOOGLE_CLIENT_ID, IS_LOCAL } from '../config/env';
import type { AllowList, DecodedToken } from '../models/types';
import { cosmosClient } from '../services/cosmos';

// ─── JWKS clients (cached) ────────────────────────────────────────────────────

function buildJwksClient(uri: string) {
  return jwksRsa({
    jwksUri: uri,
    cache: true,
    cacheMaxEntries: 5,
    cacheMaxAge: 600_000, // 10 minutes
  });
}

let msJwksClient: ReturnType<typeof buildJwksClient> | null = null;
function getMsJwksClient() {
  if (!msJwksClient) msJwksClient = buildJwksClient('https://login.microsoftonline.com/common/discovery/v2.0/keys');
  return msJwksClient;
}

let googleJwksClient: ReturnType<typeof buildJwksClient> | null = null;
function getGoogleJwksClient() {
  if (!googleJwksClient) googleJwksClient = buildJwksClient('https://www.googleapis.com/oauth2/v3/certs');
  return googleJwksClient;
}

// ─── authorise() ─────────────────────────────────────────────────────────────

/**
 * Validates the Bearer JWT and performs an allow-list point-read in Cosmos DB.
 *
 * Supports two OIDC providers:
 * - Microsoft Entra ID (iss: login.microsoftonline.com) -> userId = sub
 * - Google (iss: accounts.google.com) -> userId = `google:${sub}`
 *
 * Throws an object with `{ statusCode, message }` on failure - callers should
 * convert this to an HTTP error response.
 *
 * In `local` APP_ENV, JWT validation still runs but the allow-list check is
 * skipped — any authenticated account is permitted locally.
 */
export async function authorise(req: HttpRequest): Promise<DecodedToken> {
  // -- Extract Bearer token
  const authHeader = req.headers.get('authorization') ?? '';
  if (!authHeader.startsWith('Bearer ')) {
    throw { statusCode: 401, message: 'Missing or malformed Authorization header' };
  }
  const token = authHeader.slice(7);

  // -- Peek at iss claim (unverified) to select the right JWKS client
  const unverified = jwt.decode(token, { complete: true });
  const iss = (unverified?.payload as Record<string, unknown> | null)?.['iss'];
  const isGoogle = typeof iss === 'string' && (
    iss === 'accounts.google.com' || iss.startsWith('https://accounts.google.com')
  );

  // -- Validate JWT
  let decoded: DecodedToken;
  try {
    decoded = await verifyJwt(token, isGoogle);
  } catch {
    throw { statusCode: 401, message: 'Invalid or expired token' };
  }

  // -- Build userId: Google tokens get a `google:` prefix
  const userId = isGoogle ? `google:${decoded.sub}` : decoded.sub;

  // -- Allow-list point-read (skipped in local stage — any authenticated user is allowed)
  if (!IS_LOCAL) {
    const allowListEntry = await cosmosClient.pointRead<AllowList>(
      `allowlist:${userId}`,
      userId,
    );

    if (!allowListEntry) {
      throw { statusCode: 403, message: 'Access not granted' };
    }
  }

  // Return token with the resolved userId as sub so callers use the right partition key
  return { ...decoded, sub: userId };
}

// ─── JWT verification helper ──────────────────────────────────────────────────

function verifyJwt(token: string, isGoogle: boolean): Promise<DecodedToken> {
  const jwksClient = isGoogle ? getGoogleJwksClient() : getMsJwksClient();
  const audience = isGoogle ? GOOGLE_CLIENT_ID : ENTRA_CLIENT_ID;

  return new Promise((resolve, reject) => {
    jwt.verify(
      token,
      (header, callback) => {
        jwksClient.getSigningKey(header.kid!, (err, key) => {
          callback(err ?? null, key?.getPublicKey());
        });
      },
      {
        audience,
        algorithms: ['RS256'],
      },
      (err, decoded) => {
        if (err || !decoded) return reject(err);
        resolve(decoded as DecodedToken);
      },
    );
  });
}
