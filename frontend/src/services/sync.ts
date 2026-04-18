import { useLiveQuery } from 'dexie-react-hooks';
import type { MutationMethod } from '../types/models';
import { db } from './db';
import { ApiRequestError, getAccessToken, phrasebooksApi, entriesApi } from './api';
import { rebuildIndex } from './search';

// Pull TTL: always run on an empty DB (first device login), otherwise throttle
// to 5 minutes so switching between laptop and phone stays in sync quickly.
export const PULL_TTL_MS = 5 * 60 * 1000; // 5 minutes

// ─── Pull all server data into IndexedDB ──────────────────────────────────────
// Safe to call frequently — skips the network round-trip if run within PULL_TTL_MS
// unless IndexedDB is empty, in which case it always runs.

let _pullInProgress = false;

export async function pullFromServer(): Promise<void> {
  if (_pullInProgress) return;
  _pullInProgress = true;
  try {
    const [lastPullMeta, phrasebookCount] = await Promise.all([
      db.meta.get('lastPull'),
      db.phrasebooks.count(),
    ]);

    const lastPullMs = lastPullMeta ? Number(lastPullMeta.value) : 0;
    const isStale = Date.now() - lastPullMs > PULL_TTL_MS;
    const isEmpty = phrasebookCount === 0;

    if (!isStale && !isEmpty) return;

    const [phrasebooks, entries] = await Promise.all([
      phrasebooksApi.list(),
      entriesApi.list(),
    ]);

    await Promise.all([
      db.phrasebooks.bulkPut(phrasebooks),
      db.entries.bulkPut(entries),
      db.meta.put({ key: 'lastPull', value: String(Date.now()) }),
    ]);

    // Rebuild the in-memory search index with the newly pulled entries
    await rebuildIndex();
  } finally {
    _pullInProgress = false;
  }
}

const MAX_RETRIES = 3;
export const SYNC_INTERVAL_MS = 30_000;

// ─── Sync scheduling state ────────────────────────────────────────────────────

let _syncInProgress = false;
let _nextSyncAt: number = Date.now() + SYNC_INTERVAL_MS;

/** True while replayQueue is actively processing mutations. */
export function isSyncing(): boolean {
  return _syncInProgress;
}

/** Timestamp (ms) of the next scheduled automatic sync. */
export function getNextSyncAt(): number {
  return _nextSyncAt;
}

// ─── Enqueue a mutation to the pending-sync queue ─────────────────────────────

export async function enqueueMutation(
  url: string,
  method: MutationMethod,
  body?: unknown,
): Promise<void> {
  await db.pendingSync.add({
    url,
    method,
    body: body !== undefined ? JSON.stringify(body) : undefined,
    retryCount: 0,
    status: 'pending',
    createdAt: new Date().toISOString(),
  });
  // Sync immediately when online so the pending state is as brief as possible
  if (navigator.onLine) {
    replayQueue().catch(console.error);
  }
}

// ─── Replay all pending mutations ─────────────────────────────────────────────

export async function replayQueue(): Promise<void> {
  if (_syncInProgress) return;
  _syncInProgress = true;
  _nextSyncAt = NaN; // actively syncing — no "next" time yet
  try {
    await _doReplayQueue();
  } finally {
    _syncInProgress = false;
    _nextSyncAt = Date.now() + SYNC_INTERVAL_MS;
  }
}

async function _doReplayQueue(): Promise<void> {
  const pending = await db.pendingSync
    .where('status')
    .anyOf(['pending', 'syncing'])
    .toArray();

  if (pending.length === 0) return;

  for (const mutation of pending) {
    if (mutation.id === undefined) continue;

    // Mark as syncing
    await db.pendingSync.update(mutation.id, {
      status: 'syncing',
      lastAttemptAt: new Date().toISOString(),
    });

    try {
      const init: RequestInit = {
        method: mutation.method,
        headers: { 'Content-Type': 'application/json' },
      };
      if (mutation.body) init.body = mutation.body;

      // Acquire a fresh token the same way api.ts does
      const authToken = await getAccessToken();
      if (authToken) {
        (init.headers as Record<string, string>)['Authorization'] = `Bearer ${authToken}`;
      }

      const response = await fetch(mutation.url, init);

      if (!response.ok) {
        throw new ApiRequestError(response.status, `HTTP ${response.status}`);
      }

      // Success — remove from queue
      await db.pendingSync.delete(mutation.id);
    } catch (err: unknown) {
      // 401 = token expired or invalid — the mutations are still valid, just keep
      // them pending so they replay after the user re-authenticates.
      if (err instanceof ApiRequestError && err.statusCode === 401) {
        await db.pendingSync.update(mutation.id, { status: 'pending' });
        window.dispatchEvent(new CustomEvent('wordsprout:session-expired'));
        return;
      }

      // 403 = permanent access failure — stale local writes will never reach the server.
      // Clear the entire queue and fire an event so the app can redirect to /access-blocked.
      if (err instanceof ApiRequestError && err.statusCode === 403) {
        await db.pendingSync.clear();
        window.dispatchEvent(new CustomEvent('wordsprout:access-revoked'));
        return;
      }

      // 404 = the referenced resource no longer exists — this mutation can never succeed.
      // Discard it silently rather than burning retries.
      if (err instanceof ApiRequestError && err.statusCode === 404) {
        await db.pendingSync.delete(mutation.id);
        continue;
      }

      const errorMessage = err instanceof Error ? err.message : 'Unknown error';

      // Network error (offline / no connectivity) — TypeError from fetch, not an HTTP response.
      // Do NOT increment retryCount: the mutation stays 'pending' and will be retried
      // the next time replayQueue() runs (on 'online' or visibilitychange).
      const isNetworkError = !(err instanceof ApiRequestError);
      if (isNetworkError) {
        await db.pendingSync.update(mutation.id, {
          status: 'pending',
          errorMessage,
        });
        // No point trying further mutations if we're offline
        return;
      }

      // Server error (4xx/5xx) — count against retries
      const newRetryCount = mutation.retryCount + 1;
      if (newRetryCount >= MAX_RETRIES) {
        await db.pendingSync.update(mutation.id, {
          status: 'failed',
          retryCount: newRetryCount,
          errorMessage,
        });
      } else {
        await db.pendingSync.update(mutation.id, {
          status: 'pending',
          retryCount: newRetryCount,
          errorMessage,
        });
      }
    }
  }
}

// ─── Returns a live count of pending/syncing mutations ────────────────────────

export async function getPendingCount(): Promise<number> {
  return db.pendingSync.where('status').anyOf(['pending', 'syncing']).count();
}

export async function getFailedMutations() {
  return db.pendingSync.where('status').equals('failed').toArray();
}

export async function getPendingMutations() {
  return db.pendingSync.where('status').anyOf(['pending', 'syncing']).toArray();
}

// ─── Reset all failed mutations to pending so replayQueue picks them up again ─

export async function retryFailed(): Promise<void> {
  const failed = await db.pendingSync.where('status').equals('failed').toArray();
  await Promise.all(
    failed
      .filter((m) => m.id !== undefined)
      .map((m) =>
        db.pendingSync.update(m.id!, {
          status: 'pending',
          retryCount: 0,
          errorMessage: undefined,
        }),
      ),
  );
  await replayQueue();
}

// ─── Permanently discard a single failed mutation ─────────────────────────────

export async function discardMutation(id: number): Promise<void> {
  await db.pendingSync.delete(id);
}

// ─── Live set of resource IDs that have pending/syncing mutations ─────────────

const UUID_RE = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;

/**
 * Extracts all UUIDs referenced by a mutation — from the URL path and,
 * for POST mutations, from the serialised body (which always has an `id` field).
 */
function extractIds(url: string, method: string, body?: string): string[] {
  const ids = new Set<string>();
  for (const m of url.matchAll(UUID_RE)) ids.add(m[0].toLowerCase());
  if (method === 'POST' && body) {
    try {
      const parsed = JSON.parse(body) as Record<string, unknown>;
      if (typeof parsed['id'] === 'string') ids.add(parsed['id'].toLowerCase());
    } catch { /* ignore */ }
  }
  return [...ids];
}

/**
 * React hook — returns a live Set of resource IDs (UUIDs) that currently have
 * pending or syncing mutations in the queue. Useful for marking items in the UI.
 */
export function usePendingIds(): Set<string> {
  const mutations = useLiveQuery(
    () => db.pendingSync.where('status').anyOf(['pending', 'syncing']).toArray(),
    [],
    [],
  );
  const ids = new Set<string>();
  for (const m of mutations) {
    for (const id of extractIds(m.url, m.method, m.body)) ids.add(id);
  }
  return ids;
}
