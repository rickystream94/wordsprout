import { describe, it, expect, vi, afterEach } from 'vitest';
import React from 'react';
import { render } from '@testing-library/react';
import { useSwipe } from '../useSwipe';

// ─── Test wrapper component (no JSX — uses React.createElement) ───────────────

interface SwipeTargetProps {
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  threshold?: number;
}

function SwipeTarget(props: SwipeTargetProps): React.ReactElement {
  const ref = useSwipe<HTMLDivElement>(props);
  return React.createElement('div', { ref, 'data-testid': 'swipe-target' });
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function createTouch(clientX: number): Touch {
  return { clientX, identifier: 0, target: document.body, pageX: clientX, pageY: 0, radiusX: 0, radiusY: 0, rotationAngle: 0, force: 0 } as Touch;
}

function fireSwipe(element: Element, startX: number, endX: number): void {
  element.dispatchEvent(
    new TouchEvent('touchstart', {
      touches: [createTouch(startX)],
      changedTouches: [createTouch(startX)],
      bubbles: true,
    }),
  );
  element.dispatchEvent(
    new TouchEvent('touchend', {
      touches: [],
      changedTouches: [createTouch(endX)],
      bubbles: true,
    }),
  );
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('useSwipe', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('calls onSwipeLeft when horizontal delta exceeds threshold to the left', () => {
    const onLeft = vi.fn();
    const onRight = vi.fn();
    const { getByTestId } = render(React.createElement(SwipeTarget, { onSwipeLeft: onLeft, onSwipeRight: onRight, threshold: 50 }));
    fireSwipe(getByTestId('swipe-target'), 200, 100); // delta = -100
    expect(onLeft).toHaveBeenCalledTimes(1);
    expect(onRight).not.toHaveBeenCalled();
  });

  it('calls onSwipeRight when horizontal delta exceeds threshold to the right', () => {
    const onLeft = vi.fn();
    const onRight = vi.fn();
    const { getByTestId } = render(React.createElement(SwipeTarget, { onSwipeLeft: onLeft, onSwipeRight: onRight, threshold: 50 }));
    fireSwipe(getByTestId('swipe-target'), 100, 200); // delta = +100
    expect(onRight).toHaveBeenCalledTimes(1);
    expect(onLeft).not.toHaveBeenCalled();
  });

  it('calls neither callback when delta is below threshold', () => {
    const onLeft = vi.fn();
    const onRight = vi.fn();
    const { getByTestId } = render(React.createElement(SwipeTarget, { onSwipeLeft: onLeft, onSwipeRight: onRight, threshold: 50 }));
    fireSwipe(getByTestId('swipe-target'), 100, 130); // delta = +30, below threshold
    fireSwipe(getByTestId('swipe-target'), 100, 80);  // delta = -20, below threshold
    expect(onLeft).not.toHaveBeenCalled();
    expect(onRight).not.toHaveBeenCalled();
  });

  it('removes event listeners on unmount', () => {
    const removeSpy = vi.spyOn(HTMLElement.prototype, 'removeEventListener');
    const { unmount } = render(React.createElement(SwipeTarget, { onSwipeLeft: vi.fn() }));
    unmount();
    expect(removeSpy).toHaveBeenCalledWith('touchstart', expect.any(Function));
    expect(removeSpy).toHaveBeenCalledWith('touchend', expect.any(Function));
  });
});
