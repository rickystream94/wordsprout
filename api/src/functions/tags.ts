import { app, type HttpRequest, type HttpResponseInit, type InvocationContext } from '@azure/functions';
import DOMPurify from 'isomorphic-dompurify';
import type { DecodedToken, VocabularyEntry } from '../models/types';
import { cosmosClient } from '../services/cosmos';
import { authenticated, apiError } from '../utils/http';

function sanitise(value: string): string {
  return DOMPurify.sanitize(value).trim();
}

// ─── PATCH /tags ──────────────────────────────────────────────────────────────

async function renameTag(
  req: HttpRequest,
  _ctx: InvocationContext,
  token: DecodedToken,
): Promise<HttpResponseInit> {
  const body = (await req.json()) as { oldTag?: unknown; newTag?: unknown };

  if (typeof body.oldTag !== 'string' || !body.oldTag.trim()) {
    return apiError(400, 'oldTag is required');
  }
  if (typeof body.newTag !== 'string' || !body.newTag.trim()) {
    return apiError(400, 'newTag is required');
  }

  const oldTag = body.oldTag.trim();
  const newTag = sanitise(body.newTag);

  if (!newTag) return apiError(400, 'newTag is invalid after sanitization');
  if (newTag.length > 50) return apiError(400, 'newTag must be 50 characters or fewer');
  if (oldTag === newTag) return { status: 200, jsonBody: { updatedCount: 0 } };

  const entries = await cosmosClient.queryByTagInPartition<VocabularyEntry>(token.sub, oldTag);
  const now = new Date().toISOString();

  await Promise.all(
    entries.map((entry) => {
      const tags = [...new Set(entry.tags.map((t) => (t === oldTag ? newTag : t)))];
      return cosmosClient.upsert<VocabularyEntry>({ ...entry, tags, updatedAt: now });
    }),
  );

  return { status: 200, jsonBody: { updatedCount: entries.length } };
}

// ─── DELETE /tags/{tagName} ───────────────────────────────────────────────────

async function deleteTag(
  req: HttpRequest,
  _ctx: InvocationContext,
  token: DecodedToken,
): Promise<HttpResponseInit> {
  const raw = req.params['tagName'];
  if (!raw) return apiError(400, 'Missing tagName');

  const tagName = decodeURIComponent(raw).trim();
  if (!tagName) return apiError(400, 'tagName must not be empty');

  const entries = await cosmosClient.queryByTagInPartition<VocabularyEntry>(token.sub, tagName);
  const now = new Date().toISOString();

  await Promise.all(
    entries.map((entry) => {
      const tags = entry.tags.filter((t) => t !== tagName);
      return cosmosClient.upsert<VocabularyEntry>({ ...entry, tags, updatedAt: now });
    }),
  );

  return { status: 200, jsonBody: { updatedCount: entries.length } };
}

// ─── Route registrations ──────────────────────────────────────────────────────

app.http('tags-rename', {
  methods: ['PATCH'],
  route: 'tags',
  authLevel: 'anonymous',
  handler: authenticated(renameTag),
});

app.http('tags-delete', {
  methods: ['DELETE'],
  route: 'tags/{tagName}',
  authLevel: 'anonymous',
  handler: authenticated(deleteTag),
});
