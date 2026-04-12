import AccessBlocked from '../components/auth/AccessBlocked';
import styles from './AccessBlockedPage.module.css';

export default function AccessBlockedPage() {
  return (
    <main className={styles.page}>
      <AccessBlocked />
    </main>
  );
}
