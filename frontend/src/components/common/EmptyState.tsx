import styles from './EmptyState.module.css';

interface EmptyStateProps {
  /** Main heading */
  title: string;
  /** Descriptive text below the heading */
  description?: string;
  /** Optional call-to-action button label */
  actionLabel?: string;
  /** Called when the action button is clicked */
  onAction?: () => void;
  /** Optional emoji or icon to show above the title */
  icon?: string;
}

export default function EmptyState({
  title,
  description,
  actionLabel,
  onAction,
  icon = '🔍',
}: EmptyStateProps) {
  return (
    <div className={styles.container} role="status">
      <span className={styles.icon} aria-hidden="true">{icon}</span>
      <h3 className={styles.title}>{title}</h3>
      {description && <p className={styles.description}>{description}</p>}
      {actionLabel && onAction && (
        <button className={styles.action} onClick={onAction} type="button">
          {actionLabel}
        </button>
      )}
    </div>
  );
}
