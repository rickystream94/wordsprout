import { app, type HttpRequest, type HttpResponseInit, type InvocationContext } from '@azure/functions';
import DOMPurify from 'isomorphic-dompurify';
import { randomUUID } from 'node:crypto';
import { authorise } from '../middleware/authorise';
import type { Phrasebook, VocabularyEntry } from '../models/types';
import { cosmosClient } from '../services/cosmos';

function sanitise(value: string): string {
  return DOMPurify.sanitize(value).trim();
}

function sanitiseArray(values: string[]): string[] {
  return values.map(sanitise).filter(Boolean);
}

function apiError(statusCode: number, message: string): HttpResponseInit {
  return {
    status: statusCode,
    jsonBody: {
      error:
        statusCode === 403 ? 'Forbidden' : statusCode === 404 ? 'Not Found' : 'Error',
      message,
      statusCode,
    },
  };
}

// ─── POST /entries ─────────────────────────────────────────────────────────────

async function createEntry(req: HttpRequest, _ctx: InvocationContext): Promise<HttpResponseInit> {
  let token;
  try {
    token = await authorise(req);
  } catch (err: unknown) {
    const e = err as { statusCode: number; message: string };
    return apiError(e.statusCode, e.message);
  }

  const body = (await req.json()) as Partial<VocabularyEntry>;
  const phrasebookId = sanitise(body.phrasebookId ?? '');
  const sourceText = sanitise(body.sourceText ?? '');

  if (!phrasebookId || !sourceText) {
    return apiError(400, 'phrasebookId and sourceText are required');
  }

  // Verify phrasebook ownership
  const phrasebook = await cosmosClient.pointRead<Phrasebook>(phrasebookId, token.sub);
  if (!phrasebook || phrasebook.type !== 'phrasebook') {
    return apiError(404, 'Phrasebook not found');
  }
  if (phrasebook.userId !== token.sub) {
    return apiError(403, 'Access denied');
  }

  const now = new Date().toISOString();
  const entry: VocabularyEntry = {
    id: randomUUID(),
    userId: token.sub,
    type: 'entry',
    phrasebookId,
    sourceText,
    targetText: body.targetText ? sanitise(body.targetText) : undefined,
    notes: body.notes ? sanitise(body.notes) : undefined,
    tags: sanitiseArray(body.tags ?? []),
    partOfSpeech: body.partOfSpeech,
    learningState: body.learningState ?? 'new',
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

async function getEntry(req: HttpRequest, _ctx: InvocationContext): Promise<HttpResponseInit> {
  let token;
  try {
    token = await authorise(req);
  } catch (err: unknown) {
    const e = err as { statusCode: number; message: string };
    return apiError(e.statusCode, e.message);
  }

  const id = req.params['id'];
  if (!id) return apiError(400, 'Missing entry id');

  const entry = await cosmosClient.pointRead<VocabularyEntry>(id, token.sub);
  if (!entry || entry.type !== 'entry') return apiError(404, 'Entry not found');
  if (entry.userId !== token.sub) return apiError(403, 'Access denied');

  return { status: 200, jsonBody: entry };
}

// ─── GET /entries (list with query params) ─────────────────────────────────────

async function listEntries(req: HttpRequest, _ctx: InvocationContext): Promise<HttpResponseInit> {
  let token;
  try {
    token = await authorise(req);
  } catch (err: unknown) {
    const e = err as { statusCode: number; message: string };
    return apiError(e.statusCode, e.message);
  }

  const filters: Record<string, string> = { type: 'entry' };
  const phrasebookId = req.query.get('phrasebookId');
  const learningState = req.query.get('learningState');
  const partOfSpeech = req.query.get('partOfSpeech');
  if (phrasebookId) filters['phrasebookId'] = phrasebookId;
  if (learningState) filters['learningState'] = learningState;
  if (partOfSpeech) filters['partOfSpeech'] = partOfSpeech;

  const results = await cosmosClient.queryByPartition<VocabularyEntry>(token.sub, filters);
  return { status: 200, jsonBody: results };
}

// ─── PUT /entries/{id} ─────────────────────────────────────────────────────────

async function updateEntry(req: HttpRequest, _ctx: InvocationContext): Promise<HttpResponseInit> {
  let token;
  try {
    token = await authorise(req);
  } catch (err: unknown) {
    const e = err as { statusCode: number; message: string };
    return apiError(e.statusCode, e.message);
  }

  const id = req.params['id'];
  if (!id) return apiError(400, 'Missing entry id');

  const existing = await cosmosClient.pointRead<VocabularyEntry>(id, token.sub);
  if (!existing || existing.type !== 'entry') return apiError(404, 'Entry not found');
  if (existing.userId !== token.sub) return apiError(403, 'Access denied');

  const body = (await req.json()) as Partial<VocabularyEntry>;
  const updated: VocabularyEntry = {
    ...existing,
    sourceText: body.sourceText !== undefined ? sanitise(body.sourceText) : existing.sourceText,
    targetText: body.targetText !== undefined ? sanitise(body.targetText ?? '') || undefined : existing.targetText,
    notes: body.notes !== undefined ? sanitise(body.notes ?? '') || undefined : existing.notes,
    tags: body.tags !== undefined ? sanitiseArray(body.tags) : existing.tags,
    partOfSpeech: body.partOfSpeech !== undefined ? body.partOfSpeech : existing.partOfSpeech,
    learningState: body.learningState ?? existing.learningState,
    updatedAt: new Date().toISOString(),
  };

  await cosmosClient.upsert(updated);
  return { status: 200, jsonBody: updated };
}

// ─── DELETE /entries/{id} ──────────────────────────────────────────────────────

async function deleteEntry(req: HttpRequest, _ctx: InvocationContext): Promise<HttpResponseInit> {
  let token;
  try {
    token = await authorise(req);
  } catch (err: unknown) {
    const e = err as { statusCode: number; message: string };
    return apiError(e.statusCode, e.message);
  }

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
  handler: createEntry,
});

app.http('entries-list', {
  methods: ['GET'],
  route: 'entries',
  authLevel: 'anonymous',
  handler: listEntries,
});

app.http('entries-get', {
  methods: ['GET'],
  route: 'entries/{id}',
  authLevel: 'anonymous',
  handler: getEntry,
});

app.http('entries-update', {
  methods: ['PUT'],
  route: 'entries/{id}',
  authLevel: 'anonymous',
  handler: updateEntry,
});

app.http('entries-delete', {
  methods: ['DELETE'],
  route: 'entries/{id}',
  authLevel: 'anonymous',
  handler: deleteEntry,
});
