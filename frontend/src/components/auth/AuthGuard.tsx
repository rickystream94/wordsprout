import { useEffect, useState } from 'react';
import { Navigate, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../../auth/useAuth';
import { quotaApi } from '../../services/api';
import { ApiRequestError } from '../../services/api';
import {
  hasInitialStartupSyncCompleted,
  markInitialStartupSyncCompleted,
  runInitialStartupSync,
  runOfflineDecay,
  type StartupSyncProgress,
} from '../../services/startupSync';
import styles from './AuthGuard.module.css';

const loadingMessages = [
  'Sprouting words…',
  'Watering vocabulary…',
  'Growing phrases…',
  'Planting syllables…',
  'Unfurling sentences…',
];

const loadingMessage = loadingMessages[Math.floor(Math.random() * loadingMessages.length)];

function LoadingSpinner() {
  return (
    <div className={styles.loadingContainer}>
      <img src="/icons/wordsprout-logo.png" alt="WordSprout" className={styles.logo} />
      <div className={styles.spinner} />
      <span className={styles.loadingText} aria-live="polite" aria-busy="true">
        {loadingMessage}
      </span>
    </div>
  );
}

const INITIAL_SYNC_PROGRESS: StartupSyncProgress = {
  stage: 'uploading',
  completedSteps: 0,
  totalSteps: 4,
  percent: 0,
};

const progressLabels: Record<StartupSyncProgress['stage'], string> = {
  uploading: 'Uploading saved changes',
  downloading: 'Downloading your vocabulary',
  decaying: 'Updating learning scores',
  finalizing: 'Saving final changes',
};

function SyncProgress({ progress }: { progress: StartupSyncProgress }) {
  const progressLabel = progressLabels[progress.stage];
  return (
    <div className={styles.loadingContainer}>
      <img src="/icons/wordsprout-logo.png" alt="WordSprout" className={styles.logo} />
      <div
        className={styles.progressTrack}
        role="progressbar"
        aria-label="Startup synchronization"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={progress.percent}
        aria-valuetext={`${progressLabel}: ${progress.completedSteps} of ${progress.totalSteps} steps complete`}
      >
        <div className={styles.progressFill} style={{ width: `${progress.percent}%` }} />
      </div>
      <span className={styles.loadingText} aria-live="polite" aria-busy="true">
        Syncing your vocabulary. Hang tight…
      </span>
      <span className={styles.progressText} aria-live="polite">
        {progressLabel} · {progress.percent}%
      </span>
    </div>
  );
}

interface SyncFailureProps {
  continuingOffline: boolean;
  onRetry: () => void;
  onContinueOffline: () => void;
}

function SyncFailure({ continuingOffline, onRetry, onContinueOffline }: SyncFailureProps) {
  return (
    <div className={styles.loadingContainer} role="alert">
      <img src="/icons/wordsprout-logo.png" alt="WordSprout" className={styles.logo} />
      <h1 className={styles.failureTitle}>We couldn’t finish syncing</h1>
      <p className={styles.failureText}>
        Check your connection and try again, or continue with the vocabulary saved on this device.
      </p>
      <div className={styles.failureActions}>
        <button
          type="button"
          className={styles.secondaryButton}
          onClick={onContinueOffline}
          disabled={continuingOffline}
        >
          {continuingOffline ? 'Preparing offline…' : 'Continue offline'}
        </button>
        <button
          type="button"
          className={styles.primaryButton}
          onClick={onRetry}
          disabled={continuingOffline}
        >
          Retry
        </button>
      </div>
    </div>
  );
}

type StartupState = 'checking' | 'syncing' | 'failed' | 'allowed';

/**
 * Wraps protected routes.
 * - Redirects to /login if not OAuth-authenticated.
 * - Probes GET /api/users/me/quota to verify allow-list membership.
 * - Redirects to /access-blocked on 403.
 * - Renders a loading state while the probe is in-flight.
 */
export default function AuthGuard() {
  const { isAuthenticated, sessionRestoring, userId } = useAuth();
  const navigate = useNavigate();
  const [startupState, setStartupState] = useState<StartupState>(
    navigator.onLine && (!userId || !hasInitialStartupSyncCompleted(userId))
      ? 'checking'
      : 'allowed',
  );
  const [attempt, setAttempt] = useState(0);
  const [continuingOffline, setContinuingOffline] = useState(false);
  const [syncProgress, setSyncProgress] = useState(INITIAL_SYNC_PROGRESS);

  useEffect(() => {
    if (!isAuthenticated || sessionRestoring || !userId) return;

    if (hasInitialStartupSyncCompleted(userId)) return;

    if (!navigator.onLine) {
      markInitialStartupSyncCompleted(userId);
      runOfflineDecay(userId).catch(console.error);
      return;
    }

    const currentUserId = userId;
    let cancelled = false;

    async function initialize() {
      setStartupState('checking');
      try {
        await quotaApi.get();
        if (cancelled) return;

        setStartupState('syncing');
        await runInitialStartupSync(currentUserId, {
          onProgressChange: (progress) => {
            if (!cancelled) setSyncProgress(progress);
          },
        });
        if (!cancelled) setStartupState('allowed');
      } catch (err: unknown) {
        if (cancelled) return;
        if (err instanceof ApiRequestError && err.statusCode === 403) {
          navigate('/access-blocked', { replace: true });
        } else if (err instanceof ApiRequestError && err.statusCode === 401) {
          navigate('/login', { replace: true });
        } else {
          setStartupState('failed');
        }
      }
    }

    void initialize();
    return () => {
      cancelled = true;
    };
  }, [attempt, isAuthenticated, navigate, sessionRestoring, userId]);

  async function continueOffline() {
    if (!userId) return;
    setContinuingOffline(true);
    try {
      await runOfflineDecay(userId);
      markInitialStartupSyncCompleted(userId);
      setStartupState('allowed');
    } catch {
      setContinuingOffline(false);
    }
  }

  if (sessionRestoring || (isAuthenticated && !userId)) return <LoadingSpinner />;

  if (!isAuthenticated) return <Navigate to="/login" replace />;

  if (startupState === 'checking') return <LoadingSpinner />;
  if (startupState === 'syncing') return <SyncProgress progress={syncProgress} />;
  if (startupState === 'failed') {
    return (
      <SyncFailure
        continuingOffline={continuingOffline}
        onRetry={() => {
          setContinuingOffline(false);
          setAttempt((value) => value + 1);
        }}
        onContinueOffline={() => {
          void continueOffline();
        }}
      />
    );
  }

  return <Outlet />;
}
