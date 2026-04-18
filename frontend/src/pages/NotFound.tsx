import { useNavigate } from 'react-router-dom';
import styles from './NotFound.module.css';

export default function NotFound() {
  const navigate = useNavigate();
  return (
    <main className={styles.page}>
      <div className={styles.card}>
        <span className={styles.code}>404</span>
        <h1 className={styles.title}>Page not found</h1>
        <p className={styles.description}>
          The page you're looking for doesn't exist.
        </p>
        <button type="button" className={styles.homeBtn} onClick={() => navigate('/')}>
          Go to home
        </button>
      </div>
    </main>
  );
}
