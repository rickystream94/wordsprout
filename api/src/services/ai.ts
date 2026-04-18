import DOMPurify from 'isomorphic-dompurify';
import { DefaultAzureCredential } from '@azure/identity';
import { AZURE_AI_DEPLOYMENT, AZURE_AI_ENDPOINT, IS_LOCAL } from '../config/env';

// Reuse a single credential instance — it caches tokens internally.
const azureCredential = new DefaultAzureCredential();
import type { AIEnrichment } from '../models/types';

// ─── Sanitisation helper ───────────────────────────────────────────────────────

function sanitiseStr(value: unknown): string {
  if (typeof value !== 'string') return '';
  return DOMPurify.sanitize(value).trim();
}

function sanitiseArr(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((v) => sanitiseStr(v)).filter(Boolean);
}

// ─── Local stub ────────────────────────────────────────────────────────────────

function buildLocalEnrichment(
  sourceText: string,
  targetText: string,
  entryId: string,
  userId: string,
  now: string,
): Omit<AIEnrichment, 'id' | 'createdAt' | 'updatedAt'> & { id: string; createdAt: string; updatedAt: string } {
  return {
    id: `enrichment-${entryId}`,
    userId,
    type: 'enrichment',
    entryId,
    exampleSentences: [
      `Example sentence for "${sourceText}".`,
      `Another use of "${sourceText}" in context.`,
    ],
    synonyms: [targetText ? `similar to ${targetText}` : 'synonym1', 'synonym2'],
    antonyms: ['antonym1'],
    register: 'neutral',
    collocations: [`common ${sourceText} phrase`],
    falseFriendWarning: undefined,
    generatedAt: now,
    createdAt: now,
    updatedAt: now,
  };
}

// ─── Structured prompt ─────────────────────────────────────────────────────────

function buildPrompt(
  sourceText: string,
  targetText: string | undefined,
  sourceLanguage: string,
  targetLanguage: string,
): string {
  return `You are a language-learning assistant. Generate enrichment data for a vocabulary entry.

Entry:
- Source text (${sourceLanguage}): "${sourceText}"${targetText ? `\n- Target text (${targetLanguage}): "${targetText}"` : ''}

Respond with ONLY a JSON object (no markdown, no explanation) in this exact shape:
{
  "exampleSentences": ["<sentence 1>", "<sentence 2>", "<sentence 3>"],
  "synonyms": ["<word1>", "<word2>"],
  "antonyms": ["<word1>"],
  "register": "<formal|informal|colloquial|neutral>",
  "collocations": ["<phrase1>", "<phrase2>"],
  "falseFriendWarning": "<string or null>"
}

Constraints:
- exampleSentences: 2-3 sentences using "${sourceText}" naturally
- synonyms: up to 5, in ${sourceLanguage}
- antonyms: up to 3, in ${sourceLanguage}
- register: one of formal, informal, colloquial, neutral
- collocations: up to 5 common collocations
- falseFriendWarning: a brief warning if there is a known false-friend/cognate trap, otherwise null`;
}

// ─── AI call ───────────────────────────────────────────────────────────────────

export interface EnrichParams {
  entryId: string;
  userId: string;
  sourceText: string;
  targetText?: string;
  sourceLanguage: string;
  targetLanguage: string;
}

export async function generateEnrichment(params: EnrichParams): Promise<AIEnrichment> {
  const { entryId, userId, sourceText, targetText, sourceLanguage, targetLanguage } = params;
  const now = new Date().toISOString();

  if (IS_LOCAL) {
    return buildLocalEnrichment(sourceText, targetText ?? '', entryId, userId, now) as AIEnrichment;
  }

  const prompt = buildPrompt(sourceText, targetText, sourceLanguage, targetLanguage);

  const response = await fetch(
    `${AZURE_AI_ENDPOINT}/openai/deployments/${AZURE_AI_DEPLOYMENT}/chat/completions?api-version=2024-12-01-preview`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${(await azureCredential.getToken('https://cognitiveservices.azure.com/.default'))?.token ?? ''}`,
      },
      body: JSON.stringify({
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 600,
        temperature: 0.3,
      }),
    },
  );

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`AI service error ${response.status}: ${text}`);
  }

  const data = (await response.json()) as {
    choices: { message: { content: string } }[];
  };

  const raw = data.choices[0]?.message?.content ?? '{}';

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    throw new Error('AI returned invalid JSON');
  }

  const enrichment: AIEnrichment = {
    id: `enrichment-${entryId}`,
    userId,
    type: 'enrichment',
    entryId,
    exampleSentences: sanitiseArr(parsed['exampleSentences']),
    synonyms: sanitiseArr(parsed['synonyms']),
    antonyms: sanitiseArr(parsed['antonyms']),
    register: sanitiseStr(parsed['register']) || undefined,
    collocations: sanitiseArr(parsed['collocations']),
    falseFriendWarning: sanitiseStr(parsed['falseFriendWarning']) || undefined,
    generatedAt: now,
    createdAt: now,
    updatedAt: now,
  };

  return enrichment;
}
