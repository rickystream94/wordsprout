import { app, type HttpRequest, type HttpResponseInit, type InvocationContext } from '@azure/functions';
import DOMPurify from 'isomorphic-dompurify';
import {
  type AIEnrichment,
  type ExportEnrichment,
  type ExportEntry,
  type ExportPackage,
  type ExportPhrasebook,
  type ImportResult,
  type Phrasebook,
  type User,
  type VocabularyEntry,
} from '../models/types';
import { cosmosClient } from '../services/cosmos';
import { apiError, authenticated } from '../utils/http';
import type { DecodedToken } from '../models/types';

// ─── Sanitisation helper ───────────────────────────────────────────────────────

function san(value: string): string {
  return DOMPurify.sanitize(value).trim();
}

function sanOptional(value: string | undefined): string | undefined {
  if (value === undefined) return undefined;
  return DOMPurify.sanitize(value).trim() || undefined;
}

function sanArray(values: string[] | undefined): string[] {
  if (!Array.isArray(values)) return [];
  return values.map((v) => DOMPurify.sanitize(String(v)).trim()).filter(Boolean);
}

// ─── POST /data/import ────────────────────────────────────────────────────────

async function importData(
  req: HttpRequest,
  _ctx: InvocationContext,
  token: DecodedToken,
): Promise<HttpResponseInit> {

  // Step 1 — Size check via Content-Length header
  const contentLengthHeader = req.headers.get('content-length');
  const contentLength = contentLengthHeader !== null ? parseInt(contentLengthHeader, 10) : NaN;
  if (!isNaN(contentLength) && contentLength > 10 * 1024 * 1024) {
    return apiError(413, 'Request body exceeds the maximum allowed size of 10 MB');
  }

  // Step 2 — Parse JSON body
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiError(400, 'Request body is not valid JSON');
  }

  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    return apiError(400, 'Request body is not valid JSON');
  }

  const raw = body as Record<string, unknown>;

  // Step 3 — Schema validation
  if (!('schemaVersion' in raw) || !('app' in raw) || !('data' in raw)) {
    return apiError(422, 'File does not appear to be a WordSprout backup');
  }

  if (raw['schemaVersion'] !== 1) {
    return apiError(422, 'Unsupported schema version. Only version 1 is supported.');
  }

  if (raw['app'] !== 'wordsprout') {
    return apiError(422, 'File does not appear to be a WordSprout backup');
  }

  const data = raw['data'] as Record<string, unknown> | null | undefined;
  if (!data || !Array.isArray(data['phrasebooks']) || !Array.isArray(data['entries'])) {
    return apiError(422, 'Backup file has an unexpected structure');
  }

  const pkg = body as ExportPackage;
  const { phrasebooks: rawPhrasebooks, entries: rawEntries, enrichments: rawEnrichments } = pkg.data;

  // Validate phrasebooks
  for (const pb of rawPhrasebooks) {
    const p = pb as Partial<ExportPhrasebook>;
    if (!p.id || !p.name?.trim() || !p.sourceLanguageCode?.trim() || !p.targetLanguageCode?.trim()) {
      return apiError(422, 'One or more phrasebooks are missing required fields (id, name, sourceLanguageCode, targetLanguageCode)');
    }
  }

  // Validate entries
  for (const en of rawEntries) {
    const e = en as Partial<ExportEntry>;
    if (!e.id || !e.sourceText?.trim() || !e.phrasebookId?.trim()) {
      return apiError(422, 'One or more entries are missing required fields (id, sourceText, phrasebookId)');
    }
  }

  // Referential integrity: every entry.phrasebookId must exist in phrasebooks
  const phrasebookIdSet = new Set(rawPhrasebooks.map((pb: ExportPhrasebook) => pb.id));
  for (const en of rawEntries) {
    const e = en as ExportEntry;
    if (!phrasebookIdSet.has(e.phrasebookId)) {
      return apiError(422, 'One or more entries reference a phrasebook that is not in this backup');
    }
  }

  // Step 4 — Rate limit check
  const user = await cosmosClient.pointRead<User>(token.sub, token.sub);
  if (user?.lastImportAt) {
    const elapsed = Date.now() - new Date(user.lastImportAt).getTime();
    if (elapsed < 5 * 60 * 1000) {
      return apiError(429, 'Import rate limit exceeded. Please wait 5 minutes before importing again.');
    }
  }

  // Step 5 — Sanitise all string content
  const now = new Date().toISOString();
  const userId = token.sub;

  const sanitisedPhrasebooks: Phrasebook[] = rawPhrasebooks.map((pb: ExportPhrasebook) => ({
    id: pb.id,
    userId,
    type: 'phrasebook' as const,
    name: san(pb.name),
    sourceLanguageCode: san(pb.sourceLanguageCode),
    sourceLanguageName: sanOptional(pb.sourceLanguageName) ?? san(pb.sourceLanguageCode),
    targetLanguageCode: san(pb.targetLanguageCode),
    targetLanguageName: sanOptional(pb.targetLanguageName) ?? san(pb.targetLanguageCode),
    entryCount: 0, // recalculated below from actual imported entries
    fromTemplate: pb.fromTemplate ?? false,
    createdAt: pb.createdAt ?? now,
    updatedAt: pb.updatedAt ?? now,
  }));

  const sanitisedEntries: VocabularyEntry[] = rawEntries.map((en: ExportEntry) => ({
    id: en.id,
    userId,
    type: 'entry' as const,
    phrasebookId: en.phrasebookId,
    sourceText: san(en.sourceText),
    targetText: sanOptional(en.targetText),
    notes: sanOptional(en.notes),
    tags: sanArray(en.tags),
    partOfSpeech: en.partOfSpeech,
    learningScore: typeof en.learningScore === 'number' ? en.learningScore : 0,
    lastReviewedDate: en.lastReviewedDate ?? null,
    decayBaseScore: typeof en.decayBaseScore === 'number' ? en.decayBaseScore : null,
    enrichmentId: en.enrichmentId,
    createdAt: en.createdAt ?? now,
    updatedAt: en.updatedAt ?? now,
  }));

  // Recalculate entryCount on each phrasebook from actual imported entries
  const entryCountMap = new Map<string, number>();
  for (const e of sanitisedEntries) {
    entryCountMap.set(e.phrasebookId, (entryCountMap.get(e.phrasebookId) ?? 0) + 1);
  }
  for (const pb of sanitisedPhrasebooks) {
    pb.entryCount = entryCountMap.get(pb.id) ?? 0;
  }

  // Build a set of imported entry IDs for enrichment validation
  const entryIdSet = new Set(sanitisedEntries.map((e) => e.id));

  const enrichmentsToImport = Array.isArray(rawEnrichments) ? rawEnrichments : [];
  const sanitisedEnrichments: AIEnrichment[] = enrichmentsToImport
    .filter((en: ExportEnrichment) => en.entryId && entryIdSet.has(en.entryId))
    .map((en: ExportEnrichment) => ({
      id: en.id,
      userId,
      type: 'enrichment' as const,
      entryId: en.entryId,
      exampleSentences: sanArray(en.exampleSentences),
      synonyms: sanArray(en.synonyms),
      antonyms: sanArray(en.antonyms),
      collocations: sanArray(en.collocations),
      register: sanOptional(en.register),
      falseFriendWarning: sanOptional(en.falseFriendWarning),
      generatedAt: en.generatedAt,
      editedAt: en.editedAt,
      createdAt: en.createdAt ?? now,
      updatedAt: en.updatedAt ?? now,
    }));

  // Step 6 — Delete all existing content documents for this user
  const [existingPhrasebooks, existingEntries, existingEnrichments] = await Promise.all([
    cosmosClient.queryByPartition<Phrasebook>(userId, { type: 'phrasebook' }),
    cosmosClient.queryByPartition<VocabularyEntry>(userId, { type: 'entry' }),
    cosmosClient.queryByPartition<AIEnrichment>(userId, { type: 'enrichment' }),
  ]);

  await Promise.all([
    ...existingPhrasebooks.map((doc) => cosmosClient.deleteItem(doc.id, userId)),
    ...existingEntries.map((doc) => cosmosClient.deleteItem(doc.id, userId)),
    ...existingEnrichments.map((doc) => cosmosClient.deleteItem(doc.id, userId)),
  ]);

  // Step 7 — Upsert all imported documents
  await Promise.all([
    ...sanitisedPhrasebooks.map((doc) => cosmosClient.upsert(doc)),
    ...sanitisedEntries.map((doc) => cosmosClient.upsert(doc)),
    ...sanitisedEnrichments.map((doc) => cosmosClient.upsert(doc)),
  ]);

  // Step 8 — Update rate-limit timestamp on User document.
  // If the User document doesn't exist yet (e.g. new account in local dev),
  // create a minimal one so the rate-limit is enforced on the next import too.
  const updatedUser: User = user
    ? { ...user, lastImportAt: now }
    : {
        id: userId,
        userId,
        type: 'user',
        email: '',
        aiQuotaUsedToday: 0,
        aiDailyEnrichmentLimit: 10,
        aiQuotaResetAt: now,
        lastImportAt: now,
        createdAt: now,
        updatedAt: now,
      };
  await cosmosClient.upsert<User>(updatedUser);

  // Step 9 — Return canonical dataset for client re-hydration
  const result: ImportResult = {
    phrasebooksImported: sanitisedPhrasebooks.length,
    entriesImported: sanitisedEntries.length,
    enrichmentsImported: sanitisedEnrichments.length,
    phrasebooks: sanitisedPhrasebooks,
    entries: sanitisedEntries,
    enrichments: sanitisedEnrichments,
  };

  return { status: 200, jsonBody: result };
}

// ─── Route registration ───────────────────────────────────────────────────────

app.http('data-import', {
  methods: ['POST'],
  route: 'data/import',
  authLevel: 'anonymous',
  handler: authenticated(importData),
});
