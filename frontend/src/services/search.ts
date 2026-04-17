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
  synonyms: string;
}

// ─── Index singleton ──────────────────────────────────────────────────────────

let index: MiniSearch<SearchDocument> = buildEmptyIndex();

function buildEmptyIndex(): MiniSearch<SearchDocument> {
  return new MiniSearch<SearchDocument>({
    fields: ['sourceText', 'targetText', 'notes', 'tags', 'synonyms'],
    storeFields: ['id'],
    searchOptions: {
      prefix: true,
      fuzzy: 0.2,
      boost: { sourceText: 2, targetText: 1.5, tags: 1.2, synonyms: 1.4 },
    },
  });
}

function toDocument(entry: DBEntry, synonyms?: string[]): SearchDocument {
  return {
    id: entry.id,
    sourceText: entry.sourceText,
    targetText: entry.targetText ?? '',
    notes: entry.notes ?? '',
    tags: entry.tags.join(' '),
    synonyms: (synonyms ?? []).join(' '),
  };
}

// ─── Build / rebuild the full index ──────────────────────────────────────────

export async function rebuildIndex(userId?: string): Promise<void> {
  const entries = userId
    ? await db.entries.where('userId').equals(userId).toArray()
    : await db.entries.toArray();

  const enrichments = await db.enrichments.where('entryId').anyOf(entries.map((e) => e.id)).toArray();
  const synonymMap: Record<string, string[]> = {};
  for (const en of enrichments) synonymMap[en.entryId] = en.synonyms;

  const fresh = buildEmptyIndex();
  await fresh.addAllAsync(entries.map((e) => toDocument(e, synonymMap[e.id])));
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

/**
 * Secondary substring pass: case-insensitive infix match on sourceText,
 * targetText, notes, tags, and optional synonyms.
 * Use this alongside searchIds() to find e.g. "chair" when searching "hair".
 */
export function substringMatch(
  query: string,
  entries: { id: string; sourceText: string; targetText?: string; notes?: string; tags: string[] }[],
  synonymMap: Record<string, string[]> = {},
): Set<string> {
  const q = query.trim().toLowerCase();
  if (!q) return new Set();
  const ids = new Set<string>();
  for (const e of entries) {
    if (
      e.sourceText.toLowerCase().includes(q) ||
      (e.targetText?.toLowerCase().includes(q)) ||
      (e.notes?.toLowerCase().includes(q)) ||
      e.tags.some((t) => t.toLowerCase().includes(q)) ||
      (synonymMap[e.id] ?? []).some((s) => s.toLowerCase().includes(q))
    ) {
      ids.add(e.id);
    }
  }
  return ids;
}

// ─── Add / update / remove individual documents ───────────────────────────────

/** Index or re-index a single entry. Loads its enrichment from DB for synonym support. */
export async function indexEntry(entry: DBEntry): Promise<void> {
  try {
    index.remove({ id: entry.id } as SearchDocument);
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
  } catch (_) { /* not in index yet — ok */ }
  const enrichment = await db.enrichments.where('entryId').equals(entry.id).first();
  index.add(toDocument(entry, enrichment?.synonyms));
}

export function removeFromIndex(entryId: string): void {
  try {
    index.remove({ id: entryId } as SearchDocument);
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
  } catch (_) { /* already removed — ok */ }
}
