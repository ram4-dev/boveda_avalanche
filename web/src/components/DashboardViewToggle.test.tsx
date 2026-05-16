import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { DashboardViewToggle } from './DashboardViewToggle.js';

describe('DashboardViewToggle', () => {
  it('switches between Institutional, Crypto-native, and All modes', async () => {
    const onChangeMode = vi.fn();
    render(<DashboardViewToggle mode="all" onChangeMode={onChangeMode} />);

    expect(screen.getByRole('button', { name: 'All' })).toHaveAttribute('aria-pressed', 'true');

    await userEvent.click(screen.getByRole('button', { name: 'Institutional' }));
    await userEvent.click(screen.getByRole('button', { name: 'Crypto-native' }));

    expect(onChangeMode).toHaveBeenNthCalledWith(1, 'institutional');
    expect(onChangeMode).toHaveBeenNthCalledWith(2, 'crypto-native');
  });
});
