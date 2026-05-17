import type { EventType, Loan, OnChainEvent, SeedFile } from '../domain/types.js';

type EventDraft = {
  eventType: EventType;
  txHash?: string | null;
  payload: Record<string, unknown>;
};

export function buildSeedEvents(seed: SeedFile): OnChainEvent[] {
  let eventIndex = 0;
  const startTime = Date.parse(seed.generatedAt);

  return seed.loans.flatMap((loan) => {
    return eventDraftsForLoan(loan).map((draft) => {
      eventIndex += 1;
      return {
        eventId: `seed-${String(eventIndex).padStart(6, '0')}`,
        eventType: draft.eventType,
        loanId: loan.loanId,
        txHash: draft.txHash ?? null,
        blockNumber: null,
        occurredAt: new Date(startTime + (eventIndex - 1) * 1000).toISOString(),
        payload: draft.payload
      };
    });
  });
}

function eventDraftsForLoan(loan: Loan): EventDraft[] {
  const drafts: EventDraft[] = [loanCreated(loan)];

  if (isAtLeastApproved(loan)) {
    drafts.push(loanApproved(loan));
  }

  if (isAtLeastActive(loan) && loan.collateral.depositTxHash) {
    drafts.push(collateralDeposited(loan));
  }

  if (isAtLeastActive(loan)) {
    drafts.push(loanActivated(loan));
    if (loan.receipt) {
      drafts.push(receiptIssued(loan));
    }
  }

  return drafts;
}

function isAtLeastApproved(loan: Loan): boolean {
  return ['Approved', 'Active', 'MarginCall', 'Repaid', 'Defaulted', 'Liquidated'].includes(loan.status);
}

function isAtLeastActive(loan: Loan): boolean {
  return ['Active', 'MarginCall', 'Repaid', 'Defaulted', 'Liquidated'].includes(loan.status);
}

function loanCreated(loan: Loan): EventDraft {
  return {
    eventType: 'LoanCreated',
    payload: {
      eventType: 'LoanCreated',
      loanId: loan.loanId,
      borrowerWallet: loan.borrower.walletAddress,
      originatorId: loan.originator.originatorId,
      scenario: loan.scenario,
      principalAmount: loan.principal.amount,
      principalCurrency: loan.principal.currency,
      collateralToken: loan.collateral.token,
      initialLtvBps: loan.terms.initialLtvBps,
      status: 'Requested'
    }
  };
}

function loanApproved(loan: Loan): EventDraft {
  return {
    eventType: 'LoanApproved',
    payload: {
      eventType: 'LoanApproved',
      loanId: loan.loanId,
      approvedBy: loan.originator.originatorId,
      fiatDisbursementRef: loan.principal.disbursementRef ?? null,
      status: 'Approved'
    }
  };
}

function collateralDeposited(loan: Loan): EventDraft {
  return {
    eventType: 'CollateralDeposited',
    txHash: loan.collateral.depositTxHash ?? null,
    payload: {
      eventType: 'CollateralDeposited',
      loanId: loan.loanId,
      vaultAddress: loan.collateral.vaultAddress ?? null,
      token: loan.collateral.token,
      amount: loan.collateral.amountBaseUnits ?? loan.collateral.amount,
      txHash: loan.collateral.depositTxHash ?? null,
      status: 'Approved',
      evidence: collateralEvidence(loan)
    }
  };
}

function loanActivated(loan: Loan): EventDraft {
  return {
    eventType: 'LoanActivated',
    txHash: loan.collateral.depositTxHash ?? null,
    payload: {
      eventType: 'LoanActivated',
      loanId: loan.loanId,
      vaultAddress: loan.collateral.vaultAddress ?? null,
      receiptTokenId: loan.receipt?.receiptTokenId ?? null,
      status: 'Active',
      evidence: loan.collateral.depositTxHash ? collateralEvidence(loan, 'Activation references verified deposit evidence') : undefined
    }
  };
}

function receiptIssued(loan: Loan): EventDraft {
  return {
    eventType: 'ReceiptIssued',
    payload: {
      eventType: 'ReceiptIssued',
      loanId: loan.loanId,
      receiptTokenId: loan.receipt?.receiptTokenId,
      owner: loan.receipt?.ownerWallet,
      soulbound: true
    }
  };
}

function collateralEvidence(loan: Loan, label = 'Historical Fuji collateral deposit evidence'): Record<string, unknown> | undefined {
  if (!loan.collateral.depositTxHash || !loan.collateral.vaultAddress || loan.collateral.chainId !== 43113 || loan.collateral.token !== 'USDC') {
    return undefined;
  }
  return {
    mode: 'fuji',
    source: 'fuji-live',
    status: 'confirmed',
    label,
    txHash: loan.collateral.depositTxHash,
    blockNumber: null,
    explorerUrl: `https://testnet.snowtrace.io/tx/${loan.collateral.depositTxHash}`,
    contracts: [{ name: 'CollateralVault', address: loan.collateral.vaultAddress }],
    token: {
      symbol: loan.collateral.token,
      address: loan.collateral.tokenAddress ?? null,
      decimals: loan.collateral.tokenDecimals ?? 6,
      amountBaseUnits: loan.collateral.amountBaseUnits ?? loan.collateral.amount
    }
  };
}
