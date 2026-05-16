import type { DashboardDemoMode } from '../state/dashboardSelectors.js';

type DashboardViewToggleProps = {
  mode: DashboardDemoMode;
  onChangeMode: (mode: DashboardDemoMode) => void;
};

export function DashboardViewToggle({ mode, onChangeMode }: DashboardViewToggleProps) {
  return <div className="dashboard-view-toggle" role="group" aria-label="Dashboard scenario mode">
    <button className={`button ${mode === 'institutional' ? 'button-primary' : 'button-secondary'}`} aria-pressed={mode === 'institutional'} onClick={() => onChangeMode('institutional')}>
      Institutional
    </button>
    <button className={`button ${mode === 'crypto-native' ? 'button-primary' : 'button-secondary'}`} aria-pressed={mode === 'crypto-native'} onClick={() => onChangeMode('crypto-native')}>
      Crypto-native
    </button>
    <button className={`button ${mode === 'all' ? 'button-primary' : 'button-secondary'}`} aria-pressed={mode === 'all'} onClick={() => onChangeMode('all')}>
      All
    </button>
  </div>;
}
