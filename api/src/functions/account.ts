import { app, type HttpRequest, type HttpResponseInit, type InvocationContext } from '@azure/functions';
import { cosmosClient } from '../services/cosmos';
import { authenticated, apiError } from '../utils/http';
import type { DecodedToken } from '../models/types';

// ─── DELETE /account ──────────────────────────────────────────────────────────

async function deleteAccount(
  _req: HttpRequest,
  _ctx: InvocationContext,
  token: DecodedToken,
): Promise<HttpResponseInit> {
  try {
    await cosmosClient.deleteAllForPartition(token.sub);
    return { status: 204 };
  } catch {
    return apiError(500, 'Failed to delete account. Please try again.');
  }
}

app.http('account-delete', {
  methods: ['DELETE'],
  route: 'account',
  authLevel: 'anonymous',
  handler: authenticated(deleteAccount),
});
