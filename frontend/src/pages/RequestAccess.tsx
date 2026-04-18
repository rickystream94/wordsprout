import { useState } from 'react';
import { Link } from 'react-router-dom';
import { API_BASE } from '../config/env';
import styles from './RequestAccess.module.css';

type FormState = 'idle' | 'submitting' | 'success' | 'error';

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export default function RequestAccess() {
  const [email, setEmail] = useState('');
  const [state, setState] = useState<FormState>('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const [fieldError, setFieldError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    const trimmed = email.trim();
    if (!isValidEmail(trimmed)) {
      setFieldError('Please enter a valid email address.');
      return;
    }
    setFieldError('');
    setState('submitting');

    try {
      const response = await fetch(`${API_BASE}/access-requests`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: trimmed }),
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

      setState('success');
    } catch {
      setErrorMsg('Network error. Please check your connection and try again.');
      setState('error');
    }
  }

  if (state === 'success') {
    return (
      <main className={styles.page}>
        <div className={styles.card}>
          <div className={styles.successIcon} aria-hidden="true">✅</div>
          <h1 className={styles.title}>Request sent!</h1>
          <p className={styles.desc}>
            We've received your access request. We'll be in touch when a spot opens up.
          </p>
          <Link to="/login" className={styles.backLink}>← Back to sign in</Link>
        </div>
      </main>
    );
  }

  return (
    <main className={styles.page}>
      <div className={styles.card}>
        <div className={styles.logo} aria-hidden="true">📖</div>
        <h1 className={styles.title}>Request Access</h1>
        <p className={styles.desc}>
          WordSprout is currently invite-only. Enter your email and we'll let you know when a spot opens up.
        </p>

        <form className={styles.form} onSubmit={handleSubmit} noValidate>
          <div className={styles.field}>
            <label htmlFor="request-email" className={styles.label}>Email address</label>
            <input
              id="request-email"
              type="email"
              className={`${styles.input} ${fieldError ? styles.inputError : ''}`}
              value={email}
              onChange={(e) => { setEmail(e.target.value); setFieldError(''); }}
              placeholder="you@example.com"
              autoFocus
              disabled={state === 'submitting'}
            />
            {fieldError && <p className={styles.fieldError}>{fieldError}</p>}
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

        <Link to="/login" className={styles.backLink}>← Back to sign in</Link>
      </div>
    </main>
  );
}
