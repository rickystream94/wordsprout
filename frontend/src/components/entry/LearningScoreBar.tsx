import { scoreToRange } from '../../services/scoring';
import styles from './LearningScoreBar.module.css';

interface LearningScoreBarProps {
  score: number; // 0–100
  showLabel?: boolean;
}

const RANGES = [
  { key: 'dormant',   emoji: '🌑', label: 'Dormant'   },
  { key: 'sprouting', emoji: '🌱', label: 'Sprouting' },
  { key: 'echoing',   emoji: '💬', label: 'Echoing'   },
  { key: 'inscribed', emoji: '✏️', label: 'Inscribed' },
  { key: 'engraved',  emoji: '🧠', label: 'Engraved'  },
] as const;

const TICKS = [20, 40, 60, 80];

export default function LearningScoreBar({ score, showLabel = true }: LearningScoreBarProps) {
  const range = scoreToRange(score);

  return (
    <div className={`${styles.wrapper} ${styles[range]}`} title={`Score: ${score}/100`}>
      {showLabel && (
        <div className={styles.rangeRow}>
          {RANGES.map((r) => (
            <span
              key={r.key}
              className={`${styles.rangeChip} ${r.key === range ? styles.rangeChipActive : ''}`}
              aria-current={r.key === range ? 'true' : undefined}
            >
              <span className={styles.chipEmoji}>{r.emoji}</span>
              <span className={styles.chipLabel}>{r.label}</span>
            </span>
          ))}
        </div>
      )}
      <div className={styles.trackWrapper}>
        <div className={styles.track}>
          <div className={styles.fill} style={{ width: `${score}%` }} />
        </div>
        {TICKS.map((pos) => (
          <div key={pos} className={styles.tick} style={{ left: `${pos}%` }} />
        ))}
      </div>
    </div>
  );
}
