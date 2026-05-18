import { useEffect, useRef } from 'react';

export interface UseSwipeOptions {
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  /** Minimum horizontal travel in px to register as a swipe. Default: 50 */
  threshold?: number;
}

/**
 * Attaches touch-based swipe detection to a DOM element via a ref.
 * Fires `onSwipeLeft` when horizontal delta ≤ −threshold,
 * and `onSwipeRight` when delta ≥ +threshold.
 * Cleans up event listeners on unmount.
 * No-op when the ref element is null (non-touch devices).
 */
export function useSwipe<T extends HTMLElement>(
  options: UseSwipeOptions,
): React.RefObject<T | null> {
  const { onSwipeLeft, onSwipeRight, threshold = 50 } = options;
  const ref = useRef<T | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    let startX = 0;

    function handleTouchStart(e: TouchEvent) {
      startX = e.touches[0]?.clientX ?? 0;
    }

    function handleTouchEnd(e: TouchEvent) {
      const endX = e.changedTouches[0]?.clientX ?? 0;
      const delta = endX - startX;
      if (delta <= -threshold) {
        onSwipeLeft?.();
      } else if (delta >= threshold) {
        onSwipeRight?.();
      }
    }

    el.addEventListener('touchstart', handleTouchStart, { passive: true });
    el.addEventListener('touchend', handleTouchEnd, { passive: true });

    return () => {
      el.removeEventListener('touchstart', handleTouchStart);
      el.removeEventListener('touchend', handleTouchEnd);
    };
  }, [onSwipeLeft, onSwipeRight, threshold]);

  return ref;
}
