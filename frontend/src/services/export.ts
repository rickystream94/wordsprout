import type { PartOfSpeech } from '../types/models';
import {
  db,
  type DBPhrasebook,
  type DBEntry,
  type DBEnrichment,
} from './db';

// ─── Export package types (mirrors api/src/models/types.ts) ──────────────────

export interface ExportPhrasebook {
  id: string;
  name: string;
  sourceLanguageCode: string;
  targetLanguageCode: string;
  createdAt: string;
  updatedAt: string;
  sourceLanguageName?: string;
  targetLanguageName?: string;
  entryCount?: number;
  fromTemplate?: boolean;
}

export interface ExportEntry {
  id: string;
  phrasebookId: string;
  sourceText: string;
  createdAt: string;
  updatedAt: string;
  targetText?: string;
  notes?: string;
  tags: string[];
  partOfSpeech?: PartOfSpeech;
  learningScore?: number;
  lastReviewedDate?: string | null;
  enrichmentId?: string;
}

export interface ExportEnrichment {
  id: string;
  entryId: string;
  createdAt: string;
  updatedAt: string;
  exampleSentences?: string[];
  synonyms?: string[];
  antonyms?: string[];
  collocations?: string[];
  register?: string;
  falseFriendWarning?: string;
  generatedAt?: string;
  editedAt?: string;
}

export interface ExportData {
  phrasebooks: ExportPhrasebook[];
  entries: ExportEntry[];
  enrichments: ExportEnrichment[];
}

export interface ExportPackage {
  schemaVersion: 1;
  app: 'wordsprout';
  exportedAt: string;
  data: ExportData;
}

// ─── Client validation result ─────────────────────────────────────────────────

export type ValidatedImportFile =
  | { valid: true; pkg: ExportPackage; summary: { phrasebooks: number; entries: number } }
  | { valid: false; error: string };

// ─── generateExportPackage ────────────────────────────────────────────────────

function toExportPhrasebook(pb: DBPhrasebook): ExportPhrasebook {
  const out: ExportPhrasebook = {
    id: pb.id,
    name: pb.name,
    sourceLanguageCode: pb.sourceLanguageCode,
    targetLanguageCode: pb.targetLanguageCode,
    createdAt: pb.createdAt,
    updatedAt: pb.updatedAt,
  };
  if (pb.sourceLanguageName !== undefined) out.sourceLanguageName = pb.sourceLanguageName;
  if (pb.targetLanguageName !== undefined) out.targetLanguageName = pb.targetLanguageName;
  if (pb.entryCount !== undefined) out.entryCount = pb.entryCount;
  if (pb.fromTemplate !== undefined) out.fromTemplate = pb.fromTemplate;
  return out;
}

function toExportEntry(entry: DBEntry): ExportEntry {
  const out: ExportEntry = {
    id: entry.id,
    phrasebookId: entry.phrasebookId,
    sourceText: entry.sourceText,
    createdAt: entry.createdAt,
    updatedAt: entry.updatedAt,
    tags: entry.tags ?? [],
    learningScore: entry.learningScore,
    lastReviewedDate: entry.lastReviewedDate,
  };
  if (entry.targetText !== undefined) out.targetText = entry.targetText;
  if (entry.notes !== undefined) out.notes = entry.notes;
  if (entry.partOfSpeech !== undefined) out.partOfSpeech = entry.partOfSpeech;
  if (entry.enrichmentId !== undefined) out.enrichmentId = entry.enrichmentId;
  return out;
}

function toExportEnrichment(enr: DBEnrichment): ExportEnrichment {
  const out: ExportEnrichment = {
    id: enr.id,
    entryId: enr.entryId,
    // DBEnrichment doesn't carry createdAt/updatedAt — use a fallback
    createdAt: (enr as DBEnrichment & { createdAt?: string }).createdAt ?? new Date().toISOString(),
    updatedAt: (enr as DBEnrichment & { updatedAt?: string }).updatedAt ?? new Date().toISOString(),
  };
  if (enr.exampleSentences?.length) out.exampleSentences = enr.exampleSentences;
  if (enr.synonyms?.length) out.synonyms = enr.synonyms;
  if (enr.antonyms?.length) out.antonyms = enr.antonyms;
  if (enr.collocations?.length) out.collocations = enr.collocations;
  if (enr.register !== undefined) out.register = enr.register;
  if (enr.falseFriendWarning !== undefined) out.falseFriendWarning = enr.falseFriendWarning;
  if (enr.generatedAt !== undefined) out.generatedAt = enr.generatedAt;
  if (enr.editedAt !== undefined) out.editedAt = enr.editedAt;
  return out;
}

export async function generateExportPackage(userId: string): Promise<ExportPackage> {
  const [rawPhrasebooks, rawEntries, rawEnrichments] = await Promise.all([
    db.phrasebooks.where('userId').equals(userId).toArray(),
    db.entries.where('userId').equals(userId).toArray(),
    db.enrichments.where('userId').equals(userId).toArray(),
  ]);

  // Build ID sets so orphaned records (e.g. entries whose phrasebook was deleted
  // mid-transaction) are silently excluded — keeping the package internally consistent.
  const phrasebookIds = new Set(rawPhrasebooks.map((pb) => pb.id));
  const filteredEntries = rawEntries.filter((e) => phrasebookIds.has(e.phrasebookId));
  const entryIds = new Set(filteredEntries.map((e) => e.id));
  const filteredEnrichments = rawEnrichments.filter((e) => entryIds.has(e.entryId));

  return {
    schemaVersion: 1,
    app: 'wordsprout',
    exportedAt: new Date().toISOString(),
    data: {
      phrasebooks: rawPhrasebooks.map(toExportPhrasebook),
      entries: filteredEntries.map(toExportEntry),
      enrichments: filteredEnrichments.map(toExportEnrichment),
    },
  };
}

// ─── triggerDownload ──────────────────────────────────────────────────────────

export function triggerDownload(pkg: ExportPackage): void {
  const json = JSON.stringify(pkg, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  // Use en-CA locale to reliably produce ISO YYYY-MM-DD regardless of device locale
  const datePart = new Date().toLocaleDateString('en-CA');
  const filename = `wordsprout-backup-${datePart}.json`;

  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  // Append/click/remove: required for Safari iOS which will not fire click on detached anchors
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(a.href);
}

// ─── validateImportFile ───────────────────────────────────────────────────────

export async function validateImportFile(file: File): Promise<ValidatedImportFile> {
  // 1. Extension / MIME check
  const isJsonExtension = file.name.toLowerCase().endsWith('.json');
  const isJsonMime = file.type === 'application/json' || file.type === 'text/plain' || file.type === '';
  if (!isJsonExtension && !isJsonMime) {
    return { valid: false, error: 'Only JSON files are accepted.' };
  }

  // 2. Size check (10 MB)
  if (file.size > 10 * 1024 * 1024) {
    return { valid: false, error: 'File is too large (maximum 10 MB).' };
  }

  // 3. JSON parse
  let parsed: unknown;
  try {
    parsed = JSON.parse(await file.text());
  } catch {
    return { valid: false, error: 'File is not valid JSON.' };
  }

  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    return { valid: false, error: 'File does not appear to be a WordSprout backup.' };
  }

  const obj = parsed as Record<string, unknown>;

  // 4. Top-level keys
  if (!('schemaVersion' in obj) || !('app' in obj) || !('exportedAt' in obj) || !('data' in obj)) {
    return { valid: false, error: 'File does not appear to be a WordSprout backup.' };
  }

  // 5. Schema version
  if (obj['schemaVersion'] !== 1) {
    return {
      valid: false,
      error: 'This backup was created with a newer version of WordSprout. Please update the app and try again.',
    };
  }

  // 6. App identifier
  if (obj['app'] !== 'wordsprout') {
    return { valid: false, error: 'File does not appear to be a WordSprout backup.' };
  }

  // 7. Data arrays
  const data = obj['data'] as Record<string, unknown> | null | undefined;
  if (!data || !Array.isArray(data['phrasebooks']) || !Array.isArray(data['entries'])) {
    return { valid: false, error: 'Backup file has an unexpected structure.' };
  }

  const pkg = parsed as ExportPackage;
  return {
    valid: true,
    pkg,
    summary: {
      phrasebooks: pkg.data.phrasebooks.length,
      entries: pkg.data.entries.length,
    },
  };
}
