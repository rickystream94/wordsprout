import { app, type HttpRequest, type HttpResponseInit, type InvocationContext } from '@azure/functions';
import DOMPurify from 'isomorphic-dompurify';
import { createHash, randomUUID } from 'node:crypto';
import type { AccessRequest, RateLimitEntry } from '../models/types';
import { cosmosClient } from '../services/cosmos';

// ─── Cosmos-backed rate limiter ───────────────────────────────────────────────
// Flex Consumption scales to zero after idle periods; in-memory state resets on
// every cold start. We use a Cosmos document with a TTL field instead so the
// rate limit window survives across cold starts.

const RATE_LIMIT_MAX = 3;
const RATE_LIMIT_WINDOW_SECS = 60 * 60; // 1 hour

/** Pseudonymise the client IP before storing it — never log or store raw IPs. */
function ipDocId(ip: string): string {
  return `ratelimit:${createHash('sha256').update(ip).digest('hex').slice(0, 16)}`;
}

async function isRateLimited(ip: string): Promise<boolean> {
  const id = ipDocId(ip);
  const partitionKey = '_ratelimits';

  const existing = await cosmosClient.pointRead<RateLimitEntry>(id, partitionKey);

  if (!existing) {
    // First request from this IP in this window — create the document.
    const now = new Date().toISOString();
    await cosmosClient.upsert<RateLimitEntry>({
      id,
      userId: partitionKey,
      type: 'ratelimit',
      windowStart: now,
      count: 1,
      ttl: RATE_LIMIT_WINDOW_SECS,
      createdAt: now,
      updatedAt: now,
    });
    return false;
  }

  if (existing.count >= RATE_LIMIT_MAX) {
    return true;
  }

  // Within the window and under the limit — increment the counter.
  await cosmosClient.upsert<RateLimitEntry>({
    ...existing,
    count: existing.count + 1,
    updatedAt: new Date().toISOString(),
  });
  return false;
}

// Basic email format validation (no library dependency)
function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

async function createAccessRequest(
  req: HttpRequest,
  _ctx: InvocationContext,
): Promise<HttpResponseInit> {
  // Rate limiting by client IP (Cosmos-backed, survives cold starts)
  const clientIp = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
  if (await isRateLimited(clientIp)) {
    return {
      status: 429,
      jsonBody: { error: 'Too Many Requests', message: 'Rate limit exceeded. Try again later.', statusCode: 429 },
    };
  }

  const body = (await req.json()) as { email?: string; sub?: string };
  const rawEmail = body.email ?? '';
  const email = DOMPurify.sanitize(rawEmail).trim().toLowerCase();
  const sub = typeof body.sub === 'string' ? body.sub.trim() : undefined;

  if (!email || !isValidEmail(email)) {
    return {
      status: 400,
      jsonBody: { error: 'Bad Request', message: 'A valid email address is required.', statusCode: 400 },
    };
  }

  const now = new Date().toISOString();
  // Use a deterministic ID when the caller's sub is known so that re-submissions
  // are idempotent (upsert overwrites, not duplicates). Fall back to random UUID
  // only when sub is absent (e.g. unauthenticated legacy callers).
  const id = sub
    ? `access_req:${createHash('sha256').update(sub).digest('hex').slice(0, 16)}`
    : randomUUID();
  const accessRequest: AccessRequest = {
    id,
    userId: '_access_requests',
    type: 'access_request',
    email,
    ...(sub ? { sub } : {}),
    requestedAt: now,
    status: 'pending',
    createdAt: now,
    updatedAt: now,
  };

  await cosmosClient.upsert(accessRequest);

  return { status: 202 };
}

app.http('access-requests-create', {
  methods: ['POST'],
  route: 'access-requests',
  authLevel: 'anonymous',
  handler: createAccessRequest,
});
