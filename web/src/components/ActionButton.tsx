import type { ButtonHTMLAttributes, ReactNode } from 'react';

type Props = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'danger'; children: ReactNode; loading?: boolean };

export function ActionButton({ variant = 'primary', loading = false, disabled, children, ...props }: Props) {
  return <button className={`button button-${variant}`} disabled={disabled || loading} aria-busy={loading || undefined} {...props}>{loading ? 'Working…' : children}</button>;
}
