type DataSourceBadgeProps = {
  label?: string;
};

export function DataSourceBadge({ label }: DataSourceBadgeProps) {
  if (!label) return null;
  return <span className="data-source-badge">{label}</span>;
}
