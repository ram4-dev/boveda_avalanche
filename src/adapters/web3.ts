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

export interface Web3Adapter {
  activateLoan(input: ActivationInput): Promise<ActivationOutcome>;
  registerPaymentAttestation(input: PaymentRegistrationInput): Promise<PaymentRegistrationOutcome>;
  liquidateLoan(input: LiquidationInput): Promise<LiquidationOutcome>;
}

export function createMockWeb3Adapter(): Web3Adapter {
  return {
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
    }
  };
}

function deriveReceiptTokenId(loanId: string): string {
  return String(parseInt(sha256Canonical({ loanId }).slice(2, 10), 16));
}
