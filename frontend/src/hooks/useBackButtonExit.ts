import { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';

const TOAST_DURATION_MS = 2000;

/**
 * Intercepts the Android hardware back button when the user is on the home
 * page (`/`) of the installed PWA (standalone display mode).
 *
 * Behaviour:
 *  - First back press: shows "Press back again to exit" toast for 2 seconds.
 *  - Second back press within those 2 seconds: calls `window.close()` to exit.
 *  - No-op in a regular browser tab (display-mode guard).
 *  - No-op on iOS (no hardware back button in standalone mode).
 *
 * Returns `showExitToast` — render a toast while it is `true`.
 */
export function useBackButtonExit(): { showExitToast: boolean } {
  const location = useLocation();
  const [showExitToast, setShowExitToast] = useState(false);

  // Whether the first back press already happened and we're waiting for the second.
  const awaitingSecondPress = useRef(false);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // True when running as an installed PWA (standalone / fullscreen display mode).
  const isStandalone =
    window.matchMedia('(display-mode: standalone)').matches ||
    window.matchMedia('(display-mode: fullscreen)').matches ||
    // iOS Safari legacy check
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true;

  const isHomePage = location.pathname === '/';

  useEffect(() => {
    if (!isStandalone || !isHomePage) return;

    // Push a sentinel history entry so the first back press doesn't leave the app.
    window.history.pushState({ exitBlock: true }, '');

    function handlePopState() {
      if (awaitingSecondPress.current) {
        // Second press within the window — close the app.
        window.close();
        // Fallback: if window.close() is blocked, keep user on home page.
        window.history.pushState({ exitBlock: true }, '');
        return;
      }

      // First press — show toast and re-push sentinel.
      window.history.pushState({ exitBlock: true }, '');
      awaitingSecondPress.current = true;
      setShowExitToast(true);

      // Auto-dismiss after TOAST_DURATION_MS.
      if (toastTimer.current) clearTimeout(toastTimer.current);
      toastTimer.current = setTimeout(() => {
        awaitingSecondPress.current = false;
        setShowExitToast(false);
        toastTimer.current = null;
      }, TOAST_DURATION_MS);
    }

    window.addEventListener('popstate', handlePopState);

    return () => {
      window.removeEventListener('popstate', handlePopState);
      if (toastTimer.current) {
        clearTimeout(toastTimer.current);
        toastTimer.current = null;
      }
      // Clean up state when leaving home page.
      awaitingSecondPress.current = false;
      setShowExitToast(false);
    };
  }, [isStandalone, isHomePage]);

  return { showExitToast };
}
