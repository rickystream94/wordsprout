import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
import FlashcardSession, { type SessionResult } from '../components/review/FlashcardSession';
import SessionSetup, { type SessionType } from '../components/review/SessionSetup';
import { getEntriesForSession, getPhrasebooks, type DBEntry } from '../services/db';
import styles from './Review.module.css';

type Phase = 'setup' | 'session' | 'summary';

export default function Review() {
  const { userId } = useAuth();
  const navigate = useNavigate();

  const [phase, setPhase] = useState<Phase>('setup');
  const [sessionEntries, setSessionEntries] = useState<DBEntry[]>([]);
  const [results, setResults] = useState<SessionResult[]>([]);

  const phrasebooks = useLiveQuery(
    () => (userId ? getPhrasebooks(userId) : Promise.resolve([])),
    [userId],
  ) ?? [];

  async function handleStart(type: SessionType, size: number, phrasebookId: string) {
    if (!userId) return;
    const entries = await getEntriesForSession(userId, type, size, phrasebookId);
    setSessionEntries(entries);
    setPhase('session');
  }

  function handleSessionDone(sessionResults: SessionResult[]) {
    setResults(sessionResults);
    setPhase('summary');
  }

  if (phase === 'session') {
    return (
      <main className={styles.page}>
        <div className={styles.sessionHeader}>
          <button type="button" className={styles.exitBtn} onClick={() => setPhase('setup')}>
            ← Exit session
          </button>
          <p className={styles.exitNote}>Scores from answered cards are already saved.</p>
        </div>
        <FlashcardSession entries={sessionEntries} onDone={handleSessionDone} />
      </main>
    );
  }

  if (phase === 'summary') {
    const correct = results.filter((r) => r.evalResult === 'correct').length;
    const typo = results.filter((r) => r.evalResult === 'typo').length;
    const wrong = results.filter((r) => r.evalResult === 'wrong').length;
    const revealed = results.filter((r) => r.evalResult === 'revealed').length;

    return (
      <main className={styles.page}>
        <div className={styles.summary}>
          <h2 className={styles.summaryHeading}>Session complete</h2>
          <dl className={styles.stats}>
            <div className={styles.stat}>
              <dt>Correct</dt>
              <dd className={styles.correct}>{correct}</dd>
            </div>
            <div className={styles.stat}>
              <dt>Typo</dt>
              <dd className={styles.typo}>{typo}</dd>
            </div>
            <div className={styles.stat}>
              <dt>Wrong</dt>
              <dd className={styles.wrong}>{wrong}</dd>
            </div>
            <div className={styles.stat}>
              <dt>Revealed</dt>
              <dd className={styles.skipped}>{revealed}</dd>
            </div>
          </dl>
          <div className={styles.summaryActions}>
            <button
              type="button"
              className={styles.primaryBtn}
              onClick={() => { setPhase('setup'); setResults([]); }}
            >
              Start over
            </button>
            <button
              type="button"
              className={styles.secondaryBtn}
              onClick={() => navigate(-1)}
            >
              Done
            </button>
          </div>
        </div>
      </main>
    );
  }

  // Phase: setup
  return (
    <main className={styles.page}>
      <button type="button" className={styles.exitBtn} onClick={() => navigate(-1)}>
        ← Back
      </button>
      <SessionSetup
        phrasebooks={phrasebooks}
        onStart={handleStart}
      />
    </main>
  );
}


