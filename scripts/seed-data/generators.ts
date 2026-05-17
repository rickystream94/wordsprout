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
  decayBaseScore: number | null;
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

/**
 * Named decay scenarios for showcase entries. When set on a RawEntry, the
 * generateEntry function produces deterministic dates/scores that guarantee a
 * specific DecayBadge state regardless of when the seed runs.
 *
 * Scenario mapping (using Engraved tier, grace = 21 days, rate = 3 days/pt):
 *
 *  none          – never reviewed (decayBaseScore null, lastReviewedDate null)
 *  fresh         – reviewed 3 days ago → 18 days left in grace (green ✓)
 *  graceWarning  – reviewed 17 days ago → 4 days left (< 25% of 21) → amber
 *  decayLow      – reviewed 28 days ago → 7 days past grace → −2 pts (~2.5%) → amber
 *  decayMedium   – reviewed 46 days ago → 25 days past grace → −8 pts (10%) → medium
 *                  (note: uses base 50/Echoing, grace=7; 26 days past → −8 = 20%)
 *  decayHigh     – reviewed 80 days ago → 59 days past grace → −19 pts (24%)
 *                  (uses base 50/Echoing, grace=7; 73 days past → −24 = 48%)
 */
export type DecayScenario =
  | 'none'
  | 'fresh'
  | 'graceWarning'
  | 'decayLow'
  | 'decayMedium'
  | 'decayHigh';

export interface RawEntry {
  sourceText: string;
  targetText: string;
  notes?: string;
  tags?: string[];
  partOfSpeech?: PartOfSpeech;
  /** When set, overrides random score/dates with a deterministic decay scenario. */
  decayScenario?: DecayScenario;
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

/** YYYY-MM-DD date exactly N days before today. */
function exactDaysAgo(n: number): string {
  const d = new Date(Date.now() - n * 86_400_000);
  return d.toISOString().slice(0, 10);
}

/** Resolve a named decay scenario into explicit score/date fields. */
function resolveScenario(scenario: DecayScenario): {
  learningScore: number;
  decayBaseScore: number | null;
  lastReviewedDate: string | null;
} {
  switch (scenario) {
    case 'none':
      // Never reviewed — no badge
      return { learningScore: 0, decayBaseScore: null, lastReviewedDate: null };

    case 'fresh':
      // Engraved (base=85, grace=21d). Reviewed 3 days ago → 18d left → green ✓
      return { learningScore: 85, decayBaseScore: 85, lastReviewedDate: exactDaysAgo(3) };

    case 'graceWarning':
      // Engraved (base=85, grace=21d). Reviewed 17 days ago → 4d left → amber warning
      // 4 ≤ ceil(21 * 0.25) = 6 → graceWarning
      return { learningScore: 85, decayBaseScore: 85, lastReviewedDate: exactDaysAgo(17) };

    case 'decayLow':
      // Engraved (base=80, grace=21d, rate=3). 30 days ago → 9d past grace → −3pts
      // pointsLost=3, 3/80=3.75% < 15% → low (amber)
      return { learningScore: 77, decayBaseScore: 80, lastReviewedDate: exactDaysAgo(30) };

    case 'decayMedium':
      // Echoing (base=50, grace=7d, rate=3). 34 days ago → 27d past grace → −9pts
      // pointsLost=9, 9/50=18% → medium (orange)
      return { learningScore: 41, decayBaseScore: 50, lastReviewedDate: exactDaysAgo(34) };

    case 'decayHigh':
      // Echoing (base=50, grace=7d, rate=3). 80 days ago → 73d past grace → −24pts
      // pointsLost=24, 24/50=48% > 35% → high (red)
      return { learningScore: 26, decayBaseScore: 50, lastReviewedDate: exactDaysAgo(80) };
  }
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
    id: userId,
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
  const created = pastTimestamp();

  // If a named scenario is provided, use deterministic values instead of random
  if (raw.decayScenario) {
    const { learningScore, decayBaseScore, lastReviewedDate } = resolveScenario(raw.decayScenario);
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
      learningScore,
      lastReviewedDate,
      decayBaseScore,
      createdAt: created,
      updatedAt: created,
    };
  }

  const score = randomLearningScore();
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
    decayBaseScore: score > 0 ? score : null,
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
