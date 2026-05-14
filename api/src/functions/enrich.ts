import { app, type HttpRequest, type HttpResponseInit, type InvocationContext } from '@azure/functions';
import DOMPurify from 'isomorphic-dompurify';
import { authorise } from '../middleware/authorise';
import type { AIEnrichment, DecodedToken, Phrasebook, User, VocabularyEntry } from '../models/types';
import { generateEnrichment } from '../services/ai';
import { cosmosClient } from '../services/cosmos';
import { AI_DAILY_ENRICHMENT_LIMIT } from '../config/env';
import { authenticated } from '../utils/http';

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
    aiDailyEnrichmentLimit: AI_DAILY_ENRICHMENT_LIMIT,
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
  const email = token.email ?? token.preferred_username ?? '';
  const user = await getOrCreateUser(token.sub, email);
  const now = new Date().toISOString();

  let { aiQuotaUsedToday, aiQuotaResetAt } = user;

  // Reset quota if the reset time is in the past
  if (aiQuotaResetAt < now) {
    aiQuotaUsedToday = 0;
    aiQuotaResetAt = nextMidnightUtc();
  }

  if (aiQuotaUsedToday >= AI_DAILY_ENRICHMENT_LIMIT) {
    return apiError(429, 'Daily AI enrichment quota exceeded', {
      aiQuotaUsedToday,
      aiDailyEnrichmentLimit: AI_DAILY_ENRICHMENT_LIMIT,
      aiQuotaResetAt,
    });
  }

  // Generate enrichment
  let enrichment: AIEnrichment;
  let translatedTargetText: string | undefined;
  let partOfSpeech: string | undefined;
  try {
    const result = await generateEnrichment({
      entryId,
      userId: token.sub,
      sourceText: entry.sourceText,
      targetText: entry.targetText,
      sourceLanguage: phrasebook.sourceLanguageName,
      targetLanguage: phrasebook.targetLanguageName,
    });
    enrichment = result.enrichment;
    translatedTargetText = result.translatedTargetText;
    partOfSpeech = result.partOfSpeech;
  } catch (err: unknown) {
    ctx.error('AI enrichment failed', err);
    return apiError(503, 'AI service temporarily unavailable');
  }

  // Persist enrichment — merge with existing data so user edits are preserved
  const existingEnrichment = entry.enrichmentId
    ? await cosmosClient.pointRead<AIEnrichment>(entry.enrichmentId, token.sub)
    : undefined;

  if (existingEnrichment && existingEnrichment.type === 'enrichment') {
    // Additive merge: append new items to arrays (deduplicated), keep user-set scalars
    const mergeArrays = (existing: string[], incoming: string[]) => {
      const set = new Set(existing);
      for (const v of incoming) if (!set.has(v)) set.add(v);
      return [...set];
    };
    enrichment = {
      ...enrichment,
      id: existingEnrichment.id,
      exampleSentences: mergeArrays(existingEnrichment.exampleSentences ?? [], enrichment.exampleSentences),
      synonyms: mergeArrays(existingEnrichment.synonyms ?? [], enrichment.synonyms),
      antonyms: mergeArrays(existingEnrichment.antonyms ?? [], enrichment.antonyms),
      collocations: mergeArrays(existingEnrichment.collocations ?? [], enrichment.collocations),
      register: existingEnrichment.register || enrichment.register,
      falseFriendWarning: existingEnrichment.falseFriendWarning || enrichment.falseFriendWarning,
      editedAt: existingEnrichment.editedAt,
    };
  }
  await cosmosClient.upsert(enrichment);

  // Update entry with enrichmentId (and translation/partOfSpeech if applicable)
  const updatedEntry: VocabularyEntry = {
    ...entry,
    enrichmentId: enrichment.id,
    updatedAt: now,
    ...(translatedTargetText && !entry.targetText ? { targetText: translatedTargetText } : {}),
    ...(partOfSpeech && !entry.partOfSpeech ? { partOfSpeech: partOfSpeech as VocabularyEntry['partOfSpeech'] } : {}),
  };
  await cosmosClient.upsert(updatedEntry);

  // Increment quota
  const updatedUser: User = {
    ...user,
    aiQuotaUsedToday: aiQuotaUsedToday + 1,
    aiQuotaResetAt,
    updatedAt: now,
  };
  await cosmosClient.upsert(updatedUser);

  const responseBody: { enrichment: AIEnrichment; entry?: VocabularyEntry } = { enrichment };
  if ((translatedTargetText && !entry.targetText) || (partOfSpeech && !entry.partOfSpeech)) {
    responseBody.entry = updatedEntry;
  }

  return { status: 200, jsonBody: responseBody };
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
  let existing: AIEnrichment | undefined;

  if (enrichmentId) {
    const doc = await cosmosClient.pointRead<AIEnrichment>(enrichmentId, token.sub);
    if (doc && doc.type === 'enrichment') existing = doc;
  }

  const body = (await req.json()) as Partial<AIEnrichment>;
  const now = new Date().toISOString();

  // Create a blank enrichment doc if none exists (manual creation — no quota cost)
  if (!existing) {
    const newId = `enrichment-${entryId}`;
    existing = {
      id: newId,
      userId: token.sub,
      type: 'enrichment',
      entryId,
      exampleSentences: [],
      synonyms: [],
      antonyms: [],
      collocations: [],
      createdAt: now,
      updatedAt: now,
    };
    // Link enrichmentId on the entry
    const updatedEntry: VocabularyEntry = { ...entry, enrichmentId: newId, updatedAt: now };
    await cosmosClient.upsert(updatedEntry);
  }

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

// ─── GET /enrichments (list all for the authenticated user) ──────────────────

async function listEnrichments(
  _req: HttpRequest,
  _ctx: InvocationContext,
  token: DecodedToken,
): Promise<HttpResponseInit> {
  const results = await cosmosClient.queryByPartition<AIEnrichment>(token.sub, { type: 'enrichment' });
  return { status: 200, jsonBody: results };
}

app.http('listEnrichments', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'enrichments',
  handler: authenticated(listEnrichments),
});
