import { app, type HttpRequest, type HttpResponseInit, type InvocationContext } from '@azure/functions';
import { IS_LOCAL } from '../config/env';
import { authorise } from '../middleware/authorise';
import type { AllowList, AuthProvider, DecodedToken } from '../models/types';
import { cosmosClient } from '../services/cosmos';
import { createSession, lookupSessionUser, refreshSession, revokeSession } from '../services/session';
import { apiError } from '../utils/http';

// ─── POST /auth/session ──────────────────────────────────────────────────────
// Exchange a valid OIDC Bearer token for a backend-issued session (access +
// refresh token pair). The OIDC token is validated via authorise() which also
// performs the allow-list check.

app.http('auth-session-create', {
  methods: ['POST'],
  route: 'auth/session',
  authLevel: 'anonymous',
  handler: async (req: HttpRequest, _ctx: InvocationContext): Promise<HttpResponseInit> => {
    let token: DecodedToken;
    try {
      token = await authorise(req);
    } catch (err: unknown) {
      const e = err as { statusCode: number; message: string };
      return apiError(e.statusCode, e.message);
    }

    // Determine provider from the authorise-resolved userId format
    const provider: AuthProvider = token.sub.startsWith('google:') ? 'google' : 'microsoft';
    const email = token.email ?? token.preferred_username ?? '';

    const session = await createSession(token.sub, email, provider);
    return {
      status: 200,
      jsonBody: session,
    };
  },
});

// ─── POST /auth/refresh ──────────────────────────────────────────────────────
// Rotate a refresh token for a new access + refresh pair.
// Does NOT require a Bearer header — the refresh token in the body is the
// credential. Re-checks the allow-list to ensure revoked users cannot refresh.

app.http('auth-session-refresh', {
  methods: ['POST'],
  route: 'auth/refresh',
  authLevel: 'anonymous',
  handler: async (req: HttpRequest, _ctx: InvocationContext): Promise<HttpResponseInit> => {
    let body: { refreshToken?: string };
    try {
      body = (await req.json()) as { refreshToken?: string };
    } catch {
      return apiError(400, 'Invalid request body');
    }

    if (!body.refreshToken || typeof body.refreshToken !== 'string') {
      return apiError(400, 'Missing refreshToken');
    }

    // Look up the session to find the user
    const sessionInfo = await lookupSessionUser(body.refreshToken);
    if (!sessionInfo) {
      return apiError(401, 'Invalid or expired refresh token');
    }

    // Re-check allow-list (skip in local env, same as authorise())
    if (!IS_LOCAL) {
      const allowEntry = await cosmosClient.pointRead<AllowList>(
        `allowlist:${sessionInfo.userId}`,
        sessionInfo.userId,
      );
      if (!allowEntry) {
        // User was removed from allow-list — revoke the session and deny
        await revokeSession(body.refreshToken, sessionInfo.userId);
        return apiError(403, 'Access not granted');
      }
    }

    // Rotate: delete old refresh token, create new pair
    const newSession = await refreshSession(body.refreshToken, sessionInfo.userId);
    if (!newSession) {
      return apiError(401, 'Invalid or expired refresh token');
    }

    return {
      status: 200,
      jsonBody: newSession,
    };
  },
});

// ─── DELETE /auth/session ────────────────────────────────────────────────────
// Revoke a session by its refresh token. Idempotent.

app.http('auth-session-revoke', {
  methods: ['DELETE'],
  route: 'auth/session',
  authLevel: 'anonymous',
  handler: async (req: HttpRequest, _ctx: InvocationContext): Promise<HttpResponseInit> => {
    let body: { refreshToken?: string };
    try {
      body = (await req.json()) as { refreshToken?: string };
    } catch {
      return apiError(400, 'Invalid request body');
    }

    if (!body.refreshToken || typeof body.refreshToken !== 'string') {
      return apiError(400, 'Missing refreshToken');
    }

    // Look up user so we know the partition key for deletion
    const sessionInfo = await lookupSessionUser(body.refreshToken);
    if (sessionInfo) {
      await revokeSession(body.refreshToken, sessionInfo.userId);
    }

    return { status: 204 };
  },
});
