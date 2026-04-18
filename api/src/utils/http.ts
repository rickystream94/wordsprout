import { randomUUID } from 'node:crypto';
import type { HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { authorise } from '../middleware/authorise';
import type { DecodedToken } from '../models/types';

/**
 * Builds a standard API error response.
 */
export function apiError(statusCode: number, message: string): HttpResponseInit {
  const error =
    statusCode === 403 ? 'Forbidden' :
    statusCode === 404 ? 'Not Found' :
    statusCode === 409 ? 'Conflict' : 'Error';
  return { status: statusCode, jsonBody: { error, message, statusCode } };
}

type AuthenticatedHandler = (
  req: HttpRequest,
  ctx: InvocationContext,
  token: DecodedToken,
) => Promise<HttpResponseInit>;

/**
 * Middleware factory: wraps a handler so JWT auth is applied at registration time.
 * The handler receives the verified token as a third argument.
 * On auth failure, returns the appropriate HTTP error response automatically.
 *
 * Usage:
 *   app.http('route-name', { ..., handler: authenticated(myHandler) });
 */
export function authenticated(
  handler: AuthenticatedHandler,
): (req: HttpRequest, ctx: InvocationContext) => Promise<HttpResponseInit> {
  return async (req, ctx) => {
    let token: DecodedToken;
    try {
      token = await authorise(req);
    } catch (err: unknown) {
      const e = err as { statusCode: number; message: string };
      return {
        status: e.statusCode,
        jsonBody: { error: 'Unauthorized', message: e.message, statusCode: e.statusCode },
      };
    }
    return handler(req, ctx, token);
  };
}

/**
 * Returns the client-provided id if it is a valid v4 UUID, otherwise generates a new one.
 * Allows the client to pre-assign an id so subsequent sync-queue mutations
 * (PUT/DELETE) reference the correct server-side record.
 */
export function resolveId(clientId: unknown): string {
  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return typeof clientId === 'string' && UUID_RE.test(clientId) ? clientId : randomUUID();
}
