import { db } from './db';
import { computeDecay, todayKey } from './scoring';
import { enqueueMutation } from './sync';

// ─── Once-per-day learning score decay pass ───────────────────────────────────

/**
 * Applies learning score decay to all entries belonging to `userId`.
 *
 * Runs at most once per calendar day per device, guarded by the 'lastDecay'
 * key in the `db.meta` table. Changed entries are persisted to IndexedDB and
 * enqueued for server sync via the existing mutation queue.
 *
 * The decay formula is idempotent across devices: given the same
 * `decayBaseScore`, `lastReviewedDate`, and today's date, every device
 * produces the same `targetScore`. Last-write-wins sync is therefore safe.
 *
 * @param userId  - The authenticated user's object ID (from JWT `sub` claim)
 * @param apiBase - Base URL of the Azure Functions API (e.g. from API_BASE)
 */
export async function applyDecayRound(userId: string, apiBase: string): Promise<void> {
  const today = todayKey();

  // ── Once-per-day guard ──────────────────────────────────────────────────────
  const lastDecayMeta = await db.meta.get('lastDecay');
  if (lastDecayMeta?.value === today) return;

  // ── Load all entries for this user ──────────────────────────────────────────
  const entries = await db.entries.where('userId').equals(userId).toArray();

  const now = new Date().toISOString();

  for (const entry of entries) {
    // Skip entries that are ineligible for decay
    if (
      entry.learningScore === 0 ||
      entry.decayBaseScore === null ||
      entry.lastReviewedDate === null
    ) {
      continue;
    }

    const newScore = computeDecay(
      entry.learningScore,
      entry.decayBaseScore,
      entry.lastReviewedDate,
      today,
    );

    // Skip if score is unchanged (avoids unnecessary writes and sync mutations)
    if (newScore === entry.learningScore) continue;

    // Persist the decayed score to IndexedDB
    await db.entries.update(entry.id, { learningScore: newScore, updatedAt: now });

    // Enqueue a sync mutation so the server (Cosmos DB) stays in sync
    await enqueueMutation(`${apiBase}/entries/${entry.id}`, 'PUT', {
      ...entry,
      learningScore: newScore,
      updatedAt: now,
    });
  }

  // ── Record that decay ran today ─────────────────────────────────────────────
  await db.meta.put({ key: 'lastDecay', value: today });
}
