import { scoreToRange } from '../../services/scoring';
import styles from './LearningScoreBar.module.css';

interface LearningScoreBarProps {
  score: number; // 0–100
  showLabel?: boolean;
}

const RANGE_LABELS: Record<string, string> = {
  dormant:   '🌑 Dormant',
  sprouting: '🌱 Sprouting',
  echoing:   '💬 Echoing',
  inscribed: '✏️ Inscribed',
  engraved:  '🧠 Engraved',
};

export default function LearningScoreBar({ score, showLabel = true }: LearningScoreBarProps) {
  const range = scoreToRange(score);

  return (
    <div className={`${styles.wrapper} ${styles[range]}`} title={`Score: ${score}/100`}>
      <div className={styles.track}>
        <div className={styles.fill} style={{ width: `${score}%` }} />
      </div>
      {showLabel && (
        <span className={styles.label}>{RANGE_LABELS[range]}</span>
      )}
    </div>
  );
}
