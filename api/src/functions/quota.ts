import { app, type HttpRequest, type HttpResponseInit, type InvocationContext } from '@azure/functions';
import { AI_DAILY_ENRICHMENT_LIMIT } from '../config/env';
import { authorise } from '../middleware/authorise';
import type { User, UserQuota } from '../models/types';
import { cosmosClient } from '../services/cosmos';

function apiError(statusCode: number, message: string): HttpResponseInit {
  return {
    status: statusCode,
    jsonBody: {
      error: statusCode === 403 ? 'Forbidden' : 'Error',
      message,
      statusCode,
    },
  };
}

async function getQuota(
  req: HttpRequest,
  _ctx: InvocationContext,
): Promise<HttpResponseInit> {
  let token;
  try {
    token = await authorise(req);
  } catch (err: unknown) {
    const e = err as { statusCode: number; message: string };
    return apiError(e.statusCode, e.message);
  }

  const user = await cosmosClient.pointRead<User>(token.sub, token.sub);

  const now = new Date().toISOString();
  let aiQuotaUsedToday = user?.aiQuotaUsedToday ?? 0;
  let aiQuotaResetAt = user?.aiQuotaResetAt ?? '';

  // If quota window has expired, treat as reset
  if (!aiQuotaResetAt || aiQuotaResetAt < now) {
    aiQuotaUsedToday = 0;
    const d = new Date();
    d.setUTCHours(24, 0, 0, 0);
    aiQuotaResetAt = d.toISOString();
  }

  const quota: UserQuota = {
    aiQuotaUsedToday,
    aiDailyEnrichmentLimit: AI_DAILY_ENRICHMENT_LIMIT,
    aiQuotaResetAt,
  };

  return { status: 200, jsonBody: quota };
}

app.http('getQuota', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'users/me/quota',
  handler: getQuota,
});
