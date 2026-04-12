import { useNavigate } from 'react-router-dom';
import styles from './AccessBlocked.module.css';

export default function AccessBlocked() {
  const navigate = useNavigate();

  return (
    <div className={styles.container} role="alert">
      <div className={styles.icon} aria-hidden="true">🔒</div>
      <h2 className={styles.title}>Access not granted</h2>
      <p className={styles.desc}>
        Your account isn't on the allow list yet. VocaBook is currently invite-only.
      </p>
      <div className={styles.actions}>
        <button
          className={styles.requestBtn}
          onClick={() => navigate('/request-access')}
          type="button"
        >
          Request access
        </button>
      </div>
    </div>
  );
}
