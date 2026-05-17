import { vi, describe, it, expect, beforeEach } from 'vitest';
import type { DBPhrasebook, DBEntry, DBEnrichment } from '../db';

// ─── Mock Dexie db ─────────────────────────────────────────────────────────────

const { mockPhrasebooks, mockEntries, mockEnrichments } = vi.hoisted(() => ({
  mockPhrasebooks: { where: vi.fn() },
  mockEntries: { where: vi.fn() },
  mockEnrichments: { where: vi.fn() },
}));

vi.mock('../db', () => ({
  db: {
    phrasebooks: mockPhrasebooks,
    entries: mockEntries,
    enrichments: mockEnrichments,
  },
}));

import { generateExportPackage, validateImportFile, type ExportPackage } from '../export';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const NOW = new Date().toISOString();

const PB: DBPhrasebook = {
  id: 'pb-1',
  userId: 'user-1',
  name: 'Test Book',
  sourceLanguageCode: 'it',
  sourceLanguageName: 'Italian',
  targetLanguageCode: 'en',
  targetLanguageName: 'English',
  entryCount: 1,
  createdAt: NOW,
  updatedAt: NOW,
};

const ENTRY: DBEntry = {
  id: 'entry-1',
  userId: 'user-1',
  phrasebookId: 'pb-1',
  sourceText: 'ciao',
  tags: [],
  learningScore: 0,
  lastReviewedDate: null,
  decayBaseScore: null,
  createdAt: NOW,
  updatedAt: NOW,
};

const ENRICHMENT: DBEnrichment = {
  id: 'enr-1',
  userId: 'user-1',
  entryId: 'entry-1',
  exampleSentences: ['Ciao!'],
  synonyms: ['salve'],
  antonyms: [],
  collocations: [],
  generatedAt: NOW,
};

function makeQuery(result: unknown[]) {
  return {
    equals: vi.fn().mockReturnValue({
      toArray: vi.fn().mockResolvedValue(result),
    }),
  };
}

function makeValidPackage(overrides: Partial<ExportPackage> = {}): ExportPackage {
  return {
    schemaVersion: 1,
    app: 'wordsprout',
    exportedAt: NOW,
    data: {
      phrasebooks: [{ id: 'pb-1', name: 'Test Book', sourceLanguageCode: 'it', targetLanguageCode: 'en', createdAt: NOW, updatedAt: NOW }],
      entries: [{ id: 'entry-1', phrasebookId: 'pb-1', sourceText: 'ciao', tags: [], learningScore: 0, lastReviewedDate: null, createdAt: NOW, updatedAt: NOW }],
      enrichments: [],
    },
    ...overrides,
  };
}

function makeFile(content: string, name = 'export.json', type = 'application/json'): File {
  return new File([content], name, { type });
}

// ─── generateExportPackage ────────────────────────────────────────────────────

describe('generateExportPackage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPhrasebooks.where.mockReturnValue(makeQuery([PB]).equals('user-1'));
    mockEntries.where.mockReturnValue(makeQuery([ENTRY]).equals('user-1'));
    mockEnrichments.where.mockReturnValue(makeQuery([ENRICHMENT]).equals('user-1'));
  });

  // Re-wire with proper equals chain
  beforeEach(() => {
    mockPhrasebooks.where.mockImplementation((field: string) => ({
      equals: vi.fn().mockReturnValue({
        toArray: vi.fn().mockResolvedValue(field === 'userId' ? [PB] : []),
      }),
    }));
    mockEntries.where.mockImplementation((field: string) => ({
      equals: vi.fn().mockReturnValue({
        toArray: vi.fn().mockResolvedValue(field === 'userId' ? [ENTRY] : []),
      }),
    }));
    mockEnrichments.where.mockImplementation((field: string) => ({
      equals: vi.fn().mockReturnValue({
        toArray: vi.fn().mockResolvedValue(field === 'userId' ? [ENRICHMENT] : []),
      }),
    }));
  });

  it('returns a package with schemaVersion=1 and app="wordsprout"', async () => {
    const pkg = await generateExportPackage('user-1');
    expect(pkg.schemaVersion).toBe(1);
    expect(pkg.app).toBe('wordsprout');
  });

  it('includes phrasebooks from db', async () => {
    const pkg = await generateExportPackage('user-1');
    expect(pkg.data.phrasebooks).toHaveLength(1);
    expect(pkg.data.phrasebooks[0].id).toBe('pb-1');
  });

  it('includes entries from db', async () => {
    const pkg = await generateExportPackage('user-1');
    expect(pkg.data.entries).toHaveLength(1);
    expect(pkg.data.entries[0].sourceText).toBe('ciao');
  });

  it('excludes orphaned entries whose phrasebook is not in the package', async () => {
    // Entry points to non-existent phrasebook
    const orphanEntry: DBEntry = { ...ENTRY, id: 'orphan-1', phrasebookId: 'nonexistent-pb' };
    mockEntries.where.mockImplementation(() => ({
      equals: vi.fn().mockReturnValue({
        toArray: vi.fn().mockResolvedValue([ENTRY, orphanEntry]),
      }),
    }));

    const pkg = await generateExportPackage('user-1');
    const ids = pkg.data.entries.map((e) => e.id);
    expect(ids).toContain('entry-1');
    expect(ids).not.toContain('orphan-1');
  });

  it('excludes enrichments for orphaned entries', async () => {
    const orphanEnr: DBEnrichment = { ...ENRICHMENT, id: 'enr-orphan', entryId: 'nonexistent-entry' };
    mockEnrichments.where.mockImplementation(() => ({
      equals: vi.fn().mockReturnValue({
        toArray: vi.fn().mockResolvedValue([ENRICHMENT, orphanEnr]),
      }),
    }));

    const pkg = await generateExportPackage('user-1');
    const ids = pkg.data.enrichments.map((e) => e.id);
    expect(ids).toContain('enr-1');
    expect(ids).not.toContain('enr-orphan');
  });

  it('includes an exportedAt timestamp', async () => {
    const pkg = await generateExportPackage('user-1');
    expect(pkg.exportedAt).toBeTruthy();
    expect(new Date(pkg.exportedAt).getTime()).toBeLessThanOrEqual(Date.now());
  });
});

// ─── validateImportFile ───────────────────────────────────────────────────────

describe('validateImportFile', () => {
  it('returns valid=true for a well-formed package', async () => {
    const pkg = makeValidPackage();
    const file = makeFile(JSON.stringify(pkg));
    const result = await validateImportFile(file);
    expect(result.valid).toBe(true);
  });

  it('returns valid=false when file is not valid JSON', async () => {
    const file = makeFile('not-json!');
    const result = await validateImportFile(file);
    expect(result.valid).toBe(false);
    expect((result as { valid: false; error: string }).error).toContain('JSON');
  });

  it('returns valid=false for non-JSON file extension with non-JSON MIME', async () => {
    const file = makeFile('{}', 'backup.csv', 'text/csv');
    const result = await validateImportFile(file);
    expect(result.valid).toBe(false);
  });

  it('returns valid=false when schemaVersion is not 1', async () => {
    const pkg = makeValidPackage({ schemaVersion: 2 as never });
    const file = makeFile(JSON.stringify(pkg));
    const result = await validateImportFile(file);
    expect(result.valid).toBe(false);
  });

  it('returns valid=false when app is not "wordsprout"', async () => {
    const pkg = makeValidPackage({ app: 'other' as never });
    const file = makeFile(JSON.stringify(pkg));
    const result = await validateImportFile(file);
    expect(result.valid).toBe(false);
  });

  it('returns valid=false when required top-level fields are missing', async () => {
    const file = makeFile(JSON.stringify({ app: 'wordsprout' }));
    const result = await validateImportFile(file);
    expect(result.valid).toBe(false);
  });

  it('returns a summary with counts on valid import', async () => {
    const pkg = makeValidPackage();
    const file = makeFile(JSON.stringify(pkg));
    const result = await validateImportFile(file);
    expect(result.valid).toBe(true);
    if (result.valid) {
      expect(result.summary.phrasebooks).toBe(1);
      expect(result.summary.entries).toBe(1);
    }
  });
});
