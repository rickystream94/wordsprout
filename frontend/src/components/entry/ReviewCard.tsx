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
  /** All valid answers (primary + synonyms) for result display */
  allAnswers?: string[];
  /** True when a synonym (not the primary target) was matched */
  isSynonymHit?: boolean;
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
  allAnswers,
  isSynonymHit,
  scoreDelta,
  oldScore,
  newScore,
}: ReviewCardProps) {
  const [input, setInput] = useState('');
  const [animScore, setAnimScore] = useState<number>(entry.learningScore);
  const inputRef = useRef<HTMLInputElement>(null);
  const answered = evalResult !== undefined;

  // Focus input on mount (key={entry.id} in parent remounts this component for each new card,
  // which also resets input and animScore via useState initial values)
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Animate bar from oldScore → newScore when a result arrives
  useEffect(() => {
    if (newScore === undefined || oldScore === undefined) return;
    let r1 = 0, r2 = 0;
    r1 = requestAnimationFrame(() => {
      setAnimScore(oldScore);
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

  // When every grapheme hint has been used the answer is fully revealed —
  // treat it as a peek automatically so the user can't submit a cheat answer.
  const allHintsUsed = graphemes.length > 0 && hintsUsed >= graphemes.length;
  useEffect(() => {
    if (!answered && allHintsUsed) {
      onReveal();
    }
  }, [allHintsUsed, answered, onReveal]);

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
            {evalResult === 'correct' && !isSynonymHit && (hintsUsed > 0 ? '🎉 Correct! (hint used — reduced gain)' : '🎉 Correct!')}
            {evalResult === 'correct' && isSynonymHit && '🎉 Correct — you used a synonym!'}
            {evalResult === 'typo' && !isSynonymHit && '🤏 Almost! Accepted with a small deduction'}
            {evalResult === 'typo' && isSynonymHit && '🤏 Almost — matched a synonym with a small deduction'}
            {evalResult === 'wrong' && '😬 Not quite — keep pushing!'}
            {evalResult === 'revealed' && '👁️ Peeked — full deduction applied'}
          </p>
          {(evalResult === 'wrong' || evalResult === 'revealed' || evalResult === 'correct' || evalResult === 'typo') &&
            allAnswers && allAnswers.length > 0 && (
            <p className={styles.correctAnswer}>
              ✏️ Valid answer{allAnswers.length > 1 ? 's' : ''}:{' '}
              {allAnswers.map((a, i) => (
                <span key={i}>
                  {i > 0 && <span className={styles.answerSep}> · </span>}
                  <strong>{a}</strong>
                  {i === 0 && allAnswers.length > 1 && <span className={styles.primaryBadge}> (main)</span>}
                </span>
              ))}
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
