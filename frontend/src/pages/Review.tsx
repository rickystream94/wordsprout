import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/useAuth';
import FlashcardSession, { type SessionResult } from '../components/review/FlashcardSession';
import SessionSetup, { type SessionType, type ReviewMode } from '../components/review/SessionSetup';
import RehearseSession from '../components/review/RehearseSession';
import { getEntriesForSession, getEntriesForRehearsal, getPhrasebooks, type DBEntry } from '../services/db';
import type { PartOfSpeech } from '../types/models';
import styles from './Review.module.css';

type Phase = 'setup' | 'session' | 'summary';

export default function Review() {
  const { userId } = useAuth();
  const navigate = useNavigate();

  const [phase, setPhase] = useState<Phase>('setup');
  const [sessionEntries, setSessionEntries] = useState<DBEntry[]>([]);
  const [results, setResults] = useState<SessionResult[]>([]);
  const [targetLanguageName, setTargetLanguageName] = useState<string | undefined>(undefined);
  const [reviewMode, setReviewMode] = useState<ReviewMode>('competitive');

  const phrasebooks = useLiveQuery(
    () => (userId ? getPhrasebooks(userId) : Promise.resolve([])),
    [userId],
  ) ?? [];

  async function handleStart(
    mode: ReviewMode,
    type: SessionType,
    size: number,
    phrasebookId: string,
    posFilter: PartOfSpeech[],
    tagFilter: string[],
  ) {
    if (!userId) return;
    let entries: DBEntry[];
    if (mode === 'rehearse') {
      entries = await getEntriesForRehearsal(userId, type, size, phrasebookId, posFilter, tagFilter);
    } else {
      entries = await getEntriesForSession(userId, type, size, phrasebookId);
    }
    setSessionEntries(entries);
    setTargetLanguageName(phrasebooks.find((pb) => pb.id === phrasebookId)?.targetLanguageName);
    setReviewMode(mode);
    setPhase('session');
  }

  function handleSessionDone(sessionResults: SessionResult[]) {
    setResults(sessionResults);
    setPhase('summary');
  }

  if (phase === 'session') {
    if (reviewMode === 'rehearse') {
      return (
        <main className={styles.page}>
          <RehearseSession
            entries={sessionEntries}
            onDone={() => setPhase('setup')}
            targetLanguageName={targetLanguageName}
          />
        </main>
      );
    }
    return (
      <main className={styles.page}>
        <div className={styles.sessionHeader}>
          <button type="button" className={styles.exitBtn} onClick={() => setPhase('setup')}>
            ← Exit session
          </button>
          <p className={styles.exitNote}>Scores from answered cards are already saved.</p>
        </div>
        <FlashcardSession entries={sessionEntries} onDone={handleSessionDone} targetLanguageName={targetLanguageName} />
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
      <SessionSetup
        phrasebooks={phrasebooks}
        onStart={handleStart}
      />
    </main>
  );
}


