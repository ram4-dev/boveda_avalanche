import { sha256Canonical } from '../domain/hashing.js';
import type { PaymentAttestation } from '../domain/paymentAttestations.js';
import type { DemoStore } from '../store/demoStore.js';
import type { Loan, OnChainEvent, ProceedsDistribution } from '../domain/types.js';

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

export interface Web3Adapter {
  activateLoan(input: ActivationInput): Promise<ActivationOutcome>;
  topUpCollateral(input: CollateralTopUpInput): Promise<CollateralTopUpOutcome>;
  registerPaymentAttestation(input: PaymentRegistrationInput): Promise<PaymentRegistrationOutcome>;
  liquidateLoan(input: LiquidationInput): Promise<LiquidationOutcome>;
  refreshPendingEvents?(): Promise<Web3RefreshOutcome>;
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

export function createWeb3Adapter(store: DemoStore, apiKey?: string, baseUrl = 'https://api.routescan.io/v2/network/testnet/evm/43113/etherscan/api'): Web3Adapter {
  if (!apiKey) {
    return createMockWeb3Adapter();
  }
  return createSnowtraceWeb3Adapter(store, apiKey, baseUrl);
}

function deriveReceiptTokenId(loanId: string): string {
  return String(parseInt(sha256Canonical({ loanId }).slice(2, 10), 16));
}

function createSnowtraceWeb3Adapter(store: DemoStore, apiKey: string, baseUrl: string): Web3Adapter {
  const mock = createMockWeb3Adapter();

  async function fetchTxReceipt(txHash: string): Promise<{ blockNumber: number | null } | null> {
    const url = new URL(baseUrl);
    url.searchParams.set('module', 'proxy');
    url.searchParams.set('action', 'eth_getTransactionReceipt');
    url.searchParams.set('txhash', txHash);
    url.searchParams.set('apikey', apiKey);

    const response = await fetch(url.toString());
    if (!response.ok) {
      return null;
    }

    const body = await response.json();
    if (!body || body.status === '0' || body.result == null) {
      return null;
    }

    const result = body.result;
    if (typeof result.blockNumber !== 'string') {
      return null;
    }

    const blockNumber = hexStringToNumber(result.blockNumber);
    return { blockNumber };
  }

  return {
    ...mock,
    async refreshPendingEvents() {
      const events = store.listEvents().filter((event) => event.txHash && event.blockNumber === null);
      let refreshedEvents = 0;
      for (const event of events) {
        const receipt = await fetchTxReceipt(event.txHash);
        if (receipt?.blockNumber != null) {
          store.updateEvent(event.eventId, { blockNumber: receipt.blockNumber });
          refreshedEvents += 1;
        }
      }
      return { refreshedEvents };
    }
  };
}

function hexStringToNumber(value: string): number {
  if (typeof value !== 'string' || !value.startsWith('0x')) {
    throw new Error(`Invalid hex string: ${String(value)}`);
  }
  return Number.parseInt(value.slice(2), 16);
}
