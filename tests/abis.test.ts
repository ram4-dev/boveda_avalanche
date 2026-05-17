import { describe, expect, it } from 'vitest';
import {
  COLLATERAL_VAULT_ABI,
  ERC20_USDC_ABI,
  LIQUIDATION_ENGINE_ABI,
  LOAN_REGISTRY_ABI,
  PAYMENT_ATTESTATION_ABI
} from '../src/abis/index.js';

type AbiFragment = { type?: string; name?: string };

function hasFunction(abi: readonly AbiFragment[], name: string): boolean {
  return abi.some((fragment) => fragment.type === 'function' && fragment.name === name);
}

function hasEvent(abi: readonly AbiFragment[], name: string): boolean {
  return abi.some((fragment) => fragment.type === 'event' && fragment.name === name);
}

function findFragments(abi: readonly AbiFragment[], name: string): AbiFragment[] {
  return abi.filter((fragment) => fragment.name === name);
}

describe('ABI registry exports the dashboard-driven Fuji lifecycle fragments', () => {
  it('LOAN_REGISTRY_ABI exposes createLoan / setLoanStatus / getLoanStatus / getLoan and LoanCreated event', () => {
    expect(hasFunction(LOAN_REGISTRY_ABI, 'createLoan')).toBe(true);
    expect(hasFunction(LOAN_REGISTRY_ABI, 'setLoanStatus')).toBe(true);
    expect(hasFunction(LOAN_REGISTRY_ABI, 'getLoanStatus')).toBe(true);
    expect(hasFunction(LOAN_REGISTRY_ABI, 'getLoan')).toBe(true);
    expect(hasEvent(LOAN_REGISTRY_ABI, 'LoanCreated')).toBe(true);
  });

  it('COLLATERAL_VAULT_ABI exposes depositCollateral / releaseCollateral / getVault and Deposited/Released events', () => {
    expect(hasFunction(COLLATERAL_VAULT_ABI, 'depositCollateral')).toBe(true);
    expect(hasFunction(COLLATERAL_VAULT_ABI, 'releaseCollateral')).toBe(true);
    expect(hasFunction(COLLATERAL_VAULT_ABI, 'getVault')).toBe(true);
    expect(hasEvent(COLLATERAL_VAULT_ABI, 'CollateralDeposited')).toBe(true);
    expect(hasEvent(COLLATERAL_VAULT_ABI, 'CollateralReleased')).toBe(true);
  });

  it('ERC20_USDC_ABI exposes balanceOf / allowance / approve / decimals / symbol and Transfer event', () => {
    expect(hasFunction(ERC20_USDC_ABI, 'balanceOf')).toBe(true);
    expect(hasFunction(ERC20_USDC_ABI, 'allowance')).toBe(true);
    expect(hasFunction(ERC20_USDC_ABI, 'approve')).toBe(true);
    expect(hasFunction(ERC20_USDC_ABI, 'decimals')).toBe(true);
    expect(hasFunction(ERC20_USDC_ABI, 'symbol')).toBe(true);
    expect(hasEvent(ERC20_USDC_ABI, 'Transfer')).toBe(true);
  });

  it('LIQUIDATION_ENGINE_ABI exposes liquidateLoan / canLiquidate and LoanLiquidated event', () => {
    expect(hasFunction(LIQUIDATION_ENGINE_ABI, 'liquidateLoan')).toBe(true);
    expect(hasFunction(LIQUIDATION_ENGINE_ABI, 'canLiquidate')).toBe(true);
    expect(hasEvent(LIQUIDATION_ENGINE_ABI, 'LoanLiquidated')).toBe(true);
  });

  it('PAYMENT_ATTESTATION_ABI preserves the registerPayment function fragment', () => {
    expect(hasFunction(PAYMENT_ATTESTATION_ABI, 'registerPayment')).toBe(true);
  });

  it('does not duplicate function fragments inside any single migrated ABI', () => {
    const abis: Array<readonly AbiFragment[]> = [
      LOAN_REGISTRY_ABI,
      COLLATERAL_VAULT_ABI,
      ERC20_USDC_ABI,
      LIQUIDATION_ENGINE_ABI,
      PAYMENT_ATTESTATION_ABI
    ];
    for (const abi of abis) {
      const names = abi
        .filter((fragment) => fragment.type === 'function' && typeof fragment.name === 'string')
        .map((fragment) => fragment.name as string);
      const unique = new Set(names);
      expect(unique.size).toBe(names.length);
    }
  });

  it('createLoan / setLoanStatus / depositCollateral signatures match the spec inputs', () => {
    const createLoan = findFragments(LOAN_REGISTRY_ABI, 'createLoan')[0] as
      | { inputs?: Array<{ type: string }> }
      | undefined;
    expect(createLoan?.inputs?.map((i) => i.type)).toEqual([
      'address',
      'address',
      'address',
      'uint256',
      'uint256',
      'uint256',
      'uint256'
    ]);

    const setLoanStatus = findFragments(LOAN_REGISTRY_ABI, 'setLoanStatus')[0] as
      | { inputs?: Array<{ type: string }> }
      | undefined;
    expect(setLoanStatus?.inputs?.map((i) => i.type)).toEqual(['uint256', 'uint8']);

    const depositCollateral = findFragments(COLLATERAL_VAULT_ABI, 'depositCollateral')[0] as
      | { inputs?: Array<{ type: string }> }
      | undefined;
    expect(depositCollateral?.inputs?.map((i) => i.type)).toEqual(['uint256', 'uint256']);
  });
});
