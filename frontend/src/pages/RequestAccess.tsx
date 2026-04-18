import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { API_BASE } from '../config/env';
import { useAuth } from '../auth/AuthProvider';
import styles from './RequestAccess.module.css';

type FormState = 'idle' | 'submitting' | 'error';

export default function RequestAccess() {
  const { sub, email: authEmail } = useAuth();
  const navigate = useNavigate();
  const [state, setState] = useState<FormState>('idle');
  const [errorMsg, setErrorMsg] = useState('');

  // authEmail is always set here — /request-access is behind AuthenticatedRoute
  const email = authEmail ?? '';

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setState('submitting');

    try {
      const response = await fetch(`${API_BASE}/access-requests`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, ...(sub ? { sub } : {}) }),
      });

      if (response.status === 429) {
        setErrorMsg('Too many requests. Please try again later.');
        setState('error');
        return;
      }

      if (!response.ok) {
        const data = await response.json().catch(() => ({})) as { message?: string };
        setErrorMsg(data.message ?? 'Something went wrong. Please try again.');
        setState('error');
        return;
      }

      // Persist flag so AccessBlocked can show the pending view
      if (sub) localStorage.setItem(`ws:access_req:${sub}`, '1');
      navigate('/access-blocked', { replace: true });
    } catch {
      setErrorMsg('Network error. Please check your connection and try again.');
      setState('error');
    }
  }

  return (
    <main className={styles.page}>
      <div className={styles.card}>
        <div className={styles.logo} aria-hidden="true">📖</div>
        <h1 className={styles.title}>Request Access</h1>
        <p className={styles.desc}>
          WordSprout is currently invite-only. Confirm your email and we'll let you know when a spot opens up.
        </p>

        <form className={styles.form} onSubmit={handleSubmit} noValidate>
          <div className={styles.field}>
            <label htmlFor="request-email" className={styles.label}>Email address</label>
            <input
              id="request-email"
              type="email"
              className={`${styles.input} ${styles.inputReadOnly}`}
              value={email}
              readOnly
              disabled={state === 'submitting'}
            />
          </div>

          {state === 'error' && <p className={styles.errorMsg}>{errorMsg}</p>}

          <button
            type="submit"
            className={styles.submitBtn}
            disabled={state === 'submitting'}
          >
            {state === 'submitting' ? 'Sending…' : 'Request access'}
          </button>
        </form>

        <button type="button" onClick={() => navigate('/access-blocked')} className={styles.backLink}>← Back</button>
      </div>
    </main>
  );
}
