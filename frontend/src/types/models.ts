// Client-side type definitions — mirrors api/src/models/types.ts
// Keep in sync manually until a shared package is justified.

export type PartOfSpeech =
  | 'noun'
  | 'verb'
  | 'adjective'
  | 'adverb'
  | 'idiom'
  | 'phrasal_verb'
  | 'other';

export type SyncStatus = 'pending' | 'syncing' | 'synced' | 'failed';

export type MutationMethod = 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export interface Language {
  code: string;
  name: string;
}

export interface UserQuota {
  aiQuotaUsedToday: number;
  aiQuotaLimit: number;
  aiQuotaResetAt: string;
}

export interface ApiError {
  error: string;
  message: string;
  statusCode: number;
}
