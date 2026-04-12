import { app, type HttpRequest, type HttpResponseInit, type InvocationContext } from '@azure/functions';
import DOMPurify from 'isomorphic-dompurify';
import { randomUUID } from 'node:crypto';
import type { AccessRequest } from '../models/types';
import { cosmosClient } from '../services/cosmos';

// Simple in-memory rate limiter: max 3 requests per IP per hour
const ipRequestLog = new Map<string, number[]>();

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const windowMs = 60 * 60 * 1000; // 1 hour
  const requests = (ipRequestLog.get(ip) ?? []).filter((t) => now - t < windowMs);
  if (requests.length >= 3) return true;
  ipRequestLog.set(ip, [...requests, now]);
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
  // Rate limiting by client IP
  const clientIp = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
  if (isRateLimited(clientIp)) {
    return {
      status: 429,
      jsonBody: { error: 'Too Many Requests', message: 'Rate limit exceeded. Try again later.', statusCode: 429 },
    };
  }

  const body = (await req.json()) as { email?: string };
  const rawEmail = body.email ?? '';
  const email = DOMPurify.sanitize(rawEmail).trim().toLowerCase();

  if (!email || !isValidEmail(email)) {
    return {
      status: 400,
      jsonBody: { error: 'Bad Request', message: 'A valid email address is required.', statusCode: 400 },
    };
  }

  const now = new Date().toISOString();
  const accessRequest: AccessRequest = {
    id: randomUUID(),
    userId: '_access_requests',
    type: 'access_request',
    email,
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
