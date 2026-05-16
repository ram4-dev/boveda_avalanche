import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createInitialDemoControls, demoControlsReducer } from '../state/demoControls.js';
import { DemoControlsPanel } from './DemoControlsPanel.js';

function setup() {
  const onAction = vi.fn();
  const onReset = vi.fn();
  const overrides = createInitialDemoControls();
  render(<DemoControlsPanel overrides={overrides} onAction={onAction} onReset={onReset} />);
  return { onAction, onReset };
}

afterEach(() => cleanup());

describe('DemoControlsPanel', () => {
  it('labels presenter paths as local scripted demo flows', () => {
    setup();

    expect(screen.getByRole('heading', { name: /Demo paths/i })).toBeInTheDocument();
    expect(screen.getByText(/Scripted local demo flows/i)).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'Demo path' })).toHaveValue('happy-repayment');
    expect(screen.getByText(/1\. Request loan/i)).toBeInTheDocument();
    expect(screen.getByText(/2\. Risk checked/i)).toBeInTheDocument();
    expect(screen.getByText(/8\. Collateral released/i)).toBeInTheDocument();
  });

  it('emits path selection, next step, auto-run, and reset actions', async () => {
    const { onAction, onReset } = setup();

    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Demo path' }), 'collateral-crash-liquidation');
    expect(onAction).toHaveBeenLastCalledWith({ type: 'select-demo-path', pathId: 'collateral-crash-liquidation' });

    await userEvent.click(screen.getByRole('button', { name: /Next step/i }));
    expect(onAction).toHaveBeenLastCalledWith({ type: 'next-path-step' });

    await userEvent.click(screen.getByRole('button', { name: /Auto-run path/i }));
    expect(onAction).toHaveBeenLastCalledWith({ type: 'auto-run-path' });

    await userEvent.click(screen.getByRole('button', { name: /Reset path/i }));
    expect(onReset).toHaveBeenCalled();
  });

  it('shows the active path step', () => {
    const onAction = vi.fn();
    let overrides = demoControlsReducer(createInitialDemoControls(), { type: 'select-demo-path', pathId: 'missed-payments-liquidation' });
    overrides = demoControlsReducer(overrides, { type: 'next-path-step' });
    render(<DemoControlsPanel overrides={overrides} onAction={onAction} onReset={vi.fn()} />);

    expect(screen.getByRole('combobox', { name: 'Demo path' })).toHaveValue('missed-payments-liquidation');
    expect(screen.getByText(/Current step: Risk checked/i)).toBeInTheDocument();
  });
});
