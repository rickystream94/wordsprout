import { NavLink, Link, Outlet } from 'react-router-dom';
import { useTheme } from '../../store/ThemeContext';
import { useBackButtonExit } from '../../hooks/useBackButtonExit';
import ExitToast from '../common/ExitToast';
import OfflineIndicator from '../common/OfflineIndicator';
import SyncIndicator from '../common/SyncIndicator';
import UserMenu from './UserMenu';
import styles from './AppShell.module.css';

export default function AppShell() {
  const { theme, toggleTheme } = useTheme();
  const { showExitToast } = useBackButtonExit();

  return (
    <div className={styles.shell}>
      <header className={styles.header}>
        <NavLink to="/" className={styles.logo}>
          <img src="/favicon.svg" alt="" aria-hidden="true" className={styles.logoIcon} />
          WordSprout
        </NavLink>
        <nav className={styles.nav}>
          <NavLink to="/" end className={({ isActive }) => isActive ? styles.activeLink : styles.link}>
            <svg width="15" height="15" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path d="M1.5 14.25V7.5l6.5-5.5 6.5 5.5v6.75a.75.75 0 0 1-.75.75H10v-4.5H6v4.5H2.25a.75.75 0 0 1-.75-.75Z"/></svg>
            <span className={styles.navLabel}>Phrasebooks</span>
          </NavLink>
          <NavLink to="/search" className={({ isActive }) => isActive ? styles.activeLink : styles.link}>
            <svg width="15" height="15" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path d="M10.68 11.74a6 6 0 0 1-7.922-8.982 6 6 0 0 1 8.982 7.922l3.04 3.04a.749.749 0 0 1-.326 1.275.749.749 0 0 1-.734-.215ZM11.5 7a4.499 4.499 0 1 0-8.997 0A4.499 4.499 0 0 0 11.5 7Z"/></svg>
            <span className={styles.navLabel}>Search</span>
          </NavLink>
          <NavLink to="/review" className={({ isActive }) => isActive ? styles.activeLink : styles.link}>
            <svg width="15" height="15" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path d="M0 1.75A.75.75 0 0 1 .75 1h4.253c1.227 0 2.317.59 3 1.501A3.743 3.743 0 0 1 11.006 1h4.245a.75.75 0 0 1 .75.75v10.5a.75.75 0 0 1-.75.75h-4.507a2.25 2.25 0 0 0-1.591.659l-.622.621a.75.75 0 0 1-1.06 0l-.622-.621A2.25 2.25 0 0 0 5.258 13H.75a.75.75 0 0 1-.75-.75Zm7.251 10.324.004-5.073-.002-2.253A2.25 2.25 0 0 0 5.003 2.5H1.5v9h3.757a3.75 3.75 0 0 1 1.994.574ZM8.755 4.75l-.004 7.322a3.752 3.752 0 0 1 1.992-.572H14.5v-9h-3.495a2.25 2.25 0 0 0-2.25 2.25Z"/></svg>
            <span className={styles.navLabel}>Review</span>
          </NavLink>
          <NavLink to="/about" className={({ isActive }) => isActive ? styles.activeLink : styles.link}>
            <svg width="15" height="15" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path d="M0 8a8 8 0 1 1 16 0A8 8 0 0 1 0 8Zm8-6.5a6.5 6.5 0 1 0 0 13 6.5 6.5 0 0 0 0-13ZM6.5 7.75A.75.75 0 0 1 7.25 7h1a.75.75 0 0 1 .75.75v2.75h.25a.75.75 0 0 1 0 1.5h-2a.75.75 0 0 1 0-1.5h.25v-2h-.25a.75.75 0 0 1-.75-.75ZM8 6a1 1 0 1 1 0-2 1 1 0 0 1 0 2Z"/></svg>
            <span className={styles.navLabel}>About</span>
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
          <UserMenu />
        </div>
      </header>
      <main className={styles.content}>
        <Outlet />
      </main>
      <footer className={styles.footer}>
        <Link to="/about" className={styles.footerLink}>About</Link>
        <span aria-hidden="true" className={styles.footerSep}>·</span>
        <Link to="/privacy" className={styles.footerLink}>Privacy Policy</Link>
        <span aria-hidden="true" className={styles.footerSep}>·</span>
        <Link to="/terms" className={styles.footerLink}>Terms &amp; Conditions</Link>
      </footer>
      <OfflineIndicator />
      <ExitToast visible={showExitToast} />
      <nav className={styles.bottomNav} aria-label="Main navigation">
        <NavLink to="/" end className={({ isActive }) => isActive ? styles.bottomNavItemActive : styles.bottomNavItem}>
          <svg width="22" height="22" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path d="M1.5 14.25V7.5l6.5-5.5 6.5 5.5v6.75a.75.75 0 0 1-.75.75H10v-4.5H6v4.5H2.25a.75.75 0 0 1-.75-.75Z"/></svg>
          <span>Phrasebooks</span>
        </NavLink>
        <NavLink to="/search" className={({ isActive }) => isActive ? styles.bottomNavItemActive : styles.bottomNavItem}>
          <svg width="22" height="22" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path d="M10.68 11.74a6 6 0 0 1-7.922-8.982 6 6 0 0 1 8.982 7.922l3.04 3.04a.749.749 0 0 1-.326 1.275.749.749 0 0 1-.734-.215ZM11.5 7a4.499 4.499 0 1 0-8.997 0A4.499 4.499 0 0 0 11.5 7Z"/></svg>
          <span>Search</span>
        </NavLink>
        <NavLink to="/review" className={({ isActive }) => isActive ? styles.bottomNavItemActive : styles.bottomNavItem}>
          <svg width="22" height="22" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path d="M0 1.75A.75.75 0 0 1 .75 1h4.253c1.227 0 2.317.59 3 1.501A3.743 3.743 0 0 1 11.006 1h4.245a.75.75 0 0 1 .75.75v10.5a.75.75 0 0 1-.75.75h-4.507a2.25 2.25 0 0 0-1.591.659l-.622.621a.75.75 0 0 1-1.06 0l-.622-.621A2.25 2.25 0 0 0 5.258 13H.75a.75.75 0 0 1-.75-.75Zm7.251 10.324.004-5.073-.002-2.253A2.25 2.25 0 0 0 5.003 2.5H1.5v9h3.757a3.75 3.75 0 0 1 1.994.574ZM8.755 4.75l-.004 7.322a3.752 3.752 0 0 1 1.992-.572H14.5v-9h-3.495a2.25 2.25 0 0 0-2.25 2.25Z"/></svg>
          <span>Review</span>
        </NavLink>
        <NavLink to="/about" className={({ isActive }) => isActive ? styles.bottomNavItemActive : styles.bottomNavItem}>
          <svg width="22" height="22" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path d="M0 8a8 8 0 1 1 16 0A8 8 0 0 1 0 8Zm8-6.5a6.5 6.5 0 1 0 0 13 6.5 6.5 0 0 0 0-13ZM6.5 7.75A.75.75 0 0 1 7.25 7h1a.75.75 0 0 1 .75.75v2.75h.25a.75.75 0 0 1 0 1.5h-2a.75.75 0 0 1 0-1.5h.25v-2h-.25a.75.75 0 0 1-.75-.75ZM8 6a1 1 0 1 1 0-2 1 1 0 0 1 0 2Z"/></svg>
          <span>About</span>
        </NavLink>
      </nav>
    </div>
  );
}
