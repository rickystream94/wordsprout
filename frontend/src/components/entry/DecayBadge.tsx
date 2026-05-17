import { getDecayStatus, graceForScore } from '../../services/scoring';
import type { DBEntry } from '../../services/db';
import styles from './DecayBadge.module.css';

interface DecayBadgeProps {
  entry: DBEntry;
  today: string;
}

/**
 * Right-edge status strip for entry cards.
 *
 * Renders two absolutely-positioned siblings inside `.card` (position:relative):
 *  1. A thin full-height coloured strip on the right edge
 *  2. A small text chip anchored top-right (omitted in the fresh/positive zone)
 *
 * Both elements are aria-hidden; the tooltip on the label covers desktop
 * accessibility, and the visible text covers mobile discoverability.
 */
export default function DecayBadge({ entry, today }: DecayBadgeProps) {
  const status = getDecayStatus(
    entry.decayBaseScore,
    entry.learningScore,
    entry.lastReviewedDate,
    today,
  );

  if (status.kind === 'none') return null;

  if (status.kind === 'grace') {
    const grace = graceForScore(entry.decayBaseScore as number);
    const warningThreshold = Math.ceil(grace * 0.25);

    if (status.daysLeft > warningThreshold) {
      // Positive zone: green strip + ✓ safe chip
      const daysText = `${status.daysLeft} day${status.daysLeft === 1 ? '' : 's'}`;
      return (
        <>
          <span className={`${styles.strip} ${styles.fresh}`} aria-hidden="true" />
          <span
            className={`${styles.stripLabel} ${styles.fresh}`}
            title={`Reviewed recently — score protected for ${daysText} more`}
            aria-hidden="true"
          >
            ✓ safe
          </span>
        </>
      );
    }

    // Warning zone: amber strip + countdown chip
    const label = status.daysLeft === 0 ? '⏳ today' : `⏳ ${status.daysLeft}d`;
    const daysText = status.daysLeft === 0
      ? 'today'
      : `in ${status.daysLeft} day${status.daysLeft === 1 ? '' : 's'}`;
    return (
      <>
        <span className={`${styles.strip} ${styles.graceWarning}`} aria-hidden="true" />
        <span
          className={`${styles.stripLabel} ${styles.graceWarning}`}
          title={`Grace period ends ${daysText} — review to reset the timer`}
          aria-hidden="true"
        >
          {label}
        </span>
      </>
    );
  }

  // Decaying: strip + points-lost chip
  const label = `↓ ${status.pointsLost}pts`;
  const urgencyTitles = {
    low: 'Mild decay — review soon to recover these points',
    medium: 'Moderate decay — review to stop further loss',
    high: 'Heavy decay — review urgently to recover this entry',
  };
  return (
    <>
      <span className={`${styles.strip} ${styles[status.urgency]}`} aria-hidden="true" />
      <span
        className={`${styles.stripLabel} ${styles[status.urgency]}`}
        title={urgencyTitles[status.urgency]}
        aria-hidden="true"
      >
        {label}
      </span>
    </>
  );
}
