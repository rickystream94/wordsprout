import Dexie, { type Table } from 'dexie';
import type {
  MutationMethod,
  PartOfSpeech,
  SyncStatus,
} from '../types/models';
import {
  TEMPLATE_ENTRIES,
  TEMPLATE_LANGUAGES,
  type TemplateLanguageCode,
} from '../data/templatePhrasebooks';
import { randomUUID } from '../utils/uuid';
import { todayKey } from './scoring';

// ─── Client-side model types (mirrors api/src/models/types.ts) ────────────────

export interface DBPhrasebook {
  id: string;
  userId: string;
  name: string;
  sourceLanguageCode: string;
  sourceLanguageName: string;
  targetLanguageCode: string;
  targetLanguageName: string;
  entryCount: number;
  fromTemplate?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface DBEntry {
  id: string;
  userId: string;
  phrasebookId: string;
  sourceText: string;
  targetText?: string;
  notes?: string;
  tags: string[];
  partOfSpeech?: PartOfSpeech;
  learningScore: number;           // integer 0–100
  lastReviewedDate: string | null; // 'YYYY-MM-DD' local date, null = never
  decayBaseScore: number | null;   // score at last review session; anchors decay formula; null = never reviewed
  enrichmentId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface DBEnrichment {
  id: string;
  userId: string;
  entryId: string;
  exampleSentences: string[];
  synonyms: string[];
  antonyms: string[];
  register?: string;
  collocations: string[];
  falseFriendWarning?: string;
  generatedAt?: string;
  editedAt?: string;
}

export interface DBPendingMutation {
  id?: number; // Dexie auto-increment
  url: string;
  method: MutationMethod;
  body?: string;
  retryCount: number;
  status: SyncStatus;
  createdAt: string;
  lastAttemptAt?: string;
  errorMessage?: string;
}

export interface DBMeta {
  key: string;
  value: string;
}

// ─── Dexie database class ─────────────────────────────────────────────────────

class WordSproutDB extends Dexie {
  phrasebooks!: Table<DBPhrasebook, string>;
  entries!: Table<DBEntry, string>;
  enrichments!: Table<DBEnrichment, string>;
  pendingSync!: Table<DBPendingMutation, number>;
  meta!: Table<DBMeta, string>;

  constructor() {
    super('wordsprout');

    this.version(1).stores({
      // Primary key + indexed fields
      phrasebooks: 'id, userId, createdAt, updatedAt',
      entries:
        'id, userId, phrasebookId, learningState, partOfSpeech, createdAt, updatedAt, *tags',
      enrichments: 'id, userId, entryId',
      pendingSync: '++id, status, createdAt',
      meta: 'key',
    });

    this.version(2)
      .stores({
        phrasebooks: 'id, userId, createdAt, updatedAt',
        entries:
          'id, userId, phrasebookId, learningScore, partOfSpeech, createdAt, updatedAt, *tags',
        enrichments: 'id, userId, entryId',
        pendingSync: '++id, status, createdAt',
        meta: 'key',
      })
      .upgrade(async (tx) => {
        const MIGRATION_MAP: Record<string, number> = { new: 0, learning: 30, mastered: 90 };
        await tx.table('entries').toCollection().modify((entry) => {
          const oldState = (entry as Record<string, unknown>)['learningState'] as string | undefined;
          entry.learningScore = oldState !== undefined ? (MIGRATION_MAP[oldState] ?? 0) : 0;
          entry.lastReviewedDate = null;
          delete (entry as Record<string, unknown>)['learningState'];
        });
      });
  }
}

export const db = new WordSproutDB();

// ─── T022: Phrasebook CRUD ────────────────────────────────────────────────────

export class DuplicateLanguagePairError extends Error {
  constructor(sourceLanguageName: string, targetLanguageName: string) {
    super(`A phrasebook for ${sourceLanguageName} → ${targetLanguageName} already exists.`);
    this.name = 'DuplicateLanguagePairError';
  }
}

export async function createPhrasebook(data: Omit<DBPhrasebook, 'id'> & { id: string }): Promise<DBPhrasebook> {
  // Duplicate language-pair guard (FR-011)
  const duplicate = await db.phrasebooks
    .where('userId').equals(data.userId)
    .filter(
      (pb) => pb.sourceLanguageCode === data.sourceLanguageCode && pb.targetLanguageCode === data.targetLanguageCode,
    )
    .first();
  if (duplicate) {
    throw new DuplicateLanguagePairError(data.sourceLanguageName, data.targetLanguageName);
  }
  await db.phrasebooks.add(data);
  return data;
}

export async function getPhrasebooks(userId: string): Promise<DBPhrasebook[]> {
  return db.phrasebooks.where('userId').equals(userId).sortBy('createdAt');
}

export async function getPhrasebook(id: string): Promise<DBPhrasebook | undefined> {
  return db.phrasebooks.get(id);
}

export async function updatePhrasebook(
  id: string,
  changes: Partial<Omit<DBPhrasebook, 'id' | 'userId'>>,
): Promise<void> {
  await db.phrasebooks.update(id, { ...changes, updatedAt: new Date().toISOString() });
}

export async function deletePhrasebook(id: string): Promise<void> {
  await db.transaction('rw', db.phrasebooks, db.entries, db.enrichments, async () => {
    const entryIds = (await db.entries.where('phrasebookId').equals(id).primaryKeys()) as string[];
    if (entryIds.length > 0) {
      await db.enrichments.where('entryId').anyOf(entryIds).delete();
      await db.entries.where('phrasebookId').equals(id).delete();
    }
    await db.phrasebooks.delete(id);
  });
}

// ─── Template phrasebook generation ──────────────────────────────────────────

/**
 * Generate a template phrasebook for the given target language.
 * Writes 1 phrasebook + 50 entries to IndexedDB atomically,
 * then enqueues 51 sync mutations (phrasebook first, then entries).
 *
 * @throws {DuplicateLanguagePairError} if a phrasebook for en→targetCode already exists.
 */
export async function generateTemplatePhrasebook(
  userId: string,
  targetCode: TemplateLanguageCode,
  apiBase: string,
): Promise<DBPhrasebook> {
  const targetLang = TEMPLATE_LANGUAGES.find((l) => l.code === targetCode);
  if (!targetLang) throw new Error(`Unsupported template language code: ${targetCode}`);

  // Duplicate guard
  const duplicate = await db.phrasebooks
    .where('userId').equals(userId)
    .filter((pb) => pb.sourceLanguageCode === 'en' && pb.targetLanguageCode === targetCode)
    .first();
  if (duplicate) throw new DuplicateLanguagePairError('English', targetLang.name);

  const now = new Date().toISOString();
  const phrasebookId = randomUUID();

  const phrasebook: DBPhrasebook = {
    id: phrasebookId,
    userId,
    name: `English → ${targetLang.name} Starter`,
    sourceLanguageCode: 'en',
    sourceLanguageName: 'English',
    targetLanguageCode: targetCode,
    targetLanguageName: targetLang.name,
    entryCount: 50,
    fromTemplate: true,
    createdAt: now,
    updatedAt: now,
  };

  const entries: (DBEntry & { id: string })[] = TEMPLATE_ENTRIES.map((te) => ({
    id: randomUUID(),
    userId,
    phrasebookId,
    sourceText: te.sourceText,
    targetText: te.translations[targetCode],
    tags: te.tags,
    partOfSpeech: te.partOfSpeech,
    learningScore: 0,
    lastReviewedDate: null,
    decayBaseScore: null,
    createdAt: now,
    updatedAt: now,
  }));

  // Write 51 records atomically (1 phrasebook + 50 entries) + enqueue sync mutations.
  // Enrichments are intentionally omitted: the static template data is in English (the
  // source language) and there is no POST /enrichments API endpoint. Users can generate
  // per-language enrichments via the AI enrichment feature on individual entries.
  await db.transaction('rw', db.phrasebooks, db.entries, db.pendingSync, async () => {
    await db.phrasebooks.add(phrasebook);
    await db.entries.bulkAdd(entries);

    // Enqueue sync: phrasebook first, then entries
    await db.pendingSync.add({
      url: `${apiBase}/phrasebooks`,
      method: 'POST',
      body: JSON.stringify(phrasebook),
      retryCount: 0,
      status: 'pending',
      createdAt: now,
    });
    for (const entry of entries) {
      await db.pendingSync.add({
        url: `${apiBase}/entries`,
        method: 'POST',
        body: JSON.stringify(entry),
        retryCount: 0,
        status: 'pending',
        createdAt: now,
      });
    }
  });

  return phrasebook;
}

// ─── T023: VocabularyEntry CRUD ───────────────────────────────────────────────

export async function createEntry(data: Omit<DBEntry, 'id'> & { id: string }): Promise<DBEntry> {
  await db.transaction('rw', db.entries, db.phrasebooks, async () => {
    await db.entries.add(data);
    await db.phrasebooks.where('id').equals(data.phrasebookId).modify((pb) => {
      pb.entryCount = (pb.entryCount || 0) + 1;
      pb.updatedAt = new Date().toISOString();
    });
  });
  return data;
}

export async function getEntriesByPhrasebook(phrasebookId: string): Promise<DBEntry[]> {
  return db.entries
    .where('phrasebookId')
    .equals(phrasebookId)
    .reverse()
    .sortBy('createdAt');
}

export async function getEntry(id: string): Promise<DBEntry | undefined> {
  return db.entries.get(id);
}

export async function updateEntry(
  id: string,
  changes: Partial<Omit<DBEntry, 'id' | 'userId'>>,
): Promise<void> {
  await db.entries.update(id, { ...changes, updatedAt: new Date().toISOString() });
}

export async function deleteEntry(id: string): Promise<void> {
  await db.transaction('rw', db.entries, db.enrichments, db.phrasebooks, async () => {
    const entry = await db.entries.get(id);
    if (entry) {
      await db.enrichments.where('entryId').equals(id).delete();
      await db.entries.delete(id);
      await db.phrasebooks.where('id').equals(entry.phrasebookId).modify((pb) => {
        pb.entryCount = Math.max(0, (pb.entryCount || 1) - 1);
        pb.updatedAt = new Date().toISOString();
      });
    }
  });
}

export async function getTagSuggestions(userId: string): Promise<string[]> {
  const entries = await db.entries.where('userId').equals(userId).toArray();
  const tagSet = new Set<string>();
  for (const entry of entries) {
    for (const tag of entry.tags) tagSet.add(tag);
  }
  return [...tagSet].sort();
}

export async function renameTag(userId: string, oldTag: string, newTag: string): Promise<number> {
  const entries = await db.entries
    .where('tags')
    .equals(oldTag)
    .filter((e) => e.userId === userId)
    .toArray();

  const now = new Date().toISOString();
  await Promise.all(
    entries.map((entry) => {
      const tags = [...new Set(entry.tags.map((t) => (t === oldTag ? newTag : t)))];
      return db.entries.update(entry.id, { tags, updatedAt: now });
    }),
  );

  return entries.length;
}

export async function deleteTag(userId: string, tagName: string): Promise<number> {
  const entries = await db.entries
    .where('tags')
    .equals(tagName)
    .filter((e) => e.userId === userId)
    .toArray();

  const now = new Date().toISOString();
  await Promise.all(
    entries.map((entry) => {
      const tags = entry.tags.filter((t) => t !== tagName);
      return db.entries.update(entry.id, { tags, updatedAt: now });
    }),
  );

  return entries.length;
}

// ─── Enrichment helpers (used by US5) ────────────────────────────────────────

export async function upsertEnrichment(enrichment: DBEnrichment): Promise<void> {
  await db.enrichments.put(enrichment);
}

export async function getEnrichment(entryId: string): Promise<DBEnrichment | undefined> {
  return db.enrichments.where('entryId').equals(entryId).first();
}

// ─── Review helpers ───────────────────────────────────────────────────────────

/** Returns entries within an inclusive learningScore range for a user. */
export async function getEntriesByScoreRange(
  userId: string,
  minScore: number,
  maxScore: number,
): Promise<DBEntry[]> {
  return db.entries
    .where('userId')
    .equals(userId)
    .filter((e) => e.learningScore >= minScore && e.learningScore <= maxScore)
    .toArray();
}

/** In-place Fisher-Yates shuffle. */
function shuffle<T>(arr: T[]): void {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}

/**
 * Given a pool of candidate entries, returns up to `size` entries ordered so
 * that entries NOT yet reviewed on `today` come first (fresh), and entries
 * already reviewed today are appended only when needed to reach `size`.
 *
 * Fresh entries are sorted deterministically:
 * 1. Never-reviewed (lastReviewedDate === null) always first.
 * 2. Oldest lastReviewedDate ascending (ISO YYYY-MM-DD string comparison is safe).
 * 3. For 'targeted' sessions: lowest learningScore ascending as a tiebreaker.
 *
 * Stale entries (reviewed today) are shuffled — they are backfill only.
 * Exported for unit-testing.
 */
export function prioritiseForSession(
  pool: DBEntry[],
  size: number,
  today: string,
  type: 'random' | 'targeted' = 'random',
): DBEntry[] {
  const fresh: DBEntry[] = [];
  const stale: DBEntry[] = [];
  for (const e of pool) {
    if (e.lastReviewedDate === today) {
      stale.push(e);
    } else {
      fresh.push(e);
    }
  }

  // Deterministic priority sort for the fresh bucket.
  fresh.sort((a, b) => {
    // 1. Never-reviewed entries always surface first.
    const aNull = a.lastReviewedDate === null;
    const bNull = b.lastReviewedDate === null;
    if (aNull !== bNull) return aNull ? -1 : 1;

    // 2. Both null or both have dates — sort by oldest-reviewed first.
    if (!aNull && !bNull) {
      const dateCmp = a.lastReviewedDate!.localeCompare(b.lastReviewedDate!);
      if (dateCmp !== 0) return dateCmp;
    }

    // 3. Targeted sessions: lowest learningScore as a tiebreaker.
    if (type === 'targeted') {
      return a.learningScore - b.learningScore;
    }

    return 0;
  });

  shuffle(stale);
  const needed = Math.max(0, size - fresh.length);
  return [...fresh.slice(0, size), ...stale.slice(0, needed)];
}

/** Loads candidate entries for a review session.
 *  - 'random': full entry pool, returned shuffled, up to `size`
 *  - 'targeted': prioritise low-score entries (score < 80), falling back to all
 * Entries not yet reviewed today are always presented before those already
 * reviewed today; stale entries are included only when needed to reach `size`.
 */
export async function getEntriesForSession(
  userId: string,
  type: 'random' | 'targeted',
  size: number,
  phrasebookId?: string,
): Promise<DBEntry[]> {
  const all = await db.entries.where('userId').equals(userId).toArray();
  const pool0 = phrasebookId ? all.filter((e) => e.phrasebookId === phrasebookId) : all;
  if (pool0.length === 0) return [];

  let pool: DBEntry[];
  if (type === 'targeted') {
    const weak = pool0.filter((e) => e.learningScore < 80);
    pool = weak.length > 0 ? weak : pool0;
  } else {
    pool = pool0;
  }

  return prioritiseForSession(pool, size, todayKey(), type);
}

// ─── Rehearse session helpers ─────────────────────────────────────────────────

/**
 * Pure function: applies PoS/tag filters, sorts or shuffles, and truncates to `size`.
 * Exported for unit testing without requiring IndexedDB.
 */
export function filterAndSelectEntries(
  pool: DBEntry[],
  type: 'random' | 'targeted',
  size: number,
  posFilter: PartOfSpeech[],
  tagFilter: string[],
): DBEntry[] {
  let filtered = [...pool];
  if (posFilter.length > 0) {
    filtered = filtered.filter((e) => e.partOfSpeech !== undefined && posFilter.includes(e.partOfSpeech));
  }
  if (tagFilter.length > 0) {
    filtered = filtered.filter((e) => e.tags.some((t) => tagFilter.includes(t)));
  }
  if (filtered.length === 0) return [];
  if (type === 'targeted') {
    filtered.sort((a, b) => a.learningScore - b.learningScore);
  } else {
    shuffle(filtered);
  }
  return filtered.slice(0, size);
}

/**
 * Pure function: extracts deduplicated, alphabetically sorted tags from an entry pool.
 * Exported for unit testing without requiring IndexedDB.
 */
export function collectTags(entries: DBEntry[]): string[] {
  const tagSet = new Set<string>();
  for (const entry of entries) {
    for (const tag of entry.tags) {
      tagSet.add(tag);
    }
  }
  return Array.from(tagSet).sort();
}

/**
 * Loads candidate entries for a rehearse session (read-only — no score writes).
 * - Applies PoS filter when `posFilter` is non-empty (entry.partOfSpeech must be in list).
 * - Applies tag filter when `tagFilter` is non-empty (entry must have at least one matching tag — OR semantics).
 * - Both filters active: AND semantics (both must pass).
 * - 'targeted': sort ascending by learningScore, return first `size`.
 * - 'random': Fisher-Yates shuffle, return first `size`.
 * - Returns entire filtered pool when pool size < `size`.
 */
export async function getEntriesForRehearsal(
  userId: string,
  type: 'random' | 'targeted',
  size: number,
  phrasebookId: string,
  posFilter: PartOfSpeech[],
  tagFilter: string[],
): Promise<DBEntry[]> {
  const all = await db.entries.where('phrasebookId').equals(phrasebookId).filter((e) => e.userId === userId).toArray();
  return filterAndSelectEntries(all, type, size, posFilter, tagFilter);
}

/**
 * Returns a deduplicated, alphabetically sorted list of all tags used by
 * entries in the given phrasebook. Returns `[]` when no entries have tags.
 */
export async function getAvailableTagsForPhrasebook(
  userId: string,
  phrasebookId: string,
): Promise<string[]> {
  const entries = await db.entries.where('phrasebookId').equals(phrasebookId).filter((e) => e.userId === userId).toArray();
  return collectTags(entries);
}

// ─── Account deletion ────────────────────────────────────────────────

export async function clearLocalData(): Promise<void> {
  await Dexie.delete('wordsprout');
}

// ─── Data portability (export / import) ──────────────────────────────────────

/**
 * Clears all user-owned content from IndexedDB and flushes the pending-sync
 * queue. Used as the first step of an import restore, immediately after the
 * server confirms a successful import and returns the canonical dataset.
 *
 * Runs in a single read-write transaction for atomicity.
 */
export async function clearUserContent(userId: string): Promise<void> {
  await db.transaction('rw', [db.phrasebooks, db.entries, db.enrichments, db.pendingSync], async () => {
    await db.phrasebooks.where('userId').equals(userId).delete();
    await db.entries.where('userId').equals(userId).delete();
    await db.enrichments.where('userId').equals(userId).delete();
    await db.pendingSync.clear();
  });
}

/**
 * Bulk-writes the canonical server dataset returned by POST /data/import into
 * IndexedDB. Uses bulkPut so that records are inserted or replaced idempotently.
 *
 * Runs in a single read-write transaction for atomicity.
 */
export async function bulkRestoreFromExport(
  phrasebooks: DBPhrasebook[],
  entries: DBEntry[],
  enrichments: DBEnrichment[],
): Promise<void> {
  await db.transaction('rw', [db.phrasebooks, db.entries, db.enrichments], async () => {
    await db.phrasebooks.bulkPut(phrasebooks);
    await db.entries.bulkPut(entries);
    await db.enrichments.bulkPut(enrichments);
  });
}
