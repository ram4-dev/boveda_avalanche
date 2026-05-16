import type { FujiReadOnlyStatus, RuntimeMetadata, RuntimeMode } from '../runtime/runtimeMode.js';
import { runtimeModeLabel, runtimeModeMismatch } from '../runtime/runtimeMode.js';

export function RuntimeModeBanner({ routeMode, metadata, fujiReadOnlyStatus }: { routeMode: RuntimeMode; metadata: RuntimeMetadata | null; fujiReadOnlyStatus?: FujiReadOnlyStatus | null }) {
  const mismatch = runtimeModeMismatch(routeMode, metadata);
  const label = runtimeModeLabel({ routeMode, evidenceSource: metadata?.evidenceSource, fujiReadOnlyOk: fujiReadOnlyStatus?.ok });

  return (
    <section className="runtime-banner card" aria-label="Runtime mode">
      <span className="card-kicker">Runtime</span>
      <p className="runtime-banner-title">{label}</p>
      {fujiReadOnlyStatus?.ok ? <p className="table-subtle">Read-only Fuji smoke passed: {fujiReadOnlyStatus.contracts.length} deployed contracts detected on chain {fujiReadOnlyStatus.chainId}.</p> : null}
      {fujiReadOnlyStatus && !fujiReadOnlyStatus.ok ? <p className="alert alert-warning" role="alert">Fuji read-only smoke failed: {fujiReadOnlyStatus.errors.join('; ')}</p> : null}
      {mismatch ? <p className="alert alert-warning" role="alert">{mismatch}</p> : null}
    </section>
  );
}
