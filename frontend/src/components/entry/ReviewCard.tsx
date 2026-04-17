import { useEffect, useRef, useState } from 'react';
import type { DBEntry } from '../../services/db';
import type { EvalResult } from '../../services/scoring';
import { getHint, splitGraphemes } from '../../services/scoring';
import styles from './ReviewCard.module.css';

export interface ReviewCardProps {
  entry: DBEntry;
  reviewedToday: boolean;
  hintsUsed: number;
  onSubmit: (input: string) => void;
  onReveal: () => void;
  onHint: () => void;
  /** Shown after evaluation — undefined while waiting for input */
  evalResult?: EvalResult | 'revealed';
  /** The correct answer, shown after wrong/revealed evaluation */
  correctAnswer?: string;
  /** Score delta applied this round; undefined while waiting or if reviewed today */
  scoreDelta?: number;
  /** Score before this round */
  oldScore?: number;
  /** Score after this round */
  newScore?: number;
}

export default function ReviewCard({
  entry,
  reviewedToday,
  hintsUsed,
  onSubmit,
  onReveal,
  onHint,
  evalResult,
  correctAnswer,
  scoreDelta,
  oldScore,
  newScore,
}: ReviewCardProps) {
  const [input, setInput] = useState('');
  const [animScore, setAnimScore] = useState<number>(entry.learningScore);
  const inputRef = useRef<HTMLInputElement>(null);
  const answered = evalResult !== undefined;

  // Reset bar position when moving to a new card
  useEffect(() => {
    setAnimScore(entry.learningScore);
  }, [entry.id, entry.learningScore]);

  // Animate bar from oldScore → newScore when a result arrives
  useEffect(() => {
    if (newScore === undefined || oldScore === undefined) return;
    setAnimScore(oldScore);
    let r2 = 0;
    const r1 = requestAnimationFrame(() => {
      r2 = requestAnimationFrame(() => setAnimScore(newScore));
    });
    return () => {
      cancelAnimationFrame(r1);
      cancelAnimationFrame(r2);
    };
  }, [newScore, oldScore]);

  // Reveal grapheme-based hint string
  const graphemes = splitGraphemes(entry.targetText ?? '');
  const hintStr = hintsUsed > 0 ? getHint(entry.targetText ?? '', hintsUsed) : null;

  const isGain = (scoreDelta ?? 0) > 0;
  const isLoss = (scoreDelta ?? 0) < 0;

  useEffect(() => {
    if (!answered) {
      setInput('');
      inputRef.current?.focus();
    }
  }, [entry.id, answered]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim() || answered) return;
    onSubmit(input);
  }

  return (
    <div className={styles.card}>
      {reviewedToday && (
        <p className={styles.reviewedBanner} role="status">
          Already reviewed today — score unchanged 🔒
        </p>
      )}

      <p className={styles.prompt}>
        <span className={styles.promptLabel}>Translate:</span>
        <span className={styles.sourceText}>{entry.sourceText}</span>
      </p>

      {entry.notes && (
        <p className={styles.notes}>{entry.notes}</p>
      )}

      {hintStr && !answered && (
        <p className={styles.hintReveal} aria-label="Hint">
          💡 {hintStr}
        </p>
      )}

      {!answered ? (
        <form className={styles.inputRow} onSubmit={handleSubmit}>
          <input
            ref={inputRef}
            className={styles.answerInput}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Type translation…"
            aria-label="Your translation"
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck={false}
          />
          <div className={styles.btnRow}>
            <button
              type="submit"
              className={styles.submitBtn}
              disabled={!input.trim()}
            >
              Submit
            </button>
            {graphemes.length > hintsUsed && (
              <button
                type="button"
                className={styles.hintBtn}
                onClick={onHint}
              >
                💡 Hint
              </button>
            )}
            <button
              type="button"
              className={styles.revealBtn}
              onClick={onReveal}
            >
              👁️ Reveal
            </button>
          </div>
        </form>
      ) : (
        <div className={styles.result}>
          <p
            className={`${styles.resultLabel} ${
              evalResult === 'correct'
                ? styles.correct
                : evalResult === 'typo'
                  ? styles.typo
                  : styles.wrong
            }`}
          >
            {evalResult === 'correct' && (hintsUsed > 0 ? '🎉 Correct! (hint used — reduced gain)' : '🎉 Correct!')}
            {evalResult === 'typo' && '🤏 Almost! Accepted with a small deduction'}
            {evalResult === 'wrong' && '😬 Not quite — keep pushing!'}
            {evalResult === 'revealed' && '👁️ Peeked — full deduction applied'}
          </p>
          {(evalResult === 'wrong' || evalResult === 'revealed') && correctAnswer && (
            <p className={styles.correctAnswer}>
              ✏️ Answer: <strong>{correctAnswer}</strong>
            </p>
          )}
          {!reviewedToday && newScore !== undefined && oldScore !== undefined && (
            <div className={styles.scoreChange}>
              <div className={styles.scoreBarRow}>
                <div className={styles.scoreMiniTrack}>
                  <div
                    className={`${styles.scoreMiniBar} ${isGain ? styles.barGain : isLoss ? styles.barLoss : styles.barNeutral}`}
                    style={{ width: `${animScore}%` }}
                  />
                </div>
                <span className={`${styles.deltaChip} ${isGain ? styles.chipGain : isLoss ? styles.chipLoss : styles.chipNeutral}`}>
                  {isGain ? `+${scoreDelta}` : `${scoreDelta}`}
                </span>
              </div>
              <span className={styles.scoreNums}>{oldScore} → {newScore} / 100</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
