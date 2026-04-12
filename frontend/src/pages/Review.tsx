import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
import ReviewCard from '../components/entry/ReviewCard';
import { API_BASE } from '../config/env';
import { getEntriesByLearningState, updateEntry, type DBEntry } from '../services/db';
import { enqueueMutation } from '../services/sync';
import type { LearningState } from '../types/models';
import styles from './Review.module.css';

const FILTER_OPTIONS: { value: LearningState | 'all'; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'new', label: 'New' },
  { value: 'learning', label: 'Learning' },
  { value: 'mastered', label: 'Mastered' },
];

export default function Review() {
  const { userId } = useAuth();
  const navigate = useNavigate();

  const [filter, setFilter] = useState<LearningState | 'all'>('learning');
  const [index, setIndex] = useState(0);
  const [confirmExit, setConfirmExit] = useState(false);
  const [changed, setChanged] = useState(false);

  const entries = useLiveQuery(
    () =>
      userId
        ? filter === 'all'
          ? getEntriesByLearningState(userId, null)
          : getEntriesByLearningState(userId, filter)
        : Promise.resolve([]),
    [userId, filter],
  ) as DBEntry[] | undefined;

  function handleFilterChange(newFilter: LearningState | 'all') {
    setFilter(newFilter);
    setIndex(0);
    setChanged(false);
  }

  async function handleStateChange(entry: DBEntry, newState: LearningState) {
    await updateEntry(entry.id, { learningState: newState });
    await enqueueMutation(`${API_BASE}/entries/${entry.id}`, 'PUT', {
      ...entry,
      learningState: newState,
    });
    setChanged(true);
  }

  function handleExit() {
    if (changed) {
      setConfirmExit(true);
    } else {
      navigate(-1);
    }
  }

  if (!entries) {
    return (
      <main className={styles.page}>
        <p className={styles.loading}>Loading…</p>
      </main>
    );
  }

  const total = entries.length;
  const current = entries[index];

  return (
    <main className={styles.page}>
      <div className={styles.toolbar}>
        <button type="button" className={styles.exitBtn} onClick={handleExit}>
          ← Exit review
        </button>

        <div className={styles.filters}>
          {FILTER_OPTIONS.map((o) => (
            <button
              key={o.value}
              type="button"
              className={`${styles.filterPill} ${filter === o.value ? styles.filterActive : ''}`}
              onClick={() => handleFilterChange(o.value)}
            >
              {o.label}
            </button>
          ))}
        </div>
      </div>

      {total === 0 ? (
        <div className={styles.empty}>
          <p>No entries in this filter. Try a different state.</p>
        </div>
      ) : (
        <>
          <p className={styles.progress}>
            {index + 1} of {total}
          </p>

          {current && (
            <ReviewCard
              key={current.id}
              entry={current}
              onStateChange={handleStateChange}
            />
          )}

          <div className={styles.nav}>
            <button
              type="button"
              className={styles.navBtn}
              onClick={() => setIndex((i) => Math.max(0, i - 1))}
              disabled={index === 0}
            >
              ← Prev
            </button>
            <button
              type="button"
              className={styles.navBtn}
              onClick={() => setIndex((i) => Math.min(total - 1, i + 1))}
              disabled={index === total - 1}
            >
              Next →
            </button>
          </div>
        </>
      )}

      {confirmExit && (
        <div className={styles.overlay} role="dialog" aria-modal="true">
          <div className={styles.dialog}>
            <p>You've made changes. Are you sure you want to exit?</p>
            <div className={styles.dialogActions}>
              <button className={styles.cancelBtn} onClick={() => setConfirmExit(false)}>
                Keep reviewing
              </button>
              <button className={styles.confirmBtn} onClick={() => navigate(-1)}>
                Exit
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

