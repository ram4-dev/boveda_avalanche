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
    render(<EventTimeline events={[liquidatedEvent({ proceedsAmount: '154200', proceedsCurrency: 'DAI' })]} />);

    expect(screen.getByText(/Unsupported liquidation currency DAI/i)).toBeInTheDocument();
    expect(screen.queryByText('Proceeds 154200 DAI')).not.toBeInTheDocument();
  });

  it('renders valid USDC Liquidated event proceeds', () => {
    render(<EventTimeline events={[liquidatedEvent({ proceedsAmount: '154200', proceedsCurrency: 'USDC' })]} />);

    expect(screen.getByText('Proceeds 154200 USDC')).toBeInTheDocument();
    expect(screen.queryByText(/Unsupported liquidation currency/i)).not.toBeInTheDocument();
  });
});
