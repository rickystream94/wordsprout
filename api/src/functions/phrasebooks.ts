import { app, type HttpRequest, type HttpResponseInit, type InvocationContext } from '@azure/functions';
import DOMPurify from 'isomorphic-dompurify';
import type { Phrasebook } from '../models/types';
import { cosmosClient } from '../services/cosmos';
import { authenticated, resolveId, apiError } from '../utils/http';
import type { DecodedToken } from '../models/types';

function sanitise(value: string): string {
  return DOMPurify.sanitize(value).trim();
}

// ─── POST /phrasebooks ─────────────────────────────────────────────────────────

async function createPhrasebook(
  req: HttpRequest,
  _ctx: InvocationContext,
  token: DecodedToken,
): Promise<HttpResponseInit> {

  const body = (await req.json()) as Partial<Phrasebook>;
  const name = sanitise(body.name ?? '');
  const sourceLanguageCode = sanitise(body.sourceLanguageCode ?? '');
  const sourceLanguageName = sanitise(body.sourceLanguageName ?? '');
  const targetLanguageCode = sanitise(body.targetLanguageCode ?? '');
  const targetLanguageName = sanitise(body.targetLanguageName ?? '');

  if (!name || !sourceLanguageCode || !targetLanguageCode) {
    return apiError(400, 'name, sourceLanguageCode, and targetLanguageCode are required');
  }

  const now = new Date().toISOString();

  // Use the client-provided id if it's a valid UUID, otherwise generate one.
  const clientId = resolveId(body.id);

  const phrasebook: Phrasebook = {
    id: clientId,
    userId: token.sub,
    type: 'phrasebook',
    name,
    sourceLanguageCode,
    sourceLanguageName,
    targetLanguageCode,
    targetLanguageName,
    entryCount: 0,
    createdAt: now,
    updatedAt: now,
  };

  await cosmosClient.upsert(phrasebook);
  return { status: 201, jsonBody: phrasebook };
}

// ─── GET /phrasebooks ──────────────────────────────────────────────────────────

async function listPhrasebooks(
  req: HttpRequest,
  _ctx: InvocationContext,
  token: DecodedToken,
): Promise<HttpResponseInit> {

  const results = await cosmosClient.queryByPartition<Phrasebook>(token.sub, { type: 'phrasebook' });
  return { status: 200, jsonBody: results };
}

// ─── GET /phrasebooks/{id} ─────────────────────────────────────────────────────

async function getPhrasebook(
  req: HttpRequest,
  _ctx: InvocationContext,
  token: DecodedToken,
): Promise<HttpResponseInit> {

  const id = req.params['id'];
  if (!id) return apiError(400, 'Missing phrasebook id');

  const phrasebook = await cosmosClient.pointRead<Phrasebook>(id, token.sub);
  if (!phrasebook || phrasebook.type !== 'phrasebook') return apiError(404, 'Phrasebook not found');
  if (phrasebook.userId !== token.sub) return apiError(403, 'Access denied');

  return { status: 200, jsonBody: phrasebook };
}

// ─── PUT /phrasebooks/{id} ─────────────────────────────────────────────────────

async function updatePhrasebook(
  req: HttpRequest,
  _ctx: InvocationContext,
  token: DecodedToken,
): Promise<HttpResponseInit> {

  const id = req.params['id'];
  if (!id) return apiError(400, 'Missing phrasebook id');

  const existing = await cosmosClient.pointRead<Phrasebook>(id, token.sub);
  if (!existing || existing.type !== 'phrasebook') return apiError(404, 'Phrasebook not found');
  if (existing.userId !== token.sub) return apiError(403, 'Access denied');

  const body = (await req.json()) as Partial<Phrasebook>;
  const updated: Phrasebook = {
    ...existing,
    name: body.name !== undefined ? sanitise(body.name) : existing.name,
    sourceLanguageCode: body.sourceLanguageCode !== undefined ? sanitise(body.sourceLanguageCode) : existing.sourceLanguageCode,
    sourceLanguageName: body.sourceLanguageName !== undefined ? sanitise(body.sourceLanguageName) : existing.sourceLanguageName,
    targetLanguageCode: body.targetLanguageCode !== undefined ? sanitise(body.targetLanguageCode) : existing.targetLanguageCode,
    targetLanguageName: body.targetLanguageName !== undefined ? sanitise(body.targetLanguageName) : existing.targetLanguageName,
    updatedAt: new Date().toISOString(),
  };

  await cosmosClient.upsert(updated);
  return { status: 200, jsonBody: updated };
}

// ─── DELETE /phrasebooks/{id} ──────────────────────────────────────────────────

async function deletePhrasebook(
  req: HttpRequest,
  _ctx: InvocationContext,
  token: DecodedToken,
): Promise<HttpResponseInit> {

  const id = req.params['id'];
  if (!id) return apiError(400, 'Missing phrasebook id');

  const existing = await cosmosClient.pointRead<Phrasebook>(id, token.sub);
  if (!existing || existing.type !== 'phrasebook') return apiError(404, 'Phrasebook not found');
  if (existing.userId !== token.sub) return apiError(403, 'Access denied');

  await cosmosClient.deleteItem(id, token.sub);
  // Note: entry cascade deletion is handled by the frontend's offline-first delete path.
  // On the API side we trust the client to enqueue individual entry deletes, or an admin job handles orphans.
  return { status: 204 };
}

// ─── Route registrations ───────────────────────────────────────────────────────

app.http('phrasebooks-create', {
  methods: ['POST'],
  route: 'phrasebooks',
  authLevel: 'anonymous',
  handler: authenticated(createPhrasebook),
});

app.http('phrasebooks-list', {
  methods: ['GET'],
  route: 'phrasebooks',
  authLevel: 'anonymous',
  handler: authenticated(listPhrasebooks),
});

app.http('phrasebooks-get', {
  methods: ['GET'],
  route: 'phrasebooks/{id}',
  authLevel: 'anonymous',
  handler: authenticated(getPhrasebook),
});

app.http('phrasebooks-update', {
  methods: ['PUT'],
  route: 'phrasebooks/{id}',
  authLevel: 'anonymous',
  handler: authenticated(updatePhrasebook),
});

app.http('phrasebooks-delete', {
  methods: ['DELETE'],
  route: 'phrasebooks/{id}',
  authLevel: 'anonymous',
  handler: authenticated(deletePhrasebook),
});
