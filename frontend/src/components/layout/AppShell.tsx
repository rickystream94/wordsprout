import { NavLink, Outlet } from 'react-router-dom';
import { useTheme } from '../../store/ThemeContext';
import OfflineIndicator from '../common/OfflineIndicator';
import SyncIndicator from '../common/SyncIndicator';
import styles from './AppShell.module.css';

export default function AppShell() {
  const { theme, toggleTheme } = useTheme();

  return (
    <div className={styles.shell}>
      <header className={styles.header}>
        <NavLink to="/" className={styles.logo}>
          <img src="/favicon.svg" alt="" aria-hidden="true" className={styles.logoIcon} />
          WordSprout
        </NavLink>
        <nav className={styles.nav}>
          <NavLink to="/" end className={({ isActive }) => isActive ? styles.activeLink : styles.link}>
            Phrasebooks
          </NavLink>
          <NavLink to="/search" className={({ isActive }) => isActive ? styles.activeLink : styles.link}>
            Search
          </NavLink>
          <NavLink to="/review" className={({ isActive }) => isActive ? styles.activeLink : styles.link}>
            Review
          </NavLink>
        </nav>
        <div className={styles.actions}>
          <SyncIndicator />
          <button
            onClick={toggleTheme}
            aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
            className={styles.themeToggle}
          >
            {theme === 'light' ? '🌙' : '☀️'}
          </button>
        </div>
      </header>
      <main className={styles.content}>
        <Outlet />
      </main>
      <OfflineIndicator />
    </div>
  );
}
