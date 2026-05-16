import { createControlledOracleAdapter, type ControlledOraclePrice } from '../adapters/oracle.js';
import { evaluateKeeperDryRun } from './dryRun.js';
import { loadSeedFile } from '../store/seedLoader.js';

function parseSeedArg(argv: string[]): string | undefined {
  const flagIndex = argv.findIndex((value) => value === '--seed');
  if (flagIndex === -1) return undefined;
  return argv[flagIndex + 1];
}

function buildControlledPricesFromSeed(loans: Awaited<ReturnType<typeof loadSeedFile>>['loans']): Record<string, ControlledOraclePrice> {
  const now = new Date().toISOString();
  const prices: Record<string, ControlledOraclePrice> = {};

  for (const loan of loans) {
    const normalizedToken = loan.collateral.token.toUpperCase();
    if (prices[normalizedToken]) continue;

    const referencePrice = loan.collateral.referencePriceUsd;
    if (referencePrice && Number(referencePrice) > 0) {
      prices[normalizedToken] = { priceUsd: referencePrice, asOf: now };
      continue;
    }

    const collateralAmount = Number(loan.collateral.amount);
    const collateralValue = Number(loan.collateral.valueUsd);
    if (Number.isFinite(collateralAmount) && collateralAmount > 0 && Number.isFinite(collateralValue) && collateralValue > 0) {
      prices[normalizedToken] = { priceUsd: String(collateralValue / collateralAmount), asOf: now };
    }
  }

  return prices;
}

async function main(): Promise<void> {
  const seedPath = parseSeedArg(process.argv.slice(2));
  const seed = await loadSeedFile(seedPath);
  const prices = buildControlledPricesFromSeed(seed.loans);

  if (Object.keys(prices).length === 0) {
    throw new Error('Keeper dry-run requires at least one token price from seed referencePriceUsd or collateral value ratio');
  }

  const oracle = createControlledOracleAdapter({ prices });
  const results = evaluateKeeperDryRun(seed.loans, oracle);

  console.log('Bóveda Batch 7 keeper dry-run (no state mutations)');
  console.table(results.map((result) => ({
    loanId: result.loanId,
    status: result.status,
    ltvBps: result.computedLtvBps,
    marginCallLtvBps: result.marginCallLtvBps,
    liquidationLtvBps: result.liquidationLtvBps,
    coverageRatioBps: result.coverageRatioBps ?? null,
    decision: result.decision,
    policy: result.policy
  })));

  const failed = results.filter((result) => result.decision === 'FAIL_CLOSED');
  if (failed.length > 0) {
    console.log(`fail_closed=${failed.length}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
