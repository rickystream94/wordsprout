import { useInstallPrompt } from '../../hooks/useInstallPrompt';
import styles from './InstallBanner.module.css';

export default function InstallBanner() {
  const { showBanner, isIOS, canPromptAndroid, prompt, dismiss } = useInstallPrompt();

  if (!showBanner) return null;

  return (
    <div className={styles.banner} role="complementary" aria-label="Install app prompt">
      <img
        src="/favicon.svg"
        alt=""
        aria-hidden="true"
        className={styles.appIcon}
      />

      <div className={styles.body}>
        <p className={styles.title}>Add to Home Screen</p>

        {canPromptAndroid && !isIOS && (
          <>
            <p className={styles.description}>
              Install WordSprout for quick access — no browser needed.
            </p>
            <div className={styles.actions}>
              <button className={styles.installBtn} onClick={prompt}>
                Install
              </button>
            </div>
          </>
        )}

        {isIOS && (
          <p className={styles.description}>
            Tap the{' '}
            <span className={styles.shareIcon} aria-label="Share">
              {/* Safari share icon */}
              <svg
                width="11"
                height="14"
                viewBox="0 0 11 14"
                fill="currentColor"
                aria-hidden="true"
              >
                <path d="M5.5 0 2 3.5h2V9h3V3.5h2L5.5 0zM0 11v2a1 1 0 0 0 1 1h9a1 1 0 0 0 1-1v-2h-1v2H1v-2H0z" />
              </svg>
            </span>{' '}
            Share button, then tap{' '}
            <strong>Add to Home Screen</strong>.
          </p>
        )}
      </div>

      <button
        className={styles.dismissBtn}
        onClick={dismiss}
        aria-label="Dismiss install prompt"
      >
        ✕
      </button>
    </div>
  );
}
