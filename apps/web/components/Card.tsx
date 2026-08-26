import Link from 'next/link';
import type { ReactNode } from 'react';
import styles from './Card.module.css';

interface Props {
  children: ReactNode;
  className?: string;
  href?: string;
  disabled?: boolean;
}

/** Web counterpart to apps/mobile/src/components/Card.tsx. */
export function Card({ children, className, href, disabled }: Props) {
  const classes = [styles.card, disabled ? styles.disabled : '', className].filter(Boolean).join(' ');

  if (href && !disabled) {
    return (
      <Link href={href} className={classes}>
        {children}
      </Link>
    );
  }

  return <div className={classes}>{children}</div>;
}
