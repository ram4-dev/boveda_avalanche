type Props = {
  label: string;
  value: string;
  detail?: string;
  hero?: boolean;
};

export function MetricTile({ label, value, detail, hero }: Props) {
  return (
    <div className={hero ? 'metric-tile metric-hero' : 'metric-tile'}>
      <span>{label}</span>
      <strong>{value}</strong>
      {detail ? <small>{detail}</small> : null}
    </div>
  );
}
