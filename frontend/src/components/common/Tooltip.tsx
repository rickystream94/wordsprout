import type { ReactNode } from 'react';
import styles from './Tooltip.module.css';

interface TooltipProps {
  text: string;
  children: ReactNode;
}

export default function Tooltip({ text, children }: TooltipProps) {
  return (
    <span className={styles.wrapper} data-tooltip={text}>
      {children}
    </span>
  );
}
