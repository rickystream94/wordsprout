import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../../auth/AuthProvider';
import styles from './UserMenu.module.css';

export default function UserMenu() {
  const { email, provider, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const initial = email ? email[0].toUpperCase() : '?';
  const providerLabel = provider === 'google' ? 'Google' : 'Microsoft';

  // Close on click outside
  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [open]);

  return (
    <div className={styles.container} ref={menuRef}>
      <button
        className={styles.avatar}
        aria-label={`Account menu for ${email ?? 'user'}`}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        {initial}
      </button>

      {open && (
        <div className={styles.dropdown} role="menu" aria-label="Account menu">
          <div className={styles.userInfo}>
            <span className={styles.email}>{email}</span>
            <span className={styles.provider}>{providerLabel}</span>
          </div>
          <hr className={styles.separator} />
          <button
            className={styles.signOutBtn}
            role="menuitem"
            onClick={async () => {
              setOpen(false);
              await logout();
            }}
          >
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}
