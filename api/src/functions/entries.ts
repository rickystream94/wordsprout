import { app, type HttpRequest, type HttpResponseInit, type InvocationContext } from '@azure/functions';
import DOMPurify from 'isomorphic-dompurify';
import type { Phrasebook, VocabularyEntry } from '../models/types';
import { cosmosClient } from '../services/cosmos';
import { authenticated, resolveId, apiError } from '../utils/http';
import type { DecodedToken } from '../models/types';

function sanitise(value: string): string {
  return DOMPurify.sanitize(value).trim();
}

function sanitiseArray(values: string[]): string[] {
  return values.map(sanitise).filter(Boolean);
}

/**
 * Allowlist for sourceText and targetText fields.
 * Permits Unicode letters (all scripts), digits, combining marks (diacritics),
 * whitespace, apostrophes, hyphens, en/em-dashes, and common punctuation.
 * Characters like parentheses, +, @, etc. are rejected — users should use
 * the notes field for annotations.
 */
const ENTRY_TEXT_PATTERN = /^[\p{L}\p{N}\p{M}\s'\u2019\-.,!?:;\u2013\u2014\u2026\/]+$/u;

function validateEntryTextField(text: string): boolean {
  const trimmed = text.trim();
  return !trimmed || ENTRY_TEXT_PATTERN.test(trimmed);
}

/**
 * Normalize vocabulary entry text: lowercase, trim, collapse spaces.
 * Preserves Unicode letters, numbers, apostrophes, hyphens and diacritics.
 * Applied to sourceText and targetText only — not notes.
 */
function normalizeEntryText(text: string): string {
  return text
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase();
}

// ─── POST /entries ─────────────────────────────────────────────────────────────

async function createEntry(req: HttpRequest, _ctx: InvocationContext, token: DecodedToken): Promise<HttpResponseInit> {

  const body = (await req.json()) as Partial<VocabularyEntry>;
  const phrasebookId = sanitise(body.phrasebookId ?? '');
  const rawSourceText = sanitise(body.sourceText ?? '');

  if (!phrasebookId || !rawSourceText.trim()) {
    return apiError(400, 'phrasebookId and sourceText are required');
  }

  if (!validateEntryTextField(rawSourceText)) {
    return apiError(400, 'sourceText contains invalid characters. Only letters, numbers, spaces and common punctuation are allowed.');
  }

  const rawTargetInput = body.targetText ? sanitise(body.targetText) : undefined;
  if (rawTargetInput && !validateEntryTextField(rawTargetInput)) {
    return apiError(400, 'targetText contains invalid characters. Only letters, numbers, spaces and common punctuation are allowed.');
  }

  const sourceText = normalizeEntryText(rawSourceText);

  // Verify phrasebook ownership
  const phrasebook = await cosmosClient.pointRead<Phrasebook>(phrasebookId, token.sub);
  if (!phrasebook || phrasebook.type !== 'phrasebook') {
    return apiError(404, 'Phrasebook not found');
  }
  if (phrasebook.userId !== token.sub) {
    return apiError(403, 'Access denied');
  }

  // Server-side duplicate detection within the same phrasebook
  const existing = await cosmosClient.queryByPartition<VocabularyEntry>(token.sub, {
    type: 'entry',
    phrasebookId,
  });
  const rawTargetText = rawTargetInput ? normalizeEntryText(rawTargetInput) : undefined;
  const dupSrc = existing.find((e) => normalizeEntryText(e.sourceText) === sourceText);
  if (dupSrc) {
    const label = dupSrc.targetText ? `"${dupSrc.sourceText}" → "${dupSrc.targetText}"` : `"${dupSrc.sourceText}"`;
    return apiError(409, `An entry with this source text already exists in the phrasebook (${label}).`);
  }
  if (rawTargetText) {
    const dupTgt = existing.find((e) => e.targetText && normalizeEntryText(e.targetText) === rawTargetText);
    if (dupTgt) {
      const label = `"${dupTgt.sourceText}" → "${dupTgt.targetText}"`;
      return apiError(409, `An entry with this translation already exists in the phrasebook (${label}).`);
    }
  }

  const now = new Date().toISOString();

  // Use the client-provided id if it's a valid UUID, otherwise generate one.
  // This ensures subsequent PUT/DELETE mutations in the sync queue reference the same id.
  const clientId = resolveId(body.id);

  // Idempotency: if this exact mutation was already applied (e.g. client sent it,
  // server wrote it, but the response never reached the client — common after a tab
  // close mid-sync), just return the existing entry rather than 409-ing on text dups.
  const idempotentEntry = await cosmosClient.pointRead<VocabularyEntry>(clientId, token.sub);
  if (idempotentEntry && idempotentEntry.type === 'entry' && idempotentEntry.phrasebookId === phrasebookId) {
    return { status: 200, jsonBody: idempotentEntry };
  }

  const entry: VocabularyEntry = {
    id: clientId,
    userId: token.sub,
    type: 'entry',
    phrasebookId,
    sourceText,
    targetText: rawTargetText,
    notes: body.notes ? sanitise(body.notes) : undefined,
    tags: sanitiseArray(body.tags ?? []),
    partOfSpeech: body.partOfSpeech,
    learningScore: 0,
    lastReviewedDate: null,
    decayBaseScore: null,
    createdAt: now,
    updatedAt: now,
  };

  await Promise.all([
    cosmosClient.upsert(entry),
    // Increment entryCount on phrasebook
    cosmosClient.upsert(
      { ...phrasebook, entryCount: phrasebook.entryCount + 1, updatedAt: now },
    ),
  ]);

  return { status: 201, jsonBody: entry };
}

// ─── GET /entries/{id} ─────────────────────────────────────────────────────────

async function getEntry(req: HttpRequest, _ctx: InvocationContext, token: DecodedToken): Promise<HttpResponseInit> {

  const id = req.params['id'];
  if (!id) return apiError(400, 'Missing entry id');

  const entry = await cosmosClient.pointRead<VocabularyEntry>(id, token.sub);
  if (!entry || entry.type !== 'entry') return apiError(404, 'Entry not found');
  if (entry.userId !== token.sub) return apiError(403, 'Access denied');

  return { status: 200, jsonBody: entry };
}

// ─── GET /entries (list with query params) ─────────────────────────────────────

async function listEntries(req: HttpRequest, _ctx: InvocationContext, token: DecodedToken): Promise<HttpResponseInit> {

  const filters: Record<string, string> = { type: 'entry' };
  const phrasebookId = req.query.get('phrasebookId');
  const partOfSpeech = req.query.get('partOfSpeech');
  if (phrasebookId) filters['phrasebookId'] = phrasebookId;
  if (partOfSpeech) filters['partOfSpeech'] = partOfSpeech;

  const limitParam = req.query.get('limit');
  const continuationToken = req.query.get('continuationToken') ?? undefined;

  // When a limit is requested (or a continuation token is supplied) respond
  // with a paginated envelope so callers can page through large result sets.
  if (limitParam !== null || continuationToken !== undefined) {
    const parsedLimit = limitParam !== null ? parseInt(limitParam, 10) : 200;
    if (isNaN(parsedLimit) || parsedLimit < 1) return apiError(400, 'limit must be a positive integer');
    const limit = Math.min(parsedLimit, 500); // hard cap per page

    const { items, continuationToken: nextToken } =
      await cosmosClient.queryByPartitionPaginated<VocabularyEntry>(token.sub, filters, {
        maxItems: limit,
        continuationToken,
      });

    return {
      status: 200,
      jsonBody: {
        items,
        ...(nextToken ? { nextContinuationToken: nextToken } : {}),
      },
    };
  }

  // No pagination params — return flat array (backward compatibility).
  const results = await cosmosClient.queryByPartition<VocabularyEntry>(token.sub, filters);
  return { status: 200, jsonBody: results };
}

// ─── PUT /entries/{id} ─────────────────────────────────────────────────────────

async function updateEntry(req: HttpRequest, _ctx: InvocationContext, token: DecodedToken): Promise<HttpResponseInit> {

  const id = req.params['id'];
  if (!id) return apiError(400, 'Missing entry id');

  const existing = await cosmosClient.pointRead<VocabularyEntry>(id, token.sub);
  if (!existing || existing.type !== 'entry') return apiError(404, 'Entry not found');
  if (existing.userId !== token.sub) return apiError(403, 'Access denied');

  const body = (await req.json()) as Partial<VocabularyEntry>;

  // Validate sourceText / targetText against the allowlist if provided
  if (body.sourceText !== undefined) {
    const rawSrc = sanitise(body.sourceText);
    if (!validateEntryTextField(rawSrc)) {
      return apiError(400, 'sourceText contains invalid characters. Only letters, numbers, spaces and common punctuation are allowed.');
    }
  }
  if (body.targetText !== undefined && body.targetText !== null) {
    const rawTgt = sanitise(body.targetText);
    if (!validateEntryTextField(rawTgt)) {
      return apiError(400, 'targetText contains invalid characters. Only letters, numbers, spaces and common punctuation are allowed.');
    }
  }

  // Validate learningScore if provided
  if (body.learningScore !== undefined) {
    const newScore = Number(body.learningScore);
    if (!Number.isInteger(newScore) || newScore < 0 || newScore > 100)
      return apiError(400, 'learningScore must be an integer between 0 and 100');
    // Only enforce delta and daily-review guards when the score is actually changing.
    // Sending the same score as the server (e.g. a tag edit that echoes the full object)
    // must not be treated as a review attempt.
    if (newScore !== (existing.learningScore ?? 0)) {
      const delta = newScore - (existing.learningScore ?? 0);
      if (delta < -5 || delta > 10)
        return apiError(400, 'learningScore delta must be between -5 and +10');
      // Validate daily-review uniqueness using server UTC date (FR-022)
      // The client-submitted lastReviewedDate is irrelevant for this gate —
      // the server's own UTC date is the authority.
      const todayUtc = new Date().toISOString().slice(0, 10);
      if (todayUtc === existing.lastReviewedDate)
        return apiError(400, 'Entry already reviewed today');
    }
  }

  // Validate lastReviewedDate format if provided (input boundary check)
  if (body.lastReviewedDate !== undefined && body.lastReviewedDate !== null) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(body.lastReviewedDate))
      return apiError(400, 'lastReviewedDate must be YYYY-MM-DD or null');
  }

  const updated: VocabularyEntry = {
    ...existing,
    sourceText: body.sourceText !== undefined ? normalizeEntryText(sanitise(body.sourceText)) : existing.sourceText,
    targetText: body.targetText !== undefined ? (normalizeEntryText(sanitise(body.targetText ?? '')) || undefined) : existing.targetText,
    notes: body.notes !== undefined ? sanitise(body.notes ?? '') || undefined : existing.notes,
    tags: body.tags !== undefined ? sanitiseArray(body.tags) : existing.tags,
    partOfSpeech: body.partOfSpeech !== undefined ? body.partOfSpeech : existing.partOfSpeech,
    learningScore: body.learningScore !== undefined ? Number(body.learningScore) : existing.learningScore,
    lastReviewedDate: body.lastReviewedDate !== undefined ? body.lastReviewedDate : existing.lastReviewedDate,
    decayBaseScore: body.decayBaseScore !== undefined ? body.decayBaseScore : (existing.decayBaseScore ?? null),
    updatedAt: new Date().toISOString(),
  };

  await cosmosClient.upsert(updated);
  return { status: 200, jsonBody: updated };
}

// ─── DELETE /entries/{id} ──────────────────────────────────────────────────────

async function deleteEntry(req: HttpRequest, _ctx: InvocationContext, token: DecodedToken): Promise<HttpResponseInit> {

  const id = req.params['id'];
  if (!id) return apiError(400, 'Missing entry id');

  const existing = await cosmosClient.pointRead<VocabularyEntry>(id, token.sub);
  if (!existing || existing.type !== 'entry') return apiError(404, 'Entry not found');
  if (existing.userId !== token.sub) return apiError(403, 'Access denied');

  await cosmosClient.deleteItem(id, token.sub);

  // Decrement entryCount on parent phrasebook
  const phrasebook = await cosmosClient.pointRead<Phrasebook>(existing.phrasebookId, token.sub);
  if (phrasebook && phrasebook.type === 'phrasebook') {
    await cosmosClient.upsert(
      {
        ...phrasebook,
        entryCount: Math.max(0, phrasebook.entryCount - 1),
        updatedAt: new Date().toISOString(),
      },
    );
  }

  return { status: 204 };
}

// ─── Route registrations ───────────────────────────────────────────────────────

app.http('entries-create', {
  methods: ['POST'],
  route: 'entries',
  authLevel: 'anonymous',
  handler: authenticated(createEntry),
});

app.http('entries-list', {
  methods: ['GET'],
  route: 'entries',
  authLevel: 'anonymous',
  handler: authenticated(listEntries),
});

app.http('entries-get', {
  methods: ['GET'],
  route: 'entries/{id}',
  authLevel: 'anonymous',
  handler: authenticated(getEntry),
});

app.http('entries-update', {
  methods: ['PUT'],
  route: 'entries/{id}',
  authLevel: 'anonymous',
  handler: authenticated(updateEntry),
});

app.http('entries-delete', {
  methods: ['DELETE'],
  route: 'entries/{id}',
  authLevel: 'anonymous',
  handler: authenticated(deleteEntry),
});
