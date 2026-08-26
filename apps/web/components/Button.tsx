import Link from 'next/link';
import type { ReactNode } from 'react';
import styles from './Button.module.css';

type Variant = 'primary' | 'secondary' | 'danger';

interface BaseProps {
  variant?: Variant;
  disabled?: boolean;
  loading?: boolean;
  className?: string;
  children: ReactNode;
}

type LinkButtonProps = BaseProps & { href: string; onClick?: never; type?: never };
type ActionButtonProps = BaseProps & { href?: undefined; onClick?: () => void; type?: 'button' | 'submit' };

/**
 * Web counterpart to apps/mobile/src/components/Button.tsx — same variant
 * set and visual language (via the shared CSS custom properties in
 * globals.css), same "the one place button styling lives" role.
 */
export function Button(props: LinkButtonProps | ActionButtonProps) {
  const { variant = 'primary', disabled, loading, className, children } = props;
  const classes = [styles.base, styles[variant], disabled || loading ? styles.disabled : '', className]
    .filter(Boolean)
    .join(' ');

  if (props.href) {
    return (
      <Link href={props.href} className={classes} aria-disabled={disabled || loading}>
        {children}
      </Link>
    );
  }

  return (
    <button type={props.type ?? 'button'} className={classes} disabled={disabled || loading} onClick={props.onClick}>
      {children}
    </button>
  );
}
