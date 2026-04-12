import { app, type HttpRequest, type HttpResponseInit, type InvocationContext } from '@azure/functions';
import DOMPurify from 'isomorphic-dompurify';
import { authorise } from '../middleware/authorise';
import type { AIEnrichment, Phrasebook, User, VocabularyEntry } from '../models/types';
import { generateEnrichment } from '../services/ai';
import { cosmosClient } from '../services/cosmos';
import { AI_QUOTA_LIMIT } from '../config/env';

function sanitise(value: string): string {
  return DOMPurify.sanitize(value).trim();
}

function sanitiseArray(values: string[]): string[] {
  return values.map(sanitise).filter(Boolean);
}

function apiError(statusCode: number, message: string, extra?: Record<string, unknown>): HttpResponseInit {
  return {
    status: statusCode,
    jsonBody: {
      error:
        statusCode === 403 ? 'Forbidden'
        : statusCode === 404 ? 'Not Found'
        : statusCode === 429 ? 'Too Many Requests'
        : 'Error',
      message,
      statusCode,
      ...extra,
    },
  };
}

// ─── Quota helpers ─────────────────────────────────────────────────────────────

function nextMidnightUtc(): string {
  const d = new Date();
  d.setUTCHours(24, 0, 0, 0);
  return d.toISOString();
}

async function getOrCreateUser(userId: string, email: string): Promise<User> {
  const existing = await cosmosClient.pointRead<User>(userId, userId);
  if (existing && existing.type === 'user') return existing;

  const now = new Date().toISOString();
  const user: User = {
    id: userId,
    userId,
    type: 'user',
    email,
    aiQuotaUsedToday: 0,
    aiQuotaResetAt: nextMidnightUtc(),
    aiQuotaLimit: AI_QUOTA_LIMIT,
    createdAt: now,
    updatedAt: now,
  };
  await cosmosClient.upsert(user);
  return user;
}

// ─── POST /entries/{entryId}/enrich ──────────────────────────────────────────

async function enrichEntry(req: HttpRequest, ctx: InvocationContext): Promise<HttpResponseInit> {
  let token;
  try {
    token = await authorise(req);
  } catch (err: unknown) {
    const e = err as { statusCode: number; message: string };
    return apiError(e.statusCode, e.message);
  }

  const entryId = req.params['entryId'] ?? '';
  if (!entryId) return apiError(400, 'entryId is required');

  // Verify entry ownership
  const entry = await cosmosClient.pointRead<VocabularyEntry>(entryId, token.sub);
  if (!entry || entry.type !== 'entry') return apiError(404, 'Entry not found');
  if (entry.userId !== token.sub) return apiError(403, 'Access denied');

  // Load phrasebook for language info
  const phrasebook = await cosmosClient.pointRead<Phrasebook>(entry.phrasebookId, token.sub);
  if (!phrasebook || phrasebook.type !== 'phrasebook') {
    return apiError(404, 'Phrasebook not found');
  }

  // Check and increment quota
  const email = token.email ?? (Array.isArray(token.emails) ? token.emails[0] : '') ?? '';
  const user = await getOrCreateUser(token.sub, email);
  const now = new Date().toISOString();

  let { aiQuotaUsedToday, aiQuotaResetAt } = user;

  // Reset quota if the reset time is in the past
  if (aiQuotaResetAt < now) {
    aiQuotaUsedToday = 0;
    aiQuotaResetAt = nextMidnightUtc();
  }

  if (aiQuotaUsedToday >= AI_QUOTA_LIMIT) {
    return apiError(429, 'Daily AI enrichment quota exceeded', {
      aiQuotaUsedToday,
      aiQuotaLimit: AI_QUOTA_LIMIT,
      aiQuotaResetAt,
    });
  }

  // Generate enrichment
  let enrichment: AIEnrichment;
  try {
    enrichment = await generateEnrichment({
      entryId,
      userId: token.sub,
      sourceText: entry.sourceText,
      targetText: entry.targetText,
      sourceLanguage: phrasebook.sourceLanguageName,
      targetLanguage: phrasebook.targetLanguageName,
    });
  } catch (err: unknown) {
    ctx.error('AI enrichment failed', err);
    return apiError(503, 'AI service temporarily unavailable');
  }

  // Persist enrichment
  await cosmosClient.upsert(enrichment);

  // Update entry with enrichmentId
  const updatedEntry: VocabularyEntry = { ...entry, enrichmentId: enrichment.id, updatedAt: now };
  await cosmosClient.upsert(updatedEntry);

  // Increment quota
  const updatedUser: User = {
    ...user,
    aiQuotaUsedToday: aiQuotaUsedToday + 1,
    aiQuotaResetAt,
    updatedAt: now,
  };
  await cosmosClient.upsert(updatedUser);

  return { status: 200, jsonBody: enrichment };
}

app.http('enrichEntry', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'entries/{entryId}/enrich',
  handler: enrichEntry,
});

// ─── PATCH /entries/{entryId}/enrichment ─────────────────────────────────────

async function updateEnrichment(
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

  const entryId = req.params['entryId'] ?? '';
  if (!entryId) return apiError(400, 'entryId is required');

  // Verify entry ownership
  const entry = await cosmosClient.pointRead<VocabularyEntry>(entryId, token.sub);
  if (!entry || entry.type !== 'entry') return apiError(404, 'Entry not found');
  if (entry.userId !== token.sub) return apiError(403, 'Access denied');

  const enrichmentId = entry.enrichmentId;
  if (!enrichmentId) return apiError(404, 'No enrichment found for this entry');

  const existing = await cosmosClient.pointRead<AIEnrichment>(enrichmentId, token.sub);
  if (!existing || existing.type !== 'enrichment') {
    return apiError(404, 'Enrichment not found');
  }

  const body = (await req.json()) as Partial<AIEnrichment>;
  const now = new Date().toISOString();

  const updated: AIEnrichment = {
    ...existing,
    updatedAt: now,
    editedAt: now,
  };

  if (Array.isArray(body.exampleSentences)) {
    updated.exampleSentences = sanitiseArray(body.exampleSentences);
  }
  if (Array.isArray(body.synonyms)) {
    updated.synonyms = sanitiseArray(body.synonyms);
  }
  if (Array.isArray(body.antonyms)) {
    updated.antonyms = sanitiseArray(body.antonyms);
  }
  if (Array.isArray(body.collocations)) {
    updated.collocations = sanitiseArray(body.collocations);
  }
  if (typeof body.register === 'string') {
    updated.register = sanitise(body.register) || undefined;
  }
  if (typeof body.falseFriendWarning === 'string') {
    updated.falseFriendWarning = sanitise(body.falseFriendWarning) || undefined;
  }

  await cosmosClient.upsert(updated);
  return { status: 200, jsonBody: updated };
}

app.http('updateEnrichment', {
  methods: ['PATCH'],
  authLevel: 'anonymous',
  route: 'entries/{entryId}/enrichment',
  handler: updateEnrichment,
});
