import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { EventTimeline } from './EventTimeline.js';
import type { OnChainEvent } from '../api/types.js';

const liquidatedEvent = (payload: Record<string, unknown>): OnChainEvent => ({
  eventId: 'evt-liquidated',
  eventType: 'Liquidated',
  loanId: 'loan-web3-001',
  txHash: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
  blockNumber: null,
  occurredAt: '2026-06-15T00:00:00Z',
  payload
});

describe('EventTimeline', () => {
  it('does not render non-USDC Liquidated event proceeds as valid proceeds', () => {
    render(<EventTimeline events={[liquidatedEvent({ proceedsAmount: '154200', proceedsCurrency: 'DAI', evidence: { source: 'demo-simulated' } })]} />);

    expect(screen.getByText(/Unsupported liquidation currency DAI/i)).toBeInTheDocument();
    expect(screen.getByText('Simulated demo evidence')).toBeInTheDocument();
    expect(screen.queryByText('Proceeds 154200 DAI')).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'View Fuji tx' })).not.toBeInTheDocument();
  });

  it('renders valid USDC Liquidated event proceeds with Fuji links in live evidence mode', () => {
    render(<EventTimeline events={[liquidatedEvent({ proceedsAmount: '154200', proceedsCurrency: 'USDC', evidence: { source: 'fuji-live', explorerUrl: 'https://testnet.snowtrace.io' } })]} />);

    expect(screen.getByText('Proceeds 154200 USDC')).toBeInTheDocument();
    expect(screen.getByText('Fuji live evidence')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'View Fuji tx' })).toHaveAttribute('href', expect.stringContaining('/tx/'));
    expect(screen.queryByText(/Unsupported liquidation currency/i)).not.toBeInTheDocument();
  });
});
