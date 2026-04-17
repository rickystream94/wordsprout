import Dexie, { type Table } from 'dexie';
import type {
  MutationMethod,
  PartOfSpeech,
  SyncStatus,
} from '../types/models';

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
  generatedAt: string;
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

class VocaBookDB extends Dexie {
  phrasebooks!: Table<DBPhrasebook, string>;
  entries!: Table<DBEntry, string>;
  enrichments!: Table<DBEnrichment, string>;
  pendingSync!: Table<DBPendingMutation, number>;
  meta!: Table<DBMeta, string>;

  constructor() {
    super('vocabook');

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

export const db = new VocaBookDB();

// ─── T022: Phrasebook CRUD ────────────────────────────────────────────────────

export async function createPhrasebook(data: Omit<DBPhrasebook, 'id'> & { id: string }): Promise<DBPhrasebook> {
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

/** Loads candidate entries for a review session.
 *  - 'random': full entry pool, returned shuffled, up to `size`
 *  - 'targeted': prioritise low-score entries (score < 80), falling back to all
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

  // Fisher-Yates shuffle
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, size);
}
