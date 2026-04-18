import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { GoogleLogin } from '@react-oauth/google';
import { useAuth } from '../auth/AuthProvider';
import { useTheme } from '../store/ThemeContext';
import styles from './Login.module.css';

function MicrosoftLogo() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 21 21" aria-hidden="true">
      <rect x="1"  y="1"  width="9" height="9" fill="#f25022" />
      <rect x="11" y="1"  width="9" height="9" fill="#7fba00" />
      <rect x="1"  y="11" width="9" height="9" fill="#00a4ef" />
      <rect x="11" y="11" width="9" height="9" fill="#ffb900" />
    </svg>
  );
}

export default function Login() {
  const { loginWithMicrosoft, loginWithGoogle, isAuthenticated } = useAuth();
  const { theme } = useTheme();
  const navigate = useNavigate();

  // Redirect if already signed in
  useEffect(() => {
    if (isAuthenticated) navigate('/', { replace: true });
  }, [isAuthenticated, navigate]);

  return (
    <main className={styles.page}>
      <div className={styles.card}>
        <div className={styles.logoGroup} aria-hidden="true">
          <span className={styles.logoEmoji}>🌱</span>
          <span className={styles.logoEmojiMain}>📖</span>
          <span className={styles.logoEmoji}>✨</span>
        </div>
        <h1 className={styles.title}>WordSprout</h1>
        <p className={styles.tagline}>Grow your words.</p>
        <p className={styles.description}>Your personal vocabulary notebook — capture words you encounter, then master them through adaptive flashcard review.</p>

        <div className={styles.signInButtons}>
          <button className={styles.msBtn} onClick={loginWithMicrosoft}>
            <MicrosoftLogo />
            Sign in with Microsoft
          </button>
          <div className={styles.divider}><span>or</span></div>
          <div className={styles.googleBtnWrapper}>
            <GoogleLogin
              onSuccess={({ credential }) => {
                if (credential) {
                  loginWithGoogle(credential);
                  navigate('/', { replace: true });
                }
              }}
              onError={() => navigate('/access-blocked')}
              useOneTap={false}
              width="320"
              theme={theme === 'dark' ? 'filled_black' : 'outline'}
            />
          </div>
        </div>
      </div>
    </main>
  );
}
