// ─── Enumerations ──────────────────────────────────────────────────────────────

export type AppEnv = 'local' | 'dev' | 'prod';

export type LearningState = 'new' | 'learning' | 'mastered';

export type PartOfSpeech =
  | 'noun'
  | 'verb'
  | 'adjective'
  | 'adverb'
  | 'idiom'
  | 'phrasal_verb'
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
  aiQuotaLimit: number;
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
}

export interface VocabularyEntry extends CosmosDocument {
  type: 'entry';
  phrasebookId: string;
  sourceText: string;
  targetText?: string;
  notes?: string;
  tags: string[];
  partOfSpeech?: PartOfSpeech;
  learningState: LearningState;
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
  generatedAt: string;        // ISO 8601
  editedAt?: string;          // ISO 8601 — set when user edits any field
}

export interface AccessRequest extends CosmosDocument {
  type: 'access_request';
  userId: '_access_requests'; // fixed partition key for all access requests
  email: string;
  requestedAt: string;        // ISO 8601
  status: 'pending' | 'approved' | 'rejected';
}

// ─── API request / response shapes ────────────────────────────────────────────

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

export interface DecodedToken {
  sub: string;          // Azure AD B2C object ID → used as userId
  email?: string;
  emails?: string[];    // B2C claims use "emails" (array)
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
