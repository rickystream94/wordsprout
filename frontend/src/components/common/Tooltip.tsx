import { useState, useCallback, useId, type ReactNode, type KeyboardEvent } from 'react';
import styles from './Tooltip.module.css';

interface TooltipProps {
  text: string;
  children: ReactNode;
}

export default function Tooltip({ text, children }: TooltipProps) {
  const [open, setOpen] = useState(false);
  const tooltipId = useId();

  const toggle = useCallback(() => setOpen(v => !v), []);
  const close = useCallback(() => setOpen(false), []);

  const handleKeyDown = useCallback((e: KeyboardEvent<HTMLSpanElement>) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      toggle();
    }
    if (e.key === 'Escape') close();
  }, [toggle, close]);

  return (
    <span
      className={styles.wrapper}
      data-open={open ? 'true' : undefined}
      tabIndex={0}
      aria-describedby={tooltipId}
      onClick={toggle}
      onBlur={close}
      onKeyDown={handleKeyDown}
    >
      {children}
      <span className={styles.icon}>
        <span aria-hidden="true">ⓘ</span>
        <span role="tooltip" id={tooltipId} className={styles.bubble}>
          {text}
        </span>
      </span>
    </span>
  );
}
