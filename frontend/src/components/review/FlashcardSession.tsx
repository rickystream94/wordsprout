import { useState } from 'react';
import type { DBEntry } from '../../services/db';
import { updateEntry } from '../../services/db';
import { enqueueMutation } from '../../services/sync';
import { API_BASE } from '../../config/env';
import {
  applyDelta,
  computeScoreDelta,
  evaluateAnswer,
  splitGraphemes,
  todayKey,
  type EvalResult,
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
}

export default function FlashcardSession({ entries, onDone }: FlashcardSessionProps) {
  const [index, setIndex] = useState(0);
  const [hintsUsed, setHintsUsed] = useState(0);
  const [evalResult, setEvalResult] = useState<EvalResult | 'revealed' | undefined>(undefined);
  const [results, setResults] = useState<SessionResult[]>([]);
  const [currentResult, setCurrentResult] = useState<{ delta: number; oldScore: number; newScore: number } | undefined>(undefined);

  const current = entries[index];

  if (!current) {
    // Session complete — should not reach here, parent handles via onDone
    return null;
  }

  const reviewedToday = current.lastReviewedDate === todayKey();

  function handleSubmit(input: string) {
    if (!current || evalResult !== undefined) return;

    const answer = current.targetText ?? '';
    const result = evaluateAnswer(input, answer);
    setEvalResult(result);

    if (!reviewedToday) {
      const graphemeCount = splitGraphemes(answer).length;
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
        { entry: current, evalResult: result, oldScore: current.learningScore, newScore },
      ]);
      setCurrentResult({ delta, oldScore: current.learningScore, newScore });
    } else {
      // Reviewed today — no score change
      setResults((prev) => [
        ...prev,
        { entry: current, evalResult: result, oldScore: current.learningScore, newScore: current.learningScore },
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
        { entry: current, evalResult: 'revealed', oldScore: current.learningScore, newScore },
      ]);
      setCurrentResult({ delta, oldScore: current.learningScore, newScore });
    } else {
      setResults((prev) => [
        ...prev,
        { entry: current, evalResult: 'revealed', oldScore: current.learningScore, newScore: current.learningScore },
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
        entry={current}
        reviewedToday={reviewedToday}
        hintsUsed={hintsUsed}
        onSubmit={handleSubmit}
        onReveal={handleReveal}
        onHint={handleHint}
        evalResult={evalResult}
        correctAnswer={current.targetText}
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
