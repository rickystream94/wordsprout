import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../../auth/AuthProvider';
import { deleteAccount } from '../../services/api';
import { clearLocalData } from '../../services/db';
import styles from './UserMenu.module.css';

type DeleteState = 'idle' | 'confirming' | 'deleting' | 'error';

export default function UserMenu() {
  const { email, provider, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const [deleteState, setDeleteState] = useState<DeleteState>('idle');
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

  async function handleConfirmDelete() {
    setDeleteState('deleting');
    try {
      await deleteAccount();
      await clearLocalData();
      await logout();
      window.location.replace('/login');
    } catch {
      // FR-007: MUST NOT clear local data or call logout if the API call fails
      setDeleteState('error');
    }
  }

  return (
    <>
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
            <hr className={styles.separator} />
            {deleteState === 'error' && (
              <p className={styles.errorMsg}>Deletion failed. Please try again.</p>
            )}
            <button
              className={styles.deleteBtn}
              role="menuitem"
              disabled={deleteState === 'deleting'}
              onClick={() => {
                setOpen(false);
                setDeleteState('confirming');
              }}
            >
              {deleteState === 'deleting' ? 'Deleting…' : 'Delete Account'}
            </button>
          </div>
        )}
      </div>

      {deleteState === 'confirming' && (
        <div className={styles.dialog} role="dialog" aria-modal="true" aria-labelledby="delete-dialog-title">
          <div className={styles.dialogBox}>
            <h2 className={styles.dialogTitle} id="delete-dialog-title">
              Permanently delete your account?
            </h2>
            <div className={styles.dialogBody}>
              <p>This will immediately and permanently delete all of your data, including:</p>
              <ul>
                <li>All phrasebooks</li>
                <li>All vocabulary entries</li>
                <li>All notes and tags</li>
                <li>All learning progress and review history</li>
                <li>Your account data</li>
              </ul>
              <p>This action cannot be undone.</p>
            </div>
            <div className={styles.dialogActions}>
              <button
                className={styles.cancelBtn}
                onClick={() => setDeleteState('idle')}
              >
                Cancel
              </button>
              <button
                className={styles.confirmBtn}
                onClick={handleConfirmDelete}
              >
                Yes, delete everything
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
