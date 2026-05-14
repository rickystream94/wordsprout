import { createHash, randomBytes } from 'node:crypto';
import jwt from 'jsonwebtoken';
import { SESSION_SECRET, SESSION_ACCESS_TTL, SESSION_REFRESH_TTL } from '../config/env';
import type { AuthProvider, SessionDocument } from '../models/types';
import { cosmosClient } from './cosmos';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function hashToken(raw: string): string {
  return createHash('sha256').update(raw).digest('hex');
}

function sessionDocId(tokenHash: string): string {
  return `session:${tokenHash}`;
}

interface SessionTokenPair {
  accessToken: string;
  refreshToken: string;
  /** Access token lifetime in seconds. */
  expiresIn: number;
}

function signAccessToken(userId: string, email: string, provider: AuthProvider): string {
  return jwt.sign(
    { sub: userId, email, provider, iss: 'wordsprout' },
    SESSION_SECRET,
    { algorithm: 'HS256', expiresIn: SESSION_ACCESS_TTL },
  );
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Creates a new session (access + refresh token pair) for a verified user.
 * The refresh token is stored SHA-256 hashed in Cosmos with a TTL for
 * automatic cleanup.
 */
export async function createSession(
  userId: string,
  email: string,
  provider: AuthProvider,
): Promise<SessionTokenPair> {
  const rawRefresh = randomBytes(32).toString('base64url');
  const tokenHash = hashToken(rawRefresh);
  const now = new Date().toISOString();
  const expiresAt = new Date(Date.now() + SESSION_REFRESH_TTL * 1000).toISOString();

  const doc: SessionDocument = {
    id: sessionDocId(tokenHash),
    userId,
    type: 'session',
    tokenHash,
    provider,
    email,
    expiresAt,
    ttl: SESSION_REFRESH_TTL,
    createdAt: now,
    updatedAt: now,
  };

  await cosmosClient.upsert(doc);

  return {
    accessToken: signAccessToken(userId, email, provider),
    refreshToken: rawRefresh,
    expiresIn: SESSION_ACCESS_TTL,
  };
}

/**
 * Validates a raw refresh token, rotates it (delete old + create new), and
 * returns a fresh token pair. Returns null if the token is invalid or expired.
 */
export async function refreshSession(
  rawRefreshToken: string,
  userId: string,
): Promise<SessionTokenPair | null> {
  const tokenHash = hashToken(rawRefreshToken);
  const docId = sessionDocId(tokenHash);

  const existing = await cosmosClient.pointRead<SessionDocument>(docId, userId);
  if (!existing) return null;

  // Expired (should already be auto-deleted by TTL, but belt-and-suspenders)
  if (new Date(existing.expiresAt) <= new Date()) {
    await cosmosClient.deleteItem(docId, userId);
    return null;
  }

  // Rotate: delete old, create new
  await cosmosClient.deleteItem(docId, userId);
  return createSession(userId, existing.email, existing.provider);
}

/**
 * Revokes a single session by its raw refresh token.
 * No-op if the token doesn't exist (idempotent).
 */
export async function revokeSession(
  rawRefreshToken: string,
  userId: string,
): Promise<void> {
  const tokenHash = hashToken(rawRefreshToken);
  const docId = sessionDocId(tokenHash);
  try {
    await cosmosClient.deleteItem(docId, userId);
  } catch {
    // Ignore — token already gone or never existed
  }
}

/**
 * Looks up the session document for a raw refresh token and returns the userId
 * if valid. Used by the refresh endpoint to identify the user without requiring
 * a Bearer header.
 */
export async function lookupSessionUser(
  rawRefreshToken: string,
): Promise<{ userId: string; email: string; provider: AuthProvider } | null> {
  const tokenHash = hashToken(rawRefreshToken);
  const docId = sessionDocId(tokenHash);

  // We don't know the userId upfront (no Bearer header on refresh), so we
  // search by document id across the _sessions partition — but since we store
  // sessions in the user's partition, we need to query by id.
  // However, Cosmos point-reads require the partition key. For the refresh
  // endpoint we must query by id across partitions.
  const results = await cosmosClient.queryById<SessionDocument>(docId);
  if (results.length === 0) return null;

  const session = results[0];
  if (new Date(session.expiresAt) <= new Date()) return null;

  return { userId: session.userId, email: session.email, provider: session.provider };
}
