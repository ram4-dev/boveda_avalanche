import type { ReactNode } from 'react';

export function Alert({ tone = 'info', children }: { tone?: 'info' | 'success' | 'warning' | 'danger'; children: ReactNode }) {
  return <div className={`alert alert-${tone}`} role={tone === 'danger' || tone === 'warning' ? 'alert' : 'status'}>{children}</div>;
}
