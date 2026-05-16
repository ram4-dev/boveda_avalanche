import { demoFxUsdPerCurrency } from '../config/demoConfig.js';

export function normalizeDecimalString(value: string | number): string {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    throw new Error(`Invalid decimal value: ${value}`);
  }

  if (Number.isInteger(numeric)) {
    return String(numeric);
  }

  return numeric.toFixed(6).replace(/\.0+$/, '').replace(/(\.\d*?)0+$/, '$1');
}

export function currencyToUsd(amount: string, currency: string): number {
  const rate = demoFxUsdPerCurrency[currency.toUpperCase()];
  if (rate === undefined) {
    throw new Error(`Unsupported currency: ${currency}`);
  }
  return Number(amount) * rate;
}

export function usdToCurrency(usdAmount: number, currency: string): string {
  const rate = demoFxUsdPerCurrency[currency.toUpperCase()];
  if (rate === undefined) {
    throw new Error(`Unsupported currency: ${currency}`);
  }
  return normalizeDecimalString(usdAmount / rate);
}

export function applyBps(amount: number, bps: number): number {
  return (amount * bps) / 10000;
}
