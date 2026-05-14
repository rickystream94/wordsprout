import { randomUUID } from 'node:crypto';
import type { PartOfSpeech } from '../../api/src/models/types.js';

// ─── Types matching the Cosmos document shapes ─────────────────────────────────

export interface SeedPhrasebook {
  id: string;
  userId: string;
  type: 'phrasebook';
  name: string;
  sourceLanguageCode: string;
  sourceLanguageName: string;
  targetLanguageCode: string;
  targetLanguageName: string;
  entryCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface SeedEntry {
  id: string;
  userId: string;
  type: 'entry';
  phrasebookId: string;
  sourceText: string;
  targetText?: string;
  notes?: string;
  tags: string[];
  partOfSpeech?: PartOfSpeech;
  learningScore: number;
  lastReviewedDate: string | null;
  enrichmentId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface SeedEnrichment {
  id: string;
  userId: string;
  type: 'enrichment';
  entryId: string;
  exampleSentences: string[];
  synonyms: string[];
  antonyms: string[];
  register?: string;
  collocations: string[];
  falseFriendWarning?: string;
  generatedAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface SeedUser {
  id: string;
  userId: string;
  type: 'user';
  email: string;
  aiQuotaUsedToday: number;
  aiQuotaResetAt: string;
  aiDailyEnrichmentLimit: number;
  createdAt: string;
  updatedAt: string;
}

// ─── Raw vocabulary input shape ────────────────────────────────────────────────

export interface RawEntry {
  sourceText: string;
  targetText: string;
  notes?: string;
  tags?: string[];
  partOfSpeech?: PartOfSpeech;
}

export interface RawEnrichment {
  /** Index into the vocabulary array for the parent phrasebook */
  entryIndex: number;
  exampleSentences: string[];
  synonyms: string[];
  antonyms: string[];
  register?: string;
  collocations: string[];
  falseFriendWarning?: string;
}

export interface PhrasebookDefinition {
  name: string;
  sourceLanguageCode: string;
  sourceLanguageName: string;
  targetLanguageCode: string;
  targetLanguageName: string;
  entries: RawEntry[];
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

/** Returns a random integer in [min, max] inclusive. */
function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/** ISO timestamp shifted back by a random number of days (1–90). */
function pastTimestamp(maxDaysAgo = 90): string {
  const ms = Date.now() - randInt(1, maxDaysAgo) * 86_400_000;
  return new Date(ms).toISOString();
}

/** YYYY-MM-DD date shifted back by a random number of days (0–30). */
function recentDate(maxDaysAgo = 30): string {
  const d = new Date(Date.now() - randInt(0, maxDaysAgo) * 86_400_000);
  return d.toISOString().slice(0, 10);
}

/**
 * Generate a learning score with a realistic distribution:
 *   ~20% Dormant (0–19), ~25% Sprouting (20–39),
 *   ~25% Echoing (40–59), ~20% Inscribed (60–79), ~10% Engraved (80–100)
 */
function randomLearningScore(): number {
  const r = Math.random();
  if (r < 0.20) return randInt(0, 19);
  if (r < 0.45) return randInt(20, 39);
  if (r < 0.70) return randInt(40, 59);
  if (r < 0.90) return randInt(60, 79);
  return randInt(80, 100);
}

// ─── Document generators ───────────────────────────────────────────────────────

export function generateUser(userId: string): SeedUser {
  const now = new Date().toISOString();
  const tomorrow = new Date(Date.now() + 86_400_000).toISOString();
  return {
    id: `user:${userId}`,
    userId,
    type: 'user',
    email: 'local-dev@wordsprout.test',
    aiQuotaUsedToday: 0,
    aiQuotaResetAt: tomorrow,
    aiDailyEnrichmentLimit: 20,
    createdAt: now,
    updatedAt: now,
  };
}

export function generatePhrasebook(
  userId: string,
  def: PhrasebookDefinition,
): SeedPhrasebook {
  const created = pastTimestamp(60);
  return {
    id: randomUUID(),
    userId,
    type: 'phrasebook',
    name: def.name,
    sourceLanguageCode: def.sourceLanguageCode,
    sourceLanguageName: def.sourceLanguageName,
    targetLanguageCode: def.targetLanguageCode,
    targetLanguageName: def.targetLanguageName,
    entryCount: def.entries.length,
    createdAt: created,
    updatedAt: created,
  };
}

export function generateEntry(
  userId: string,
  phrasebookId: string,
  raw: RawEntry,
): SeedEntry {
  const score = randomLearningScore();
  const created = pastTimestamp();
  return {
    id: randomUUID(),
    userId,
    type: 'entry',
    phrasebookId,
    sourceText: raw.sourceText,
    targetText: raw.targetText,
    notes: raw.notes,
    tags: raw.tags ?? [],
    partOfSpeech: raw.partOfSpeech,
    learningScore: score,
    lastReviewedDate: score > 0 ? recentDate() : null,
    createdAt: created,
    updatedAt: created,
  };
}

export function generateEnrichment(
  userId: string,
  entryId: string,
  raw: RawEnrichment,
): SeedEnrichment {
  const created = pastTimestamp(30);
  return {
    id: randomUUID(),
    userId,
    type: 'enrichment',
    entryId,
    exampleSentences: raw.exampleSentences,
    synonyms: raw.synonyms,
    antonyms: raw.antonyms,
    register: raw.register,
    collocations: raw.collocations,
    falseFriendWarning: raw.falseFriendWarning,
    generatedAt: created,
    createdAt: created,
    updatedAt: created,
  };
}
