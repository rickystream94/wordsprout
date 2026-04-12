import MiniSearch from 'minisearch';
import type { DBEntry } from './db';
import { db } from './db';

// ─── MiniSearch document shape ────────────────────────────────────────────────

interface SearchDocument {
  id: string;
  sourceText: string;
  targetText: string;
  notes: string;
  tags: string;
}

// ─── Index singleton ──────────────────────────────────────────────────────────

let index: MiniSearch<SearchDocument> = buildEmptyIndex();

function buildEmptyIndex(): MiniSearch<SearchDocument> {
  return new MiniSearch<SearchDocument>({
    fields: ['sourceText', 'targetText', 'notes', 'tags'],
    storeFields: ['id'],
    searchOptions: {
      prefix: true,
      fuzzy: 0.2,
      boost: { sourceText: 2, targetText: 1.5, tags: 1.2 },
    },
  });
}

function toDocument(entry: DBEntry): SearchDocument {
  return {
    id: entry.id,
    sourceText: entry.sourceText,
    targetText: entry.targetText ?? '',
    notes: entry.notes ?? '',
    tags: entry.tags.join(' '),
  };
}

// ─── Build / rebuild the full index ──────────────────────────────────────────

export async function rebuildIndex(userId?: string): Promise<void> {
  const entries = userId
    ? await db.entries.where('userId').equals(userId).toArray()
    : await db.entries.toArray();

  const fresh = buildEmptyIndex();
  await fresh.addAllAsync(entries.map(toDocument));
  index = fresh;
}

// ─── Search ────────────────────────────────────────────────────────────────────

export interface SearchResult {
  id: string;
  score: number;
}

export function search(query: string): SearchResult[] {
  if (!query.trim()) return [];
  return index.search(query).map((r) => ({ id: r.id, score: r.score }));
}

export function searchIds(query: string): Set<string> {
  return new Set(search(query).map((r) => r.id));
}

// ─── Add / update / remove individual documents ───────────────────────────────

export function indexEntry(entry: DBEntry): void {
  try {
    index.remove({ id: entry.id } as SearchDocument);
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
  } catch (_) { /* not in index yet — ok */ }
  index.add(toDocument(entry));
}

export function removeFromIndex(entryId: string): void {
  try {
    index.remove({ id: entryId } as SearchDocument);
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
  } catch (_) { /* already removed — ok */ }
}
