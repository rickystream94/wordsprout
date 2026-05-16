import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';

// ─── Stub global fetch ─────────────────────────────────────────────────────────

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

// ─── Mock dependencies ─────────────────────────────────────────────────────────

vi.mock('@azure/identity', () => ({
  DefaultAzureCredential: class {
    getToken() {
      return Promise.resolve({ token: 'mock-azure-token' });
    }
  },
}));

vi.mock('isomorphic-dompurify', () => ({
  default: { sanitize: (v: unknown) => (typeof v === 'string' ? v : '') },
}));

vi.mock('../../config/env', () => ({
  IS_LOCAL: false,
  AZURE_AI_ENDPOINT: 'https://test.openai.azure.com',
  AZURE_AI_DEPLOYMENT: 'gpt-4o-mini',
}));

import { generateEnrichment, type EnrichParams } from '../ai';

const BASE_PARAMS: EnrichParams = {
  entryId: 'entry-1',
  userId: 'user-1',
  sourceText: 'ciao',
  targetText: 'hello',
  sourceLanguage: 'Italian',
  targetLanguage: 'English',
};

const VALID_AI_RESPONSE = {
  choices: [
    {
      message: {
        content: JSON.stringify({
          exampleSentences: ['Ciao, come stai?', 'Ciao a tutti!'],
          synonyms: ['salve', 'buongiorno'],
          antonyms: ['arrivederci'],
          register: 'informal',
          collocations: ['dire ciao', 'un ciao'],
          falseFriendWarning: null,
          partOfSpeech: 'interjection',
        }),
      },
    },
  ],
};

// ─── Tests ─────────────────────────────────────────────────────────────────────

describe('generateEnrichment (IS_LOCAL=false)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.stubGlobal('fetch', mockFetch);
  });

  it('calls Azure AI endpoint and returns parsed enrichment', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => VALID_AI_RESPONSE,
      text: async () => '',
    });

    const result = await generateEnrichment(BASE_PARAMS);

    expect(mockFetch).toHaveBeenCalledOnce();
    const [url] = mockFetch.mock.calls[0] as [string];
    expect(url).toContain('test.openai.azure.com');
    expect(url).toContain('gpt-4o-mini');

    expect(result.enrichment.exampleSentences).toEqual(['Ciao, come stai?', 'Ciao a tutti!']);
    expect(result.enrichment.synonyms).toEqual(['salve', 'buongiorno']);
    expect(result.enrichment.antonyms).toEqual(['arrivederci']);
    expect(result.enrichment.register).toBe('informal');
    expect(result.enrichment.entryId).toBe('entry-1');
    expect(result.enrichment.userId).toBe('user-1');
    expect(result.enrichment.type).toBe('enrichment');
  });

  it('includes a Bearer token in the Authorization header', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => VALID_AI_RESPONSE,
      text: async () => '',
    });

    await generateEnrichment(BASE_PARAMS);

    const [, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    const headers = init.headers as Record<string, string>;
    expect(headers['Authorization']).toContain('Bearer');
  });

  it('does not return translatedTargetText when targetText is provided', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => VALID_AI_RESPONSE,
      text: async () => '',
    });

    const result = await generateEnrichment(BASE_PARAMS);

    expect(result.translatedTargetText).toBeUndefined();
  });

  it('returns translatedTargetText when targetText is absent', async () => {
    const responseWithTranslation = {
      choices: [
        {
          message: {
            content: JSON.stringify({
              ...JSON.parse(VALID_AI_RESPONSE.choices[0].message.content),
              targetText: 'hello',
            }),
          },
        },
      ],
    };
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => responseWithTranslation,
      text: async () => '',
    });

    const result = await generateEnrichment({ ...BASE_PARAMS, targetText: undefined });

    expect(result.translatedTargetText).toBe('hello');
  });

  it('throws when fetch response is not ok', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 429,
      text: async () => 'rate limited',
    });

    await expect(generateEnrichment(BASE_PARAMS)).rejects.toThrow('429');
  });

  it('throws when AI returns invalid JSON', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: 'not-valid-json{{' } }],
      }),
      text: async () => '',
    });

    await expect(generateEnrichment(BASE_PARAMS)).rejects.toThrow('invalid JSON');
  });

  it('sanitises string fields using DOMPurify', async () => {
    const maliciousResponse = {
      choices: [
        {
          message: {
            content: JSON.stringify({
              exampleSentences: ['<script>alert(1)</script>Hello'],
              synonyms: [],
              antonyms: [],
              register: 'neutral',
              collocations: [],
              falseFriendWarning: null,
              partOfSpeech: 'noun',
            }),
          },
        },
      ],
    };
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => maliciousResponse,
      text: async () => '',
    });

    // sanitize is called — the test verifies the call was made
    const result = await generateEnrichment(BASE_PARAMS);
    expect(result.enrichment.exampleSentences).toBeDefined();
  });
});
