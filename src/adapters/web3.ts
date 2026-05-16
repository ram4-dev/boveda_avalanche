import { ethers } from 'ethers';
import { sha256Canonical } from '../domain/hashing.js';
import type { PaymentAttestation } from '../domain/paymentAttestations.js';
import type { Loan, ProceedsDistribution } from '../domain/types.js';
import { PAYMENT_ATTESTATION_ABI, LIQUIDATION_ENGINE_ABI, LOAN_REGISTRY_ABI } from '../abis/index.js';

// Configuration from environment
const RPC_URL = process.env.FUJI_RPC_URL || 'https://api.avax-test.network/ext/bc/C/rpc';
const PAYMENT_ATTESTATION_ADDRESS = process.env.PAYMENT_ATTESTATION_ADDRESS || '0xfbe6b9cbd0896f664464f0dd614aa8500d2c456d';
const LIQUIDATION_ENGINE_ADDRESS = process.env.LIQUIDATION_ENGINE_ADDRESS || '0xa3c9dbf2a3683a528a43436175a70913c2f4103f';
const LOAN_REGISTRY_ADDRESS = process.env.LOAN_REGISTRY_ADDRESS || '0x81649e7f5a64a4d11c74fcc1670c245475d838d5';
const DEPLOYER_PRIVATE_KEY = process.env.DEPLOYER_PRIVATE_KEY || '';

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

// Real ethers.js Web3 Adapter
export function createEthersWeb3Adapter(): Web3Adapter {
  const provider = new ethers.JsonRpcProvider(RPC_URL);
  const signer = new ethers.Wallet(DEPLOYER_PRIVATE_KEY, provider);

  const paymentAttestationContract = new ethers.Contract(
    PAYMENT_ATTESTATION_ADDRESS,
    PAYMENT_ATTESTATION_ABI,
    signer
  );

  const liquidationEngineContract = new ethers.Contract(
    LIQUIDATION_ENGINE_ADDRESS,
    LIQUIDATION_ENGINE_ABI,
    signer
  );

  const loanRegistryContract = new ethers.Contract(
    LOAN_REGISTRY_ADDRESS,
    LOAN_REGISTRY_ABI,
    signer
  );

  return {
    async activateLoan(input) {
      // Activation would typically involve minting NFT or initializing loan
      // For now, return mock response
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
      // Collateral top-up would involve transferring tokens to vault
      return {
        ok: true,
        txHash: input.txHash ?? sha256Canonical({ operation: 'topUpCollateral', loanId: input.loan.loanId, token: input.token, amount: input.amount }),
        blockNumber: null
      };
    },
    async registerPaymentAttestation(input) {
      try {
        // Register payment attestation on-chain
        const paymentHash = ethers.id(JSON.stringify(input.attestation));
        const signature = await signer.signMessage(ethers.getBytes(paymentHash));
        
        const tx = await paymentAttestationContract.registerPayment(
          input.loan.loanId,
          paymentHash,
          signature
        );
        
        const receipt = await tx.wait();
        
        return {
          ok: true,
          txHash: tx.hash as `0x${string}`,
          blockNumber: receipt?.blockNumber ?? null,
          attestationHash: paymentHash as `0x${string}`
        };
      } catch (error) {
        console.error('Error registering payment attestation:', error);
        throw error;
      }
    },
    async liquidateLoan(input) {
      try {
        // Check if liquidation is allowed first
        const canLiquidateResult = await liquidationEngineContract.canLiquidate(
          input.loan.loanId,
          input.proceedsAmount,
          18 // USDC decimals
        );
        
        if (!canLiquidateResult.allowed) {
          throw new Error(`Liquidation not allowed: ${canLiquidateResult.reason}`);
        }

        // Execute liquidation
        const tx = await liquidationEngineContract.liquidateLoan(
          input.loan.loanId,
          input.proceedsAmount,
          18, // price decimals
          input.distribution.fundingPartnerAddress // funding partner
        );
        
        const receipt = await tx.wait();
        
        return {
          ok: true,
          txHash: tx.hash as `0x${string}`,
          blockNumber: receipt?.blockNumber ?? null,
          proceedsAmount: input.proceedsAmount,
          proceedsCurrency: 'USDC',
          distribution: input.distribution
        };
      } catch (error) {
        console.error('Error liquidating loan:', error);
        throw error;
      }
    },
    async refreshPendingEvents() {
      // This would typically fetch and process pending events from contracts
      try {
        // Could implement event listening here in future
        return { refreshedEvents: 0 };
      } catch (error) {
        console.error('Error refreshing pending events:', error);
        return { refreshedEvents: 0 };
      }
    }
  };
}

function deriveReceiptTokenId(loanId: string): string {
  return String(parseInt(sha256Canonical({ loanId }).slice(2, 10), 16));
}

// Mock adapter for testing
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

// Factory function to create the appropriate adapter
export function createWeb3Adapter(useMock = false): Web3Adapter {
  if (useMock) {
    return createMockWeb3Adapter();
  }
  return createEthersWeb3Adapter();
}
