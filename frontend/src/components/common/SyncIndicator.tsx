import { useLiveQuery } from 'dexie-react-hooks';
import { useState, useEffect } from 'react';
import { db } from '../../services/db';
import { getFailedMutations, getPendingMutations, retryFailed, discardMutation, replayQueue, isSyncing, getNextSyncAt } from '../../services/sync';
import styles from './SyncIndicator.module.css';

function useSecondsToSync(): { syncing: boolean; secsRemaining: number | null } {
  const [snapshot, setSnapshot] = useState<{ syncing: boolean; secsRemaining: number | null }>(
    () => {
      if (isSyncing()) return { syncing: true, secsRemaining: null };
      return { syncing: false, secsRemaining: Math.max(0, Math.ceil((getNextSyncAt() - Date.now()) / 1000)) };
    },
  );
  useEffect(() => {
    const id = setInterval(() => {
      if (isSyncing()) {
        setSnapshot({ syncing: true, secsRemaining: null });
      } else {
        setSnapshot({ syncing: false, secsRemaining: Math.max(0, Math.ceil((getNextSyncAt() - Date.now()) / 1000)) });
      }
    }, 1000);
    return () => clearInterval(id);
  }, []);
  return snapshot;
}

export default function SyncIndicator() {
  const [showDetails, setShowDetails] = useState(false);
  const { syncing, secsRemaining } = useSecondsToSync();

  const pendingCount = useLiveQuery(
    () => db.pendingSync.where('status').anyOf(['pending', 'syncing']).count(),
    [],
    0,
  );

  // Always-live count so the pill stays visible when the panel is closed
  const failedCount = useLiveQuery(
    () => db.pendingSync.where('status').equals('failed').count(),
    [],
    0,
  );

  const failedMutations = useLiveQuery(
    () => (showDetails ? getFailedMutations() : Promise.resolve([])),
    [showDetails],
    [],
  );

  const pendingMutations = useLiveQuery(
    () => (showDetails ? getPendingMutations() : Promise.resolve([])),
    [showDetails],
    [],
  );

  const hasFailed = (failedCount ?? 0) > 0;
  const hasPending = (pendingCount ?? 0) > 0;

  if (!hasPending && !hasFailed) return null;

  // Any pending mutation carrying an errorMessage was blocked by a network/server error
  const lastError = pendingMutations?.find((m) => m.errorMessage)?.errorMessage;

  return (
    <>
      <button
        type="button"
        className={`${styles.pill} ${hasFailed ? styles.failed : ''}`}
        onClick={() => setShowDetails(!showDetails)}
        aria-label={hasFailed ? 'Sync failed — tap for details' : `${pendingCount} changes pending sync`}
      >
        {hasFailed ? (
          <>
            <span className={styles.dot} aria-hidden="true">✕</span>
            Sync failed ({failedCount ?? 0})
          </>
        ) : (
          <>
            <span className={`${styles.dot} ${styles.spinning}`} aria-hidden="true">⟳</span>
            {pendingCount} pending
          </>
        )}
      </button>

      {showDetails && hasFailed && (
        <div className={styles.details} role="dialog" aria-label="Sync failures">
          <div className={styles.detailsHeader}>
            <strong>Failed sync operations</strong>
            <button
              type="button"
              className={styles.closeBtn}
              onClick={() => setShowDetails(false)}
              aria-label="Close"
            >
              ×
            </button>
          </div>
          <ul className={styles.failList}>
            {failedMutations?.map((m) => (
              <li key={m.id} className={styles.failItem}>
                <span className={styles.method}>{m.method}</span>
                <span className={styles.url}>{m.url}</span>
                <button
                  type="button"
                  className={styles.discardBtn}
                  onClick={() => m.id !== undefined && discardMutation(m.id)}
                  aria-label="Discard this failed operation"
                  title="Discard"
                >
                  ✕
                </button>
              </li>
            ))}
          </ul>
          <div className={styles.actions}>
            <button type="button" className={styles.retryBtn} onClick={retryFailed}>
              Retry all
            </button>
            <p className={styles.hint}>Or discard individual items above.</p>
          </div>
        </div>
      )}

      {showDetails && !hasFailed && hasPending && (
        <div className={styles.details} role="dialog" aria-label="Pending sync operations">
          <div className={styles.detailsHeader}>
            <strong>{pendingCount} {pendingCount === 1 ? 'change' : 'changes'} pending</strong>
            <button
              type="button"
              className={styles.closeBtn}
              onClick={() => setShowDetails(false)}
              aria-label="Close"
            >
              ×
            </button>
          </div>
          <p className={styles.syncStatus}>
            {syncing ? (
              <><span className={`${styles.dot} ${styles.spinning}`} aria-hidden="true">⟳</span> Syncing now…</>
            ) : (
              <>Next sync in {secsRemaining}s</>
            )}
          </p>
          {lastError && (
            <p className={styles.errorHint}>
              Last attempt failed: {lastError}. Will retry automatically when back online.
            </p>
          )}
          <ul className={styles.failList}>
            {pendingMutations?.map((m) => (
              <li key={m.id} className={styles.failItem}>
                <span className={styles.pendingMethod}>{m.method}</span>
                <span className={styles.url}>{m.url}</span>
              </li>
            ))}
          </ul>
          <div className={styles.actions}>
            <button
              type="button"
              className={styles.retryBtn}
              onClick={() => replayQueue().catch(console.error)}
            >
              Retry now
            </button>
          </div>
        </div>
      )}
    </>
  );
}
