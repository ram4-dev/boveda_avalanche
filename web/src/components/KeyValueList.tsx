import type { ReactNode } from 'react';

export function KeyValueList({ items }: { items: Array<{ label: string; value: ReactNode }> }) {
  return <dl className="key-value-list">{items.map((item) => <div className="key-value" key={item.label}><dt>{item.label}</dt><dd>{item.value}</dd></div>)}</dl>;
}
