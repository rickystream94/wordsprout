import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
import styles from './Login.module.css';

export default function Login() {
  const { login, isAuthenticated } = useAuth();
  const navigate = useNavigate();

  // Redirect if already signed in
  useEffect(() => {
    if (isAuthenticated) navigate('/', { replace: true });
  }, [isAuthenticated, navigate]);

  return (
    <main className={styles.page}>
      <div className={styles.card}>
        <div className={styles.logo} aria-hidden="true">📖</div>
        <h1 className={styles.title}>VocaBook</h1>
        <p className={styles.tagline}>Your personal vocabulary phrasebook</p>

        <button className={styles.signInBtn} onClick={login}>
          Sign in with Microsoft / Google
        </button>

        <p className={styles.requestLink}>
          Don't have access?{' '}
          <a href="/request-access" className={styles.link} onClick={(e) => {
            e.preventDefault();
            navigate('/request-access');
          }}>
            Request an invite
          </a>
        </p>
      </div>
    </main>
  );
}
