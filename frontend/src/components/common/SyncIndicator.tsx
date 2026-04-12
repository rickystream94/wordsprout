import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import { db } from '../../services/db';
import { getFailedMutations } from '../../services/sync';
import styles from './SyncIndicator.module.css';

export default function SyncIndicator() {
  const [showDetails, setShowDetails] = useState(false);

  const pendingCount = useLiveQuery(
    () => db.pendingSync.where('status').anyOf(['pending', 'syncing']).count(),
    [],
    0,
  );

  const failedMutations = useLiveQuery(
    () => (showDetails ? getFailedMutations() : Promise.resolve([])),
    [showDetails],
    [],
  );

  if (!pendingCount && !failedMutations?.length) return null;

  const hasFailed = (failedMutations?.length ?? 0) > 0;

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
            Sync failed ({failedMutations?.length ?? 0})
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
                <span className={styles.retries}>{m.retryCount} retries</span>
              </li>
            ))}
          </ul>
          <p className={styles.hint}>Failed operations will retry automatically when you reconnect.</p>
        </div>
      )}
    </>
  );
}
