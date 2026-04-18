import { useState } from 'react';
import type { DBEntry, DBEnrichment } from '../../services/db';
import { db, updateEntry } from '../../services/db';
import { enqueueMutation } from '../../services/sync';
import { useLiveQuery } from 'dexie-react-hooks';
import { API_BASE } from '../../config/env';
import {
  applyDelta,
  computeScoreDelta,
  evaluateAnswer,
  splitGraphemes,
  todayKey,
  type EvalResult,
  type EvalOutcome,
} from '../../services/scoring';
import ReviewCard from '../entry/ReviewCard';
import styles from './FlashcardSession.module.css';

interface FlashcardSessionProps {
  entries: DBEntry[];
  onDone: (results: SessionResult[]) => void;
}

export interface SessionResult {
  entry: DBEntry;
  evalResult: EvalResult | 'revealed';
  oldScore: number;
  newScore: number;
  isSynonymHit: boolean;
}

export default function FlashcardSession({ entries, onDone }: FlashcardSessionProps) {
  const [index, setIndex] = useState(0);
  const [hintsUsed, setHintsUsed] = useState(0);
  const [evalResult, setEvalResult] = useState<EvalResult | 'revealed' | undefined>(undefined);
  const [results, setResults] = useState<SessionResult[]>([]);
  const [currentResult, setCurrentResult] = useState<{ delta: number; oldScore: number; newScore: number } | undefined>(undefined);
  const [currentSynonymHit, setCurrentSynonymHit] = useState(false);

  // Load enrichments for all session entries to support synonym matching
  const enrichments = useLiveQuery(
    () => db.enrichments.where('entryId').anyOf(entries.map((e) => e.id)).toArray(),
    [entries],
  );
  const enrichmentMap: Record<string, DBEnrichment> = {};
  if (enrichments) {
    for (const e of enrichments) enrichmentMap[e.entryId] = e;
  }

  const current = entries[index];

  if (!current) {
    return null;
  }

  const reviewedToday = current.lastReviewedDate === todayKey();

  /** All valid answers: primary targetText + AI synonyms (if any) */
  const validAnswers = [
    current.targetText,
    ...(enrichmentMap[current.id]?.synonyms ?? []),
  ].filter((v): v is string => !!v);

  function handleSubmit(input: string) {
    if (!current || evalResult !== undefined) return;

    const { result, isSynonymHit }: EvalOutcome = evaluateAnswer(input, validAnswers);
    setEvalResult(result);
    setCurrentSynonymHit(isSynonymHit);

    if (!reviewedToday) {
      const graphemeCount = splitGraphemes(validAnswers[0] ?? '').length;
      const delta = computeScoreDelta({ result, hintsUsed, graphemeCount });
      const newScore = applyDelta(current.learningScore, delta);
      const today = todayKey();

      void (async () => {
        await updateEntry(current.id, { learningScore: newScore, lastReviewedDate: today });
        await enqueueMutation(`${API_BASE}/entries/${current.id}`, 'PUT', {
          ...current,
          learningScore: newScore,
          lastReviewedDate: today,
        });
      })();

      setResults((prev) => [
        ...prev,
        { entry: current, evalResult: result, oldScore: current.learningScore, newScore, isSynonymHit },
      ]);
      setCurrentResult({ delta, oldScore: current.learningScore, newScore });
    } else {
      // Reviewed today — no score change
      setResults((prev) => [
        ...prev,
        { entry: current, evalResult: result, oldScore: current.learningScore, newScore: current.learningScore, isSynonymHit },
      ]);
    }
  }

  function handleReveal() {
    if (!current || evalResult !== undefined) return;

    const answer = current.targetText ?? '';
    const graphemeCount = splitGraphemes(answer).length;
    // Treat reveal as wrong for scoring purposes
    const delta = computeScoreDelta({ result: 'wrong', hintsUsed, graphemeCount });

    if (!reviewedToday) {
      const newScore = applyDelta(current.learningScore, delta);
      const today = todayKey();

      void (async () => {
        await updateEntry(current.id, { learningScore: newScore, lastReviewedDate: today });
        await enqueueMutation(`${API_BASE}/entries/${current.id}`, 'PUT', {
          ...current,
          learningScore: newScore,
          lastReviewedDate: today,
        });
      })();

      setResults((prev) => [
        ...prev,
        { entry: current, evalResult: 'revealed', oldScore: current.learningScore, newScore, isSynonymHit: false },
      ]);
      setCurrentResult({ delta, oldScore: current.learningScore, newScore });
    } else {
      setResults((prev) => [
        ...prev,
        { entry: current, evalResult: 'revealed', oldScore: current.learningScore, newScore: current.learningScore, isSynonymHit: false },
      ]);
    }

    setEvalResult('revealed');
  }

  function handleHint() {
    setHintsUsed((n) => n + 1);
  }

  function advance() {
    if (index + 1 >= entries.length) {
      onDone(results);
    } else {
      setIndex((i) => i + 1);
      setHintsUsed(0);
      setEvalResult(undefined);
      setCurrentResult(undefined);
      setCurrentSynonymHit(false);
    }
  }

  function handleNext() {
    advance();
  }

  const progress = `${index + 1} / ${entries.length}`;

  return (
    <div className={styles.session}>
      <div className={styles.header}>
        <span className={styles.progress}>{progress}</span>
        <div className={styles.progressBar}>
          <div
            className={styles.progressFill}
            style={{ width: `${((index + 1) / entries.length) * 100}%` }}
          />
        </div>
      </div>

      <ReviewCard
        key={current.id}
        entry={current}
        reviewedToday={reviewedToday}
        hintsUsed={hintsUsed}
        onSubmit={handleSubmit}
        onReveal={handleReveal}
        onHint={handleHint}
        evalResult={evalResult}
        allAnswers={validAnswers}
        isSynonymHit={currentSynonymHit}
        scoreDelta={currentResult?.delta}
        oldScore={currentResult?.oldScore}
        newScore={currentResult?.newScore}
      />

      {evalResult !== undefined && (
        <button className={styles.nextBtn} onClick={handleNext} autoFocus>
          {index + 1 < entries.length ? 'Next →' : 'Finish'}
        </button>
      )}
    </div>
  );
}
