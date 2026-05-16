import { sha256Canonical } from '../domain/hashing.js';
import type { PaymentAttestation } from '../domain/paymentAttestations.js';
import type { Loan, ProceedsDistribution } from '../domain/types.js';

export type ActivationInput = {
  loan: Loan;
  receiptTokenId?: string;
};

export type ActivationOutcome = {
  ok: true;
  txHash: `0x${string}`;
  blockNumber: number | null;
  receiptTokenId: string;
  ownerWallet: string;
  vaultAddress: string;
};

export type PaymentRegistrationInput = {
  loan: Loan;
  attestation: PaymentAttestation;
};

export type CollateralTopUpInput = {
  loan: Loan;
  token: string;
  amount: string;
  txHash?: `0x${string}`;
};

export type CollateralTopUpOutcome = {
  ok: true;
  txHash: `0x${string}`;
  blockNumber: number | null;
};

export type PaymentRegistrationOutcome = {
  ok: true;
  txHash: `0x${string}`;
  blockNumber: number | null;
  attestationHash: `0x${string}`;
};

export type LiquidationInput = {
  loan: Loan;
  reason: string;
  proceedsAmount: string;
  proceedsCurrency: 'USDC';
  distribution: ProceedsDistribution;
  liquidationTxHash?: `0x${string}`;
};

export type LiquidationOutcome = {
  ok: true;
  txHash: `0x${string}`;
  blockNumber: number | null;
  proceedsAmount: string;
  proceedsCurrency: 'USDC';
  distribution: ProceedsDistribution;
};

export type Web3RefreshOutcome = {
  refreshedEvents: number;
};

export type Web3EvidenceSource = 'demo-simulated' | 'fuji-live' | 'fuji-unavailable';

export class Web3UnavailableError extends Error {
  readonly code = 'WEB3_UNAVAILABLE' as const;

  constructor(reason: string) {
    super(`Fuji web3 adapter is unavailable: ${reason}`);
    this.name = 'Web3UnavailableError';
  }
}

export interface Web3Adapter {
  evidenceSource?: Web3EvidenceSource;
  activateLoan(input: ActivationInput): Promise<ActivationOutcome>;
  topUpCollateral(input: CollateralTopUpInput): Promise<CollateralTopUpOutcome>;
  registerPaymentAttestation(input: PaymentRegistrationInput): Promise<PaymentRegistrationOutcome>;
  liquidateLoan(input: LiquidationInput): Promise<LiquidationOutcome>;
  refreshPendingEvents?(): Promise<Web3RefreshOutcome>;
}

export function createMockWeb3Adapter(): Web3Adapter {
  return {
    evidenceSource: 'demo-simulated',
    async activateLoan(input) {
      return {
        ok: true,
        txHash: sha256Canonical({ operation: 'activateLoan', loanId: input.loan.loanId, receiptTokenId: input.receiptTokenId ?? null }),
        blockNumber: null,
        receiptTokenId: input.receiptTokenId ?? deriveReceiptTokenId(input.loan.loanId),
        ownerWallet: input.loan.borrower.walletAddress,
        vaultAddress: input.loan.collateral.vaultAddress ?? ''
      };
    },
    async topUpCollateral(input) {
      return {
        ok: true,
        txHash: input.txHash ?? sha256Canonical({ operation: 'topUpCollateral', loanId: input.loan.loanId, token: input.token, amount: input.amount }),
        blockNumber: null
      };
    },
    async registerPaymentAttestation(input) {
      return {
        ok: true,
        txHash: sha256Canonical({ operation: 'registerPaymentAttestation', loanId: input.loan.loanId, attestationHash: input.attestation.attestationHash }),
        blockNumber: null,
        attestationHash: input.attestation.attestationHash
      };
    },
    async liquidateLoan(input) {
      return {
        ok: true,
        txHash: input.liquidationTxHash ?? sha256Canonical({ operation: 'liquidateLoan', loanId: input.loan.loanId, reason: input.reason, proceedsAmount: input.proceedsAmount }),
        blockNumber: null,
        proceedsAmount: input.proceedsAmount,
        proceedsCurrency: 'USDC',
        distribution: input.distribution
      };
    },
    async refreshPendingEvents() {
      return { refreshedEvents: 0 };
    }
  };
}

export function createUnavailableWeb3Adapter(reason: string): Web3Adapter {
  return {
    evidenceSource: 'fuji-unavailable',
    async activateLoan() {
      throw new Web3UnavailableError(reason);
    },
    async topUpCollateral() {
      throw new Web3UnavailableError(reason);
    },
    async registerPaymentAttestation() {
      throw new Web3UnavailableError(reason);
    },
    async liquidateLoan() {
      throw new Web3UnavailableError(reason);
    },
    async refreshPendingEvents() {
      return { refreshedEvents: 0 };
    }
  };
}

function deriveReceiptTokenId(loanId: string): string {
  return String(parseInt(sha256Canonical({ loanId }).slice(2, 10), 16));
}
