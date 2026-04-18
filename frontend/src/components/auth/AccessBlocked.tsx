import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../auth/AuthProvider';
import styles from './AccessBlocked.module.css';

export default function AccessBlocked() {
  const navigate = useNavigate();
  const { sub, logout } = useAuth();

  // Check if a request was already submitted for this account in this browser
  const alreadyRequested = sub ? localStorage.getItem(`ws:access_req:${sub}`) === '1' : false;

  if (alreadyRequested) {
    return (
      <div className={styles.container} role="status">
        <div className={styles.icon} aria-hidden="true">⏳</div>
        <h2 className={styles.title}>Request pending</h2>
        <p className={styles.desc}>
          Your access request has been received. We'll review it shortly.
          Check back later or try signing in again after you've been approved.
        </p>
        <div className={styles.actions}>
          <button
            className={styles.switchBtn}
            onClick={async () => { await logout(); }}
            type="button"
          >
            Sign out
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container} role="alert">
      <div className={styles.icon} aria-hidden="true">🔒</div>
      <h2 className={styles.title}>Access not granted</h2>
      <p className={styles.desc}>
        Your account isn't on the allow list yet. WordSprout is currently invite-only.
      </p>
      <div className={styles.actions}>
        <button
          className={styles.requestBtn}
          onClick={() => navigate('/request-access')}
          type="button"
        >
          Request access
        </button>
        <button
          className={styles.switchBtn}
          onClick={async () => { await logout(); }}
          type="button"
        >
          Try a different account
        </button>
      </div>
    </div>
  );
}
