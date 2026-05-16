export function formatBps(bps: number): string {
  return `${(bps / 100).toFixed(2)}%`;
}

export function formatMoney(amount: string, currency: string): string {
  return `${amount} ${currency}`;
}

export function formatDate(value?: string | null): string {
  if (!value) return 'Not scheduled';
  return new Intl.DateTimeFormat('en', { month: 'short', day: '2-digit', year: 'numeric' }).format(new Date(value));
}

export function shortHash(value?: string | null): string {
  if (!value) return 'Not recorded';
  return value.length > 18 ? `${value.slice(0, 10)}…${value.slice(-8)}` : value;
}

export function isUsdcCurrency(currency: unknown): currency is 'USDC' {
  return currency === 'USDC';
}

export function unsupportedLiquidationCurrencyMessage(currency: unknown): string {
  return `Unsupported liquidation currency ${String(currency || 'unknown')}. Bóveda borrower demo displays liquidation proceeds only in USDC.`;
}
