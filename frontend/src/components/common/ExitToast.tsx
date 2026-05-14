import styles from './ExitToast.module.css';

interface ExitToastProps {
  visible: boolean;
}

export default function ExitToast({ visible }: ExitToastProps) {
  if (!visible) return null;

  return (
    <div className={styles.toast} role="status" aria-live="polite">
      Press back again to exit
    </div>
  );
}
