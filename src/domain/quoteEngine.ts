import { scenarioTerms } from '../config/demoConfig.js';
import type { CollateralTerms, LoanScenario, Money } from './types.js';
import { applyBps, currencyToUsd, normalizeDecimalString, usdToCurrency } from './money.js';

export type QuoteRequest = {
  scenario: LoanScenario;
  borrowerWallet: string;
  requestedPrincipal: Money;
  collateralToken: string;
  collateralValueUsd?: string;
};

export type QuoteResponse = {
  scenario: LoanScenario;
  suggestedPrincipal: Money;
  requiredCollateralValueUsd: string;
  terms: CollateralTerms;
};

export function createQuote(request: QuoteRequest): QuoteResponse {
  const terms = scenarioTerms[request.scenario];
  const requestedPrincipalUsd = currencyToUsd(
    request.requestedPrincipal.amount,
    request.requestedPrincipal.currency
  );
  const collateralValueUsd = request.collateralValueUsd === undefined
    ? undefined
    : Number(request.collateralValueUsd);
  const maxPrincipalUsd = collateralValueUsd === undefined
    ? requestedPrincipalUsd
    : applyBps(collateralValueUsd, terms.initialLtvBps);
  const suggestedPrincipalUsd = Math.min(requestedPrincipalUsd, maxPrincipalUsd);
  const requiredCollateralValueUsd = (suggestedPrincipalUsd * 10000) / terms.initialLtvBps;

  return {
    scenario: request.scenario,
    suggestedPrincipal: {
      amount: usdToCurrency(suggestedPrincipalUsd, request.requestedPrincipal.currency),
      currency: request.requestedPrincipal.currency
    },
    requiredCollateralValueUsd: normalizeDecimalString(requiredCollateralValueUsd),
    terms
  };
}
