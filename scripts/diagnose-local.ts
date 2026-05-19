#!/usr/bin/env npx tsx
/**
 * Diagnose the local Cosmos DB mock for data quality issues.
 *
 * Usage (from repo root):
 *   npx tsx scripts/diagnose-local.ts
 *
 * Reports:
 *   - Entries whose sourceText or targetText would be rejected by the API allowlist
 *   - Entries with a learningScore that would produce an out-of-range delta on
 *     their next review (+10 / -5 limit vs the seeded decayBaseScore)
 *   - Basic structural issues (missing required fields, score out of [0,100] range)
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

// ─── Config ──────────────────────────────────────────────────────────────────

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MOCK_FILE = path.resolve(__dirname, '..', 'api', '.cosmos-mock.json');

// Must match api/src/functions/entries.ts exactly
const ENTRY_TEXT_PATTERN = /^[\p{L}\p{N}\p{M}\s'\u2019\-.,!?:;\u2013\u2014\u2026\/]+$/u;

const MAX_DELTA_UP = 10;
const MAX_DELTA_DOWN = -5;

// ─── Types ───────────────────────────────────────────────────────────────────

interface RawEntry {
  id?: string;
  type?: string;
  userId?: string;
  sourceText?: string;
  targetText?: string;
  learningScore?: number;
  decayBaseScore?: number | null;
  lastReviewedDate?: string | null;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function validateTextField(text: string): boolean {
  const trimmed = text.trim();
  return !trimmed || ENTRY_TEXT_PATTERN.test(trimmed);
}

function short(s: string | undefined, max = 40): string {
  if (!s) return '(empty)';
  return s.length > max ? s.slice(0, max) + '…' : s;
}

// ─── Main ────────────────────────────────────────────────────────────────────

function main(): void {
  if (!fs.existsSync(MOCK_FILE)) {
    console.error(`Mock file not found: ${MOCK_FILE}`);
    console.error('Run the seed script first: npx tsx scripts/seed-local.ts --userId <id>');
    process.exit(1);
  }

  const raw = JSON.parse(fs.readFileSync(MOCK_FILE, 'utf8')) as [string, unknown][];
  const docs = raw.map(([, v]) => v as RawEntry);
  const entries = docs.filter((d) => d.type === 'entry');

  console.log(`\nDiagnosing ${entries.length} entries in ${MOCK_FILE}\n`);

  // ── 1. Allowlist violations ──────────────────────────────────────────────
  const allowlistIssues: { id: string; field: string; value: string }[] = [];
  for (const e of entries) {
    if (e.sourceText !== undefined && !validateTextField(e.sourceText)) {
      allowlistIssues.push({ id: e.id ?? '?', field: 'sourceText', value: e.sourceText });
    }
    if (e.targetText !== undefined && e.targetText !== null && !validateTextField(e.targetText)) {
      allowlistIssues.push({ id: e.id ?? '?', field: 'targetText', value: e.targetText });
    }
  }

  if (allowlistIssues.length === 0) {
    console.log('✓ Allowlist check — no violations');
  } else {
    console.log(`✗ Allowlist violations (${allowlistIssues.length}) — these entries will fail on review PUT:`);
    for (const issue of allowlistIssues) {
      console.log(`    [${issue.id.slice(0, 8)}…] ${issue.field}: "${short(issue.value)}"`);
    }
  }

  // ── 2. Score range check ──────────────────────────────────────────────────
  const scoreIssues: { id: string; problem: string }[] = [];
  for (const e of entries) {
    const score = e.learningScore;
    if (score === undefined) {
      scoreIssues.push({ id: e.id ?? '?', problem: 'missing learningScore' });
      continue;
    }
    if (!Number.isInteger(score) || score < 0 || score > 100) {
      scoreIssues.push({ id: e.id ?? '?', problem: `learningScore ${score} out of [0,100]` });
    }
  }

  if (scoreIssues.length === 0) {
    console.log('✓ Score range check — all scores within [0,100]');
  } else {
    console.log(`✗ Score range issues (${scoreIssues.length}):`);
    for (const issue of scoreIssues) {
      console.log(`    [${issue.id.slice(0, 8)}…] ${issue.problem}`);
    }
  }

  // ── 3. Delta overflow check ───────────────────────────────────────────────
  // If the user reviews an entry, the new score = current ± delta where
  // |delta| is bounded by [MAX_DELTA_DOWN, MAX_DELTA_UP].  Seeded entries
  // where |learningScore - decayBaseScore| > 10 indicate that a pull
  // from the server would cause a delta violation on the very next review
  // PUT (because the mutation body would contain learningScore computed
  // against the stale pre-pull value).
  //
  // Note: this is only a risk indicator — the FlashcardSession fix re-reads
  // the live DB before writing, so legitimate reviews won't fail.  This check
  // is useful for spotting seed data that looks suspicious.
  const deltaWarnings: { id: string; source: string; current: number; base: number; diff: number }[] = [];
  for (const e of entries) {
    const score = e.learningScore;
    const base = e.decayBaseScore;
    if (typeof score !== 'number' || typeof base !== 'number') continue;
    const diff = score - base;
    if (diff > MAX_DELTA_UP || diff < MAX_DELTA_DOWN) {
      deltaWarnings.push({ id: e.id ?? '?', source: e.sourceText ?? '?', current: score, base, diff });
    }
  }

  if (deltaWarnings.length === 0) {
    console.log('✓ Delta check — no score/base drift beyond ±10');
  } else {
    console.log(`⚠ Delta drift warnings (${deltaWarnings.length}) — scores drifted from base by more than the ±10 guard:`);
    for (const w of deltaWarnings) {
      console.log(`    [${w.id.slice(0, 8)}…] "${short(w.source)}" score=${w.current} base=${w.base} diff=${w.diff > 0 ? '+' : ''}${w.diff}`);
    }
  }

  // ── 4. Pending sync mutations (not accessible here — IndexedDB is browser-only)
  console.log('\nNote: pending sync mutations live in the browser\'s IndexedDB.');
  console.log('      To inspect them, open DevTools → Application → IndexedDB → wordsprout → pendingSync.');

  // ── Summary ───────────────────────────────────────────────────────────────
  const totalIssues = allowlistIssues.length + scoreIssues.length;
  console.log(`\n${'─'.repeat(60)}`);
  if (totalIssues === 0 && deltaWarnings.length === 0) {
    console.log('All checks passed — data looks clean.\n');
  } else {
    console.log(`Found ${totalIssues} error(s), ${deltaWarnings.length} warning(s).\n`);
  }
}

main();
