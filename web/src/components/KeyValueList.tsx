export function KeyValueList({ items }: { items: Array<{ label: string; value: string }> }) {
  return <dl className="key-value-list">{items.map((item) => <div className="key-value" key={item.label}><dt>{item.label}</dt><dd>{item.value}</dd></div>)}</dl>;
}
