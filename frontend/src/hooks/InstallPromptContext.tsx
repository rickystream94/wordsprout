import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { InstallPromptContext } from './installPromptContext';

/** Non-standard browser event; only available on Android/Chrome/Edge/Samsung. */
interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  readonly userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const DISMISSED_KEY = 'ws_install_dismissed_at';
const ENGAGED_KEY = 'ws_install_engaged';
const DISMISS_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

function detectIOSSafari(): boolean {
  const ua = navigator.userAgent;
  return (
    /iPhone|iPad|iPod/i.test(ua) &&
    /Safari/i.test(ua) &&
    !/CriOS|FxiOS|EdgiOS|OPiOS/i.test(ua)
  );
}

function detectInstalled(): boolean {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    window.matchMedia('(display-mode: fullscreen)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

function detectMobile(): boolean {
  return (
    /iPhone|iPad|iPod|Android/i.test(navigator.userAgent) ||
    (window.matchMedia('(max-width: 640px)').matches && 'ontouchstart' in window)
  );
}

function isDismissedRecently(): boolean {
  const val = localStorage.getItem(DISMISSED_KEY);
  if (!val) return false;
  return Date.now() - Number(val) < DISMISS_TTL_MS;
}

export function InstallPromptProvider({ children }: { children: ReactNode }) {
  const deferredPrompt = useRef<BeforeInstallPromptEvent | null>(null);
  const [canPromptAndroid, setCanPromptAndroid] = useState(false);
  const [isInstalled, setIsInstalled] = useState(detectInstalled);
  const [dismissed, setDismissed] = useState(isDismissedRecently);
  const [hasEngaged, setHasEngaged] = useState(
    () => sessionStorage.getItem(ENGAGED_KEY) === '1',
  );

  const ios = detectIOSSafari();
  const mobile = detectMobile();

  useEffect(() => {
    function handleBeforeInstall(e: Event) {
      e.preventDefault();
      deferredPrompt.current = e as BeforeInstallPromptEvent;
      setCanPromptAndroid(true);
    }

    function handleAppInstalled() {
      deferredPrompt.current = null;
      setCanPromptAndroid(false);
      setIsInstalled(true);
    }

    window.addEventListener('beforeinstallprompt', handleBeforeInstall);
    window.addEventListener('appinstalled', handleAppInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const markEngaged = useCallback(() => {
    if (hasEngaged) return;
    sessionStorage.setItem(ENGAGED_KEY, '1');
    setHasEngaged(true);
  }, [hasEngaged]);

  const prompt = useCallback(async () => {
    if (!deferredPrompt.current) return;
    await deferredPrompt.current.prompt();
    const { outcome } = await deferredPrompt.current.userChoice;
    if (outcome === 'accepted') {
      deferredPrompt.current = null;
      setCanPromptAndroid(false);
    }
  }, []);

  const dismiss = useCallback(() => {
    localStorage.setItem(DISMISSED_KEY, String(Date.now()));
    setDismissed(true);
  }, []);

  const showBanner =
    !isInstalled &&
    !dismissed &&
    hasEngaged &&
    mobile &&
    (canPromptAndroid || ios);

  return (
    <InstallPromptContext.Provider
      value={{
        canPromptAndroid,
        isIOS: ios,
        isInstalled,
        isMobile: mobile,
        hasEngaged,
        showBanner,
        markEngaged,
        prompt,
        dismiss,
      }}
    >
      {children}
    </InstallPromptContext.Provider>
  );
}

