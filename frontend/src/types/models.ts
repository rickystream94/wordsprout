// Client-side type definitions — mirrors api/src/models/types.ts
// Keep in sync manually until a shared package is justified.

export type PartOfSpeech =
  | 'noun'
  | 'verb'
  | 'adjective'
  | 'adverb'
  | 'pronoun'
  | 'preposition'
  | 'conjunction'
  | 'article'
  | 'interjection'
  | 'numeral'
  | 'idiom'
  | 'phrasal_verb'
  | 'expression'
  | 'other';

export type SyncStatus = 'pending' | 'syncing' | 'synced' | 'failed';

export type MutationMethod = 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export interface Language {
  code: string;
  name: string;
}

export interface UserQuota {
  aiQuotaUsedToday: number;
  aiDailyEnrichmentLimit: number;
  aiQuotaResetAt: string;
}

export interface ApiError {
  error: string;
  message: string;
  statusCode: number;
}
