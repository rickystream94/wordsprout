import styles from './OfflineIndicator.module.css';

interface OfflineIndicatorProps {
  onDismiss: () => void;
}

export default function OfflineIndicator({ onDismiss }: OfflineIndicatorProps) {
  return (
    <div className={styles.banner} role="status" aria-live="polite">
      <WifiOffIcon className={styles.bannerIcon} />
      <span className={styles.message}>You’re offline. Changes will sync when you reconnect.</span>
      <button
        type="button"
        className={styles.dismiss}
        onClick={onDismiss}
        aria-label="Dismiss offline notice"
      >
        <span aria-hidden="true">×</span>
      </button>
    </div>
  );
}

interface OfflineStatusIconProps {
  onShowNotice: () => void;
}

export function OfflineStatusIcon({ onShowNotice }: OfflineStatusIconProps) {
  return (
    <button
      type="button"
      className={styles.statusButton}
      onClick={onShowNotice}
      aria-label="Offline. Show connection notice"
      title="Offline"
    >
      <WifiOffIcon />
    </button>
  );
}

function WifiOffIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M12 20h.01" />
      <path d="M8.5 16.5a5 5 0 0 1 7 0" />
      <path d="M5 12.5a10 10 0 0 1 3.1-2" />
      <path d="M14.5 9.6a10 10 0 0 1 4.5 2.9" />
      <path d="M2 8.5a15 15 0 0 1 2.2-1.4" />
      <path d="M9.7 5.3A15 15 0 0 1 22 8.5" />
      <path d="m2 2 20 20" />
    </svg>
  );
}
