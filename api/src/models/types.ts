// ─── Enumerations ──────────────────────────────────────────────────────────────

export type AppEnv = 'local' | 'dev' | 'prod';

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

// ─── Cosmos DB document base ───────────────────────────────────────────────────

export interface CosmosDocument {
  id: string;
  userId: string;
  type: string;
  createdAt: string; // ISO 8601
  updatedAt: string; // ISO 8601
}

// ─── Domain entities ───────────────────────────────────────────────────────────

export interface User extends CosmosDocument {
  type: 'user';
  email: string;
  aiQuotaUsedToday: number;
  aiQuotaResetAt: string; // ISO 8601 — UTC midnight when quota resets
  aiDailyEnrichmentLimit: number;
  lastImportAt?: string;  // ISO 8601 — timestamp of last successful import (rate-limit gate)
}

export interface AllowList extends CosmosDocument {
  type: 'allowlist';
  userId: string;    // partition key === userId for point-read
  email: string;
  allowedAt: string; // ISO 8601
}

export interface Phrasebook extends CosmosDocument {
  type: 'phrasebook';
  name: string;
  sourceLanguageCode: string;  // ISO 639-1
  sourceLanguageName: string;
  targetLanguageCode: string;  // ISO 639-1
  targetLanguageName: string;
  entryCount: number;
  fromTemplate?: boolean;
}

export interface VocabularyEntry extends CosmosDocument {
  type: 'entry';
  phrasebookId: string;
  sourceText: string;
  targetText?: string;
  notes?: string;
  tags: string[];
  partOfSpeech?: PartOfSpeech;
  learningScore: number;          // integer 0–100
  lastReviewedDate: string | null; // 'YYYY-MM-DD' local date, null = never reviewed
  enrichmentId?: string;
}

export interface AIEnrichment extends CosmosDocument {
  type: 'enrichment';
  entryId: string;
  exampleSentences: string[];
  synonyms: string[];
  antonyms: string[];
  register?: string;          // e.g. "formal", "informal", "colloquial"
  collocations: string[];
  falseFriendWarning?: string;
  generatedAt?: string;       // ISO 8601 — absent when created from manual edits only
  editedAt?: string;          // ISO 8601 — set when user edits any field
}

export interface AccessRequest extends CosmosDocument {
  type: 'access_request';
  userId: '_access_requests'; // fixed partition key for all access requests
  email: string;
  sub?: string;               // pairwise subject identifier from JWT (stored when user is signed in)
  requestedAt: string;        // ISO 8601
  status: 'pending' | 'approved' | 'rejected';
}

export interface RateLimitEntry extends CosmosDocument {
  type: 'ratelimit';
  userId: '_ratelimits';  // synthetic partition key — groups all rate-limit docs
  windowStart: string;   // ISO 8601 — start of the current rate-limit window
  count: number;         // number of requests in this window
  ttl: number;           // Cosmos TTL in seconds; document auto-deletes when it expires
}

export type AuthProvider = 'microsoft' | 'google';

export interface SessionDocument extends CosmosDocument {
  type: 'session';
  tokenHash: string;       // SHA-256 hex digest of the raw refresh token
  provider: AuthProvider;  // OIDC provider used to create the session
  email: string;
  expiresAt: string;       // ISO 8601 — when the refresh token expires
  ttl: number;             // Cosmos TTL in seconds; document auto-deletes on expiry
}

// ─── API request / response shapes ────────────────────────────────────────────

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

export interface DecodedToken {
  sub: string;               // Entra ID pairwise subject ID → used as userId
  email?: string;
  preferred_username?: string;
  iat: number;
  exp: number;
}

// ─── Pending sync operation (IndexedDB only) ──────────────────────────────────

export type MutationMethod = 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export interface PendingMutation {
  id?: number;           // Dexie auto-increment
  url: string;
  method: MutationMethod;
  body?: string;         // JSON-serialised request body
  retryCount: number;
  status: SyncStatus;
  createdAt: string;
  lastAttemptAt?: string;
  errorMessage?: string;
}

// ─── Data portability (export / import) ──────────────────────────────────────

export interface ExportPhrasebook {
  // Mandatory
  id:                 string;
  name:               string;
  sourceLanguageCode: string;
  targetLanguageCode: string;
  createdAt:          string;
  updatedAt:          string;
  // Optional
  sourceLanguageName?: string;
  targetLanguageName?: string;
  entryCount?:         number;
  fromTemplate?:       boolean;
}

export interface ExportEntry {
  // Mandatory
  id:           string;
  phrasebookId: string;
  sourceText:   string;
  createdAt:    string;
  updatedAt:    string;
  // Optional
  targetText?:       string;
  notes?:            string;
  tags:              string[];
  partOfSpeech?:     PartOfSpeech;
  learningScore?:    number;
  lastReviewedDate?: string | null;
  enrichmentId?:     string;
}

export interface ExportEnrichment {
  // Mandatory
  id:        string;
  entryId:   string;
  createdAt: string;
  updatedAt: string;
  // Optional (all enrichment content fields)
  exampleSentences?:  string[];
  synonyms?:          string[];
  antonyms?:          string[];
  collocations?:      string[];
  register?:          string;
  falseFriendWarning?: string;
  generatedAt?:       string;
  editedAt?:          string;
}

export interface ExportData {
  phrasebooks:  ExportPhrasebook[];
  entries:      ExportEntry[];
  enrichments:  ExportEnrichment[];
}

export interface ExportPackage {
  schemaVersion: 1;
  app:           'wordsprout';
  exportedAt:    string;
  data:          ExportData;
}

export interface ImportResult {
  phrasebooksImported:  number;
  entriesImported:      number;
  enrichmentsImported:  number;
  phrasebooks:          Phrasebook[];
  entries:              VocabularyEntry[];
  enrichments:          AIEnrichment[];
}
