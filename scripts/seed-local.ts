#!/usr/bin/env npx tsx
/**
 * Seed the local Cosmos DB mock file with synthetic vocabulary data.
 *
 * Usage:
 *   npx tsx scripts/seed-local.ts --userId <oauth-subject-id>
 *
 * The script:
 *   1. Reads the existing api/.cosmos-mock.json (if any)
 *   2. Removes all documents for the target userId (clean slate)
 *   3. Generates phrasebooks, entries, enrichments, and a user document
 *   4. Writes the updated mock file back
 *
 * The frontend auto-pulls from the API on load, so only the backend
 * mock file needs seeding.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { phrasebooks } from './seed-data/vocabulary.js';
import { enrichments } from './seed-data/enrichments.js';
import {
  generateUser,
  generatePhrasebook,
  generateEntry,
  generateEnrichment,
  type SeedPhrasebook,
  type SeedEntry,
  type SeedEnrichment,
  type SeedUser,
} from './seed-data/generators.js';

// ─── Parse CLI args ──────────────────────────────────────────────────────────

function parseArgs(): { userId: string } {
  const args = process.argv.slice(2);
  const idx = args.indexOf('--userId');
  if (idx === -1 || !args[idx + 1]) {
    console.error('Usage: npx tsx scripts/seed-local.ts --userId <oauth-subject-id>');
    console.error('');
    console.error('Tip: log in to the app once, then check api/.cosmos-mock.json');
    console.error('     for your userId (the "userId" field on any document).');
    process.exit(1);
  }
  return { userId: args[idx + 1] };
}

// ─── Main ────────────────────────────────────────────────────────────────────

function main(): void {
  const { userId } = parseArgs();
  const mockFile = path.resolve(__dirname, '..', 'api', '.cosmos-mock.json');

  // Start with a clean slate — the mock file is dev-only so we replace it entirely.
  // This avoids stale data from previous seeds with a different userId.
  const store = new Map<string, Record<string, unknown>>();
  if (fs.existsSync(mockFile)) {
    console.log('Replacing existing mock file (clean slate)');
  }

  // Generate user document
  const user: SeedUser = generateUser(userId);
  store.set(user.id, user as unknown as Record<string, unknown>);

  // Generate phrasebooks, entries, and enrichments
  let totalEntries = 0;
  let totalEnrichments = 0;

  for (const pbDef of phrasebooks) {
    const pb: SeedPhrasebook = generatePhrasebook(userId, pbDef);
    store.set(pb.id, pb as unknown as Record<string, unknown>);

    const entries: SeedEntry[] = [];
    for (const rawEntry of pbDef.entries) {
      const entry = generateEntry(userId, pb.id, rawEntry);
      entries.push(entry);
      store.set(entry.id, entry as unknown as Record<string, unknown>);
      totalEntries++;
    }

    // Add enrichments for this phrasebook if available
    const enrichmentDefs = enrichments[pbDef.name];
    if (enrichmentDefs) {
      for (const rawEnrichment of enrichmentDefs) {
        const targetEntry = entries[rawEnrichment.entryIndex];
        if (targetEntry) {
          const enrichment: SeedEnrichment = generateEnrichment(userId, targetEntry.id, rawEnrichment);
          store.set(enrichment.id, enrichment as unknown as Record<string, unknown>);

          // Link entry → enrichment
          targetEntry.enrichmentId = enrichment.id;
          store.set(targetEntry.id, targetEntry as unknown as Record<string, unknown>);
          totalEnrichments++;
        }
      }
    }
  }

  // Write back
  fs.writeFileSync(mockFile, JSON.stringify([...store.entries()], null, 2));

  console.log('');
  console.log('Seed complete:');
  console.log(`  User:         1`);
  console.log(`  Phrasebooks:  ${phrasebooks.length}`);
  console.log(`  Entries:      ${totalEntries}`);
  console.log(`  Enrichments:  ${totalEnrichments}`);
  console.log(`  Mock file:    ${mockFile}`);
  console.log('');
  console.log('Refresh your browser (or restart the API) to see the data.');
}

main();
