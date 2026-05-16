import {
  getCurrentDemoPathStep,
  getDemoPathOptions,
  getDemoPathSteps,
  type DemoControlsAction,
  type DemoControlsState,
  type DemoPathId
} from '../state/demoControls.js';

type Props = {
  overrides: DemoControlsState;
  onAction: (action: DemoControlsAction) => void;
  onReset: () => void;
};

export function DemoControlsPanel({ overrides, onAction, onReset }: Props) {
  const pathOptions = getDemoPathOptions();
  const steps = getDemoPathSteps(overrides.activePathId);
  const currentStep = getCurrentDemoPathStep(overrides);

  return (
    <section className="sidebar-section demo-controls" aria-labelledby="demo-controls-title">
      <div>
        <span className="sidebar-title">Presenter mode</span>
        <h2 id="demo-controls-title" className="sidebar-name">Demo paths</h2>
        <p className="sidebar-description">Scripted local demo flows. API data remains canonical for the live demo path.</p>
      </div>

      <label className="control-field">
        <span>Demo path</span>
        <select
          value={overrides.activePathId}
          onChange={(event) => onAction({ type: 'select-demo-path', pathId: event.currentTarget.value as DemoPathId })}
        >
          {pathOptions.map((path) => <option key={path.id} value={path.id}>{path.label}</option>)}
        </select>
      </label>

      <p className="path-current-step">Current step: {currentStep.label}</p>
      <ol className="path-step-list" aria-label="Path script steps">
        {steps.map((step, index) => (
          <li key={`${step.eventType}-${index}`} className={index === overrides.pathStepIndex ? 'active' : index < overrides.pathStepIndex ? 'complete' : undefined}>
            <span>{index + 1}. {step.label}</span>
            <small>{step.description}</small>
          </li>
        ))}
      </ol>

      <div className="demo-button-grid" aria-label="Path controls">
        <button className="button button-primary" type="button" onClick={() => onAction({ type: 'next-path-step' })}>Next step</button>
        <button className="button button-secondary" type="button" onClick={() => onAction({ type: 'auto-run-path' })}>Auto-run path</button>
      </div>

      <button className="button button-secondary reset-demo-button" type="button" onClick={onReset}>Reset path</button>
    </section>
  );
}
