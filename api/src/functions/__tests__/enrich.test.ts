import { vi, describe, it, expect, beforeEach } from 'vitest';
import type { HttpRequest, InvocationContext } from '@azure/functions';
import type { Phrasebook, VocabularyEntry, User } from '../../models/types';

// ─── Hoist mocks ──────────────────────────────────────────────────────────────

const mockCosmos = vi.hoisted(() => ({
  pointRead: vi.fn(async () => null as unknown),
  upsert: vi.fn(async (doc: unknown) => doc),
  deleteItem: vi.fn(async () => undefined),
  queryByPartition: vi.fn(async () => [] as unknown[]),
  queryByPartitionPaginated: vi.fn(async () => ({ items: [], continuationToken: undefined })),
  deleteAllForPartition: vi.fn(async () => 0),
  queryById: vi.fn(async () => [] as unknown[]),
  queryByTagInPartition: vi.fn(async () => [] as unknown[]),
}));

const mockAuthorise = vi.hoisted(() => vi.fn(async () => ({
  sub: 'user-1',
  email: 'user@test.com',
  iss: 'wordsprout',
  iat: 0,
  exp: 9999999999,
})));

const mockGenerateEnrichment = vi.hoisted(() => vi.fn(async () => ({
  enrichment: {
    id: 'enrichment-entry-1',
    userId: 'user-1',
    type: 'enrichment' as const,
    entryId: 'entry-1',
    exampleSentences: ['Ciao!'],
    synonyms: ['salve'],
    antonyms: [],
    register: 'informal',
    collocations: [],
    falseFriendWarning: undefined,
    generatedAt: new Date().toISOString(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  translatedTargetText: undefined,
  partOfSpeech: 'interjection',
})));

type HandlerFn = (req: HttpRequest, ctx: InvocationContext) => Promise<unknown>;
const handlers = vi.hoisted(() => new Map<string, HandlerFn>());

vi.mock('@azure/functions', () => ({
  app: {
    http: vi.fn((name: string, opts: { handler: HandlerFn }) => {
      handlers.set(name, opts.handler);
    }),
  },
}));
vi.mock('../../services/cosmos', () => ({ cosmosClient: mockCosmos }));
vi.mock('../../middleware/authorise', () => ({ authorise: mockAuthorise }));
vi.mock('../../services/ai', () => ({ generateEnrichment: mockGenerateEnrichment }));
vi.mock('isomorphic-dompurify', () => ({
  default: { sanitize: (v: unknown) => (typeof v === 'string' ? v : '') },
}));
vi.mock('../../config/env', () => ({ AI_DAILY_ENRICHMENT_LIMIT: 20 }));
vi.mock('../../utils/http', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../utils/http')>();
  return { ...actual };
});

await import('../enrich');

// ─── Helpers ──────────────────────────────────────────────────────────────────

const MOCK_ENTRY: VocabularyEntry = {
  id: 'entry-1',
  userId: 'user-1',
  type: 'entry',
  phrasebookId: 'pb-1',
  sourceText: 'ciao',
  targetText: 'hello',
  tags: [],
  learningScore: 0,
  lastReviewedDate: null,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

const MOCK_PHRASEBOOK: Phrasebook = {
  id: 'pb-1',
  userId: 'user-1',
  type: 'phrasebook',
  name: 'Test Book',
  sourceLanguage: 'it',
  targetLanguage: 'en',
  sourceLanguageName: 'Italian',
  targetLanguageName: 'English',
  entryCount: 1,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

const MOCK_USER: User = {
  id: 'user-1',
  userId: 'user-1',
  type: 'user',
  email: 'user@test.com',
  aiQuotaUsedToday: 0,
  aiQuotaResetAt: new Date(Date.now() + 86400000).toISOString(),
  aiDailyEnrichmentLimit: 20,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

function mockRequest(params: Record<string, string> = {}): HttpRequest {
  return {
    json: vi.fn().mockResolvedValue({}),
    headers: { get: () => 'Bearer test-token' },
    params,
    method: 'POST',
    url: 'http://localhost/api/entries/entry-1/enrich',
  } as unknown as HttpRequest;
}

const mockCtx = { log: vi.fn(), error: vi.fn(), warn: vi.fn() } as unknown as InvocationContext;

// ─── Tests ─────────────────────────────────────────────────────────────────────

describe('enrichEntry', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthorise.mockResolvedValue({
      sub: 'user-1',
      email: 'user@test.com',
      iss: 'wordsprout',
      iat: 0,
      exp: 9999999999,
    });
    mockCosmos.pointRead.mockReset();
    mockCosmos.pointRead
      .mockResolvedValueOnce(MOCK_ENTRY)
      .mockResolvedValueOnce(MOCK_PHRASEBOOK)
      .mockResolvedValueOnce(MOCK_USER);
  });

  it('returns 400 when entryId param is missing', async () => {
    const handler = handlers.get('enrichEntry')!;
    const res = await handler(mockRequest({}), mockCtx) as { status: number };

    expect(res.status).toBe(400);
  });

  it('returns 404 when entry is not found', async () => {
    mockCosmos.pointRead.mockReset();
    mockCosmos.pointRead.mockResolvedValueOnce(null);

    const handler = handlers.get('enrichEntry')!;
    const res = await handler(mockRequest({ entryId: 'entry-1' }), mockCtx) as { status: number };

    expect(res.status).toBe(404);
  });

  it('returns 404 when phrasebook is not found', async () => {
    mockCosmos.pointRead.mockReset();
    mockCosmos.pointRead
      .mockResolvedValueOnce(MOCK_ENTRY)
      .mockResolvedValueOnce(null); // phrasebook not found

    const handler = handlers.get('enrichEntry')!;
    const res = await handler(mockRequest({ entryId: 'entry-1' }), mockCtx) as { status: number };

    expect(res.status).toBe(404);
  });

  it('returns 429 when quota is exhausted', async () => {
    mockCosmos.pointRead.mockReset();
    const exhaustedUser = { ...MOCK_USER, aiQuotaUsedToday: 20 };
    mockCosmos.pointRead
      .mockResolvedValueOnce(MOCK_ENTRY)
      .mockResolvedValueOnce(MOCK_PHRASEBOOK)
      .mockResolvedValueOnce(exhaustedUser);

    const handler = handlers.get('enrichEntry')!;
    const res = await handler(mockRequest({ entryId: 'entry-1' }), mockCtx) as { status: number };

    expect(res.status).toBe(429);
  });

  it('returns 200 with enrichment on success', async () => {
    const handler = handlers.get('enrichEntry')!;
    const res = await handler(
      mockRequest({ entryId: 'entry-1' }),
      mockCtx,
    ) as { status: number; jsonBody: unknown };

    expect(res.status).toBe(200);
    const body = res.jsonBody as Record<string, unknown>;
    expect(body.enrichment).toBeTruthy();
  });

  it('returns 503 when generateEnrichment throws', async () => {
    mockCosmos.pointRead.mockReset();
    mockCosmos.pointRead
      .mockResolvedValueOnce(MOCK_ENTRY)
      .mockResolvedValueOnce(MOCK_PHRASEBOOK)
      .mockResolvedValueOnce(MOCK_USER);
    mockGenerateEnrichment.mockRejectedValue(new Error('AI service down'));

    const handler = handlers.get('enrichEntry')!;
    const res = await handler(
      mockRequest({ entryId: 'entry-1' }),
      mockCtx,
    ) as { status: number };

    expect(res.status).toBe(503);
  });

  it('returns 401 when authorise throws 401', async () => {
    mockAuthorise.mockRejectedValue({ statusCode: 401, message: 'No token' });

    const handler = handlers.get('enrichEntry')!;
    const res = await handler(mockRequest({ entryId: 'entry-1' }), mockCtx) as { status: number };

    expect(res.status).toBe(401);
  });
});
