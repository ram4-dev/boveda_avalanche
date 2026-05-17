import { describe, expect, it } from 'vitest';
import {
  checkFujiSignerPrerequisites,
  createFujiWeb3Adapter,
  type FujiSignerConfig,
  type FujiWeb3Client
} from '../src/adapters/web3.js';
import { loadFujiContractsConfig } from '../src/config/fujiContracts.js';
import { loadSeedFileSync } from '../src/store/seedLoader.js';
import type { PaymentAttestation } from '../src/domain/paymentAttestations.js';

const txHash = '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa' as const;
const releaseTxHash = '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb' as const;
const liquidationTxHash = '0xcccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc' as const;
const signerConfig: Required<FujiSignerConfig> = {
  attestorPrivateKey: `0x${'11'.repeat(32)}`,
  borrowerPrivateKey: `0x${'22'.repeat(32)}`,
  originatorPrivateKey: `0x${'33'.repeat(32)}`,
  fundingPartnerAddress: '0x1111111111111111111111111111111111111111'
};

function runtimeContracts() {
  const result = loadFujiContractsConfig();
  if (!result.ok) throw new Error(result.errors.join('\n'));
  return result.config;
}

function seedLoan() {
  return loadSeedFileSync().loans[0];
}

function fakeClient(overrides: Partial<FujiWeb3Client> = {}): FujiWeb3Client {
  return {
    async verifyCollateralDeposit(input) {
      return {
        ok: true,
        txHash: input.txHash,
        blockNumber: 55440001,
        token: 'USDC',
        amountBaseUnits: '15000000',
        decimals: 6,
        vaultAddress: '0x45E96820551466861d20f081ab390CAA9368F68B'
      };
    },
    async activateLoan(input) {
      return {
        ok: true,
        txHash,
        blockNumber: 55440002,
        receiptTokenId: input.receiptTokenId ?? '1',
        ownerWallet: input.loan.borrower.walletAddress,
        vaultAddress: input.loan.collateral.vaultAddress ?? '0x45E96820551466861d20f081ab390CAA9368F68B'
      };
    },
    async topUpCollateral(input) {
      return { ok: true, txHash: input.txHash ?? txHash, blockNumber: 55440003 };
    },
    async registerPayment(input) {
      return { ok: true, txHash, blockNumber: 55440004, attestationHash: input.attestation.attestationHash };
    },
    async releaseCollateral(input) {
      return {
        status: 'confirmed',
        txHash: releaseTxHash,
        blockNumber: 55440005,
        token: input.loan.collateral.token,
        tokenAddress: input.loan.collateral.tokenAddress,
        amountBaseUnits: input.loan.collateral.amountBaseUnits ?? input.loan.collateral.amount,
        decimals: input.loan.collateral.tokenDecimals ?? 6
      };
    },
    async liquidateLoan(input) {
      return {
        ok: true,
        txHash: liquidationTxHash,
        blockNumber: 55440006,
        proceedsAmount: input.loan.liquidationPreview.proceedsAmount,
        proceedsCurrency: 'USDC',
        distribution: input.loan.liquidationPreview.distribution,
        tokenAddress: input.loan.collateral.tokenAddress,
        decimals: 6
      };
    },
    ...overrides
  };
}

describe('Fuji web3 adapter factory', () => {
  it('returns a safe unavailable adapter when signer prerequisites are missing', async () => {
    const prerequisiteCheck = checkFujiSignerPrerequisites({ attestorPrivateKey: signerConfig.attestorPrivateKey });
    expect(prerequisiteCheck).toEqual({
      ok: false,
      missing: ['borrowerPrivateKey', 'originatorPrivateKey', 'fundingPartnerAddress']
    });

    const adapter = createFujiWeb3Adapter({
      runtimeContracts: runtimeContracts(),
      rpcUrl: 'http://127.0.0.1:9650/ext/bc/C/rpc',
      signerConfig: { attestorPrivateKey: signerConfig.attestorPrivateKey },
      client: fakeClient()
    });

    expect(adapter.evidenceSource).toBe('fuji-unavailable');
    await expect(adapter.liquidateLoan({
      loan: seedLoan(),
      reason: 'test',
      proceedsAmount: '15000000',
      proceedsCurrency: 'USDC',
      distribution: seedLoan().liquidationPreview.distribution
    })).rejects.toThrow('missing Fuji signing prerequisites');
  });

  it('verifies collateral deposit evidence through the injected Fuji client', async () => {
    const adapter = createFujiWeb3Adapter({
      runtimeContracts: runtimeContracts(),
      rpcUrl: 'http://127.0.0.1:9650/ext/bc/C/rpc',
      signerConfig,
      client: fakeClient()
    });

    const outcome = await adapter.verifyCollateralDeposit?.({
      loan: seedLoan(),
      token: 'USDC',
      amount: '15000000',
      txHash,
      vaultAddress: '0xclientSuppliedVault000000000000000000000001'
    });

    expect(adapter.evidenceSource).toBe('fuji-live');
    expect(outcome).toMatchObject({
      txHash,
      blockNumber: 55440001,
      token: 'USDC',
      amountBaseUnits: '15000000',
      decimals: 6,
      vaultAddress: '0x45E96820551466861d20f081ab390CAA9368F68B'
    });
  });

  it('returns separate confirmed collateral release evidence only for final payments', async () => {
    const adapter = createFujiWeb3Adapter({
      runtimeContracts: runtimeContracts(),
      rpcUrl: 'http://127.0.0.1:9650/ext/bc/C/rpc',
      signerConfig,
      client: fakeClient()
    });
    const finalAttestation: PaymentAttestation = {
      loanId: seedLoan().loanId,
      installmentId: 'final-001',
      amount: seedLoan().principal.amount,
      currency: seedLoan().principal.currency,
      attestationHash: txHash,
      remainingPrincipal: '0',
      status: 'Repaid'
    };

    const outcome = await adapter.registerPaymentAttestation({ loan: seedLoan(), attestation: finalAttestation });

    expect(outcome.txHash).toBe(txHash);
    expect(outcome.releaseEvidence).toMatchObject({
      status: 'confirmed',
      txHash: releaseTxHash,
      amountBaseUnits: '15000000',
      decimals: 6
    });
  });

  it('uses adapter-confirmed liquidation distribution instead of client supplied distribution', async () => {
    const adapter = createFujiWeb3Adapter({
      runtimeContracts: runtimeContracts(),
      rpcUrl: 'http://127.0.0.1:9650/ext/bc/C/rpc',
      signerConfig,
      client: fakeClient()
    });
    const maliciousDistribution = {
      fundingPartnerAmount: '1',
      originatorFeeAmount: '1',
      borrowerRemainderAmount: '14999998'
    };

    const outcome = await adapter.liquidateLoan({
      loan: seedLoan(),
      reason: 'defaulted',
      proceedsAmount: '15000000',
      proceedsCurrency: 'USDC',
      distribution: maliciousDistribution
    });

    expect(outcome.txHash).toBe(liquidationTxHash);
    expect(outcome.distribution).toEqual(seedLoan().liquidationPreview.distribution);
    expect(outcome.distribution).not.toEqual(maliciousDistribution);
  });
});
