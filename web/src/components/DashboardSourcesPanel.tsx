import { useEffect, useState } from 'react';
import type { DashboardSourceDefinition, DataSourcesResponse } from '../api/types.js';
import type { BovedaApiClient } from '../api/client.js';

type DashboardSourcesPanelProps = {
  client: Pick<BovedaApiClient, 'getDashboardDataSources'>;
};

export function DashboardSourcesPanel({ client }: DashboardSourcesPanelProps) {
  const [sources, setSources] = useState<DashboardSourceDefinition[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    client.getDashboardDataSources()
      .then((response: DataSourcesResponse) => {
        if (!cancelled) setSources(response.sources);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err));
      });
    return () => {
      cancelled = true;
    };
  }, [client]);

  return (
    <section className="dashboard-card" aria-label="Dashboard data sources">
      <header className="card-title-row">
        <h2>Data sources</h2>
        <small className="mono-cell">Real backend source matrix</small>
      </header>
      <p className="table-subtle">Canonical explorer for Fuji/testnet links is Snowtrace. Explorer links are surfaced for chain addresses and transaction hashes where available.</p>
      {error ? (
        <p role="alert">Could not load data-source metadata: {error}</p>
      ) : sources === null ? (
        <p>Loading source metadata…</p>
      ) : (
        <ul className="data-sources-list">
          {sources.slice(0, 5).map((source) => (
            <li key={source.field} className="data-source-item">
              <strong>{source.field}</strong>
              <p>{source.note}</p>
              <p className="table-subtle">Source: {source.source} · Backend: {source.backend}</p>
            </li>
          ))}
          {sources.length > 5 ? <li className="data-source-summary">+ {sources.length - 5} more data source definitions available</li> : null}
        </ul>
      )}
    </section>
  );
}
