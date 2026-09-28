import {
  useState,
  useCallback,
  useId,
  useLayoutEffect,
  useRef,
  type CSSProperties,
  type ReactNode,
  type KeyboardEvent,
} from 'react';
import { createPortal } from 'react-dom';
import styles from './Tooltip.module.css';

interface TooltipProps {
  text: string;
  children: ReactNode;
}

const VIEWPORT_MARGIN = 12;
const TRIGGER_GAP = 8;

interface TooltipPosition {
  top: number;
  left: number;
  caretLeft: number;
  placement: 'above' | 'below';
}

export default function Tooltip({ text, children }: TooltipProps) {
  const [pinned, setPinned] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [position, setPosition] = useState<TooltipPosition | null>(null);
  const tooltipId = useId();
  const iconRef = useRef<HTMLSpanElement>(null);
  const bubbleRef = useRef<HTMLSpanElement>(null);

  const open = pinned || hovered || focused;
  const toggle = useCallback(() => setPinned(value => !value), []);
  const close = useCallback(() => {
    setPinned(false);
    setFocused(false);
  }, []);

  const handleKeyDown = useCallback((e: KeyboardEvent<HTMLSpanElement>) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      toggle();
    }
    if (e.key === 'Escape') close();
  }, [toggle, close]);

  useLayoutEffect(() => {
    if (!open) return;

    function updatePosition() {
      const trigger = iconRef.current;
      const bubble = bubbleRef.current;
      if (!trigger || !bubble) return;

      const triggerRect = trigger.getBoundingClientRect();
      const bubbleRect = bubble.getBoundingClientRect();
      const triggerCenter = triggerRect.left + triggerRect.width / 2;
      const maxLeft = Math.max(VIEWPORT_MARGIN, window.innerWidth - VIEWPORT_MARGIN - bubbleRect.width);
      const left = Math.min(
        Math.max(triggerCenter - bubbleRect.width / 2, VIEWPORT_MARGIN),
        maxLeft,
      );
      const aboveTop = triggerRect.top - TRIGGER_GAP - bubbleRect.height;
      const placement = aboveTop >= VIEWPORT_MARGIN ? 'above' : 'below';
      const top = placement === 'above'
        ? aboveTop
        : triggerRect.bottom + TRIGGER_GAP;
      const caretLeft = Math.min(
        Math.max(triggerCenter - left, VIEWPORT_MARGIN),
        bubbleRect.width - VIEWPORT_MARGIN,
      );

      setPosition({ top, left, caretLeft, placement });
    }

    updatePosition();
    window.addEventListener('resize', updatePosition);
    window.addEventListener('orientationchange', updatePosition);
    window.addEventListener('scroll', updatePosition, true);
    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('orientationchange', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [open, text]);

  const bubbleStyle = position
    ? ({
        top: position.top,
        left: position.left,
        '--tooltip-caret-left': `${position.caretLeft}px`,
      } as CSSProperties)
    : undefined;

  return (
    <span
      className={styles.wrapper}
      data-open={pinned ? 'true' : undefined}
      tabIndex={0}
      aria-describedby={tooltipId}
      onClick={toggle}
      onFocus={() => setFocused(true)}
      onBlur={close}
      onKeyDown={handleKeyDown}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {children}
      <span ref={iconRef} className={styles.icon}>
        <span aria-hidden="true">ⓘ</span>
      </span>
      {open && createPortal(
        <span
          ref={bubbleRef}
          role="tooltip"
          id={tooltipId}
          className={styles.bubble}
          data-placement={position?.placement ?? 'above'}
          style={bubbleStyle}
        >
          {text}
        </span>,
        document.body,
      )}
    </span>
  );
}
