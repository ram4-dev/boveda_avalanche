import { currencyToUsd, normalizeDecimalString } from '../domain/money.js';
import type { Loan } from '../domain/types.js';

export type ControlledOraclePrice = {
  priceUsd: string;
  asOf: string;
};

export type ControlledOracleConfig = {
  prices: Record<string, ControlledOraclePrice>;
  maxPriceAgeSeconds?: number;
  now?: () => Date;
};

export type NormalizedOraclePrice = {
  token: string;
  priceUsd: string;
  asOf: string;
  ageSeconds: number;
  source: 'CONTROLLED_DEMO_ADAPTER';
};

export interface OracleAdapter {
  getNormalizedPrice(token: string): NormalizedOraclePrice;
  computeLoanLtvBps(loan: Pick<Loan, 'principal' | 'collateral'>): number;
}

const DEFAULT_MAX_PRICE_AGE_SECONDS = 300;

export function createControlledOracleAdapter(config: ControlledOracleConfig): OracleAdapter {
  const now = config.now ?? (() => new Date());
  const maxPriceAgeSeconds = config.maxPriceAgeSeconds ?? DEFAULT_MAX_PRICE_AGE_SECONDS;
  const normalizedPriceByToken = new Map<string, ControlledOraclePrice>(
    Object.entries(config.prices).map(([token, price]) => [token.toUpperCase(), price])
  );

  return {
    getNormalizedPrice(token: string): NormalizedOraclePrice {
      const normalizedToken = token.toUpperCase();
      const controlledPrice = normalizedPriceByToken.get(normalizedToken);
      if (!controlledPrice) {
        throw new Error(`OracleAdapter: unsupported token ${normalizedToken}`);
      }

      const numericPrice = Number(controlledPrice.priceUsd);
      if (!Number.isFinite(numericPrice) || numericPrice <= 0) {
        throw new Error(`OracleAdapter: priceUsd must be a positive decimal for ${normalizedToken}`);
      }

      const asOfMs = Date.parse(controlledPrice.asOf);
      if (!Number.isFinite(asOfMs)) {
        throw new Error(`OracleAdapter: invalid asOf timestamp for ${normalizedToken}`);
      }

      const ageSeconds = Math.floor((now().getTime() - asOfMs) / 1000);
      if (ageSeconds < 0) {
        throw new Error(`OracleAdapter: asOf is in the future for ${normalizedToken}`);
      }
      if (ageSeconds > maxPriceAgeSeconds) {
        throw new Error(`OracleAdapter: stale price for ${normalizedToken}`);
      }

      return {
        token: normalizedToken,
        priceUsd: normalizeDecimalString(controlledPrice.priceUsd),
        asOf: new Date(asOfMs).toISOString(),
        ageSeconds,
        source: 'CONTROLLED_DEMO_ADAPTER'
      };
    },

    computeLoanLtvBps(loan: Pick<Loan, 'principal' | 'collateral'>): number {
      const price = this.getNormalizedPrice(loan.collateral.token);
      const collateralAmount = Number(loan.collateral.amount);
      if (!Number.isFinite(collateralAmount) || collateralAmount <= 0) {
        throw new Error(`OracleAdapter: collateral amount must be a positive decimal for ${loan.collateral.token}`);
      }

      const principalUsd = currencyToUsd(loan.principal.amount, loan.principal.currency);
      const collateralValueUsd = collateralAmount * Number(price.priceUsd);
      if (collateralValueUsd <= 0) {
        throw new Error('OracleAdapter: collateral value must be > 0');
      }

      return Math.round((principalUsd * 10000) / collateralValueUsd);
    }
  };
}
