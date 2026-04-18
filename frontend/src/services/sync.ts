import type { MutationMethod } from '../types/models';
import { db } from './db';
import { ApiRequestError } from './api';

const MAX_RETRIES = 3;

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
}

// ─── Replay all pending mutations ─────────────────────────────────────────────

export async function replayQueue(): Promise<void> {
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

      // Include auth header from stored token if available
      const authToken = sessionStorage.getItem('wordsprout_access_token');
      if (authToken) {
        (init.headers as Record<string, string>)['Authorization'] = `Bearer ${authToken}`;
      }

      const response = await fetch(mutation.url, init);

      if (!response.ok) {
        throw new ApiRequestError(response.status, `HTTP ${response.status}`);
      }

      // Success — remove from queue
      await db.pendingSync.delete(mutation.id);
    } catch (err) {
      const newRetryCount = mutation.retryCount + 1;
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';

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
