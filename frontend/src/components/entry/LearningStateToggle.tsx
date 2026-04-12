import type { LearningState } from '../../types/models';
import styles from './LearningStateToggle.module.css';

const OPTIONS: { value: LearningState; label: string }[] = [
  { value: 'new', label: 'New' },
  { value: 'learning', label: 'Learning' },
  { value: 'mastered', label: 'Mastered' },
];

interface LearningStateToggleProps {
  value: LearningState;
  onChange: (state: LearningState) => void;
  compact?: boolean;
}

export default function LearningStateToggle({ value, onChange, compact }: LearningStateToggleProps) {
  return (
    <div
      className={`${styles.toggle} ${compact ? styles.compact : ''}`}
      role="group"
      aria-label="Learning state"
    >
      {OPTIONS.map((o) => (
        <button
          key={o.value}
          type="button"
          className={`${styles.pill} ${styles[`pill_${o.value}`]} ${value === o.value ? styles.pillActive : ''}`}
          aria-pressed={value === o.value}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
