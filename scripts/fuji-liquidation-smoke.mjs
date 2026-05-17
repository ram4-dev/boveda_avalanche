import { existsSync, readFileSync } from 'node:fs';
import { ethers } from 'ethers';

loadEnvFile('.env');

const RPC_URL = process.env.BOVEDA_FUJI_RPC_URL ?? 'https://api.avax-test.network/ext/bc/C/rpc';
// Prefer canonical BOVEDA_FUJI_* env names; fall back to legacy script names for backward compatibility.
const DEPLOYER_PRIVATE_KEY = requireOneOfSecrets(['BOVEDA_FUJI_ORIGINATOR_PRIVATE_KEY', 'DEPLOYER_PRIVATE_KEY']);
const BORROWER_PRIVATE_KEY = requireOneOfSecrets(['BOVEDA_FUJI_BORROWER_PRIVATE_KEY', 'BORROWER_PRIVATE_KEY']);

const ADDRESSES = {
  borrower: '0x6f981Bf8d4fA751db294Bb62dDEB3d904514F2CF',
  originator: '0x1139dd3EF90bbA276Edf3fA7ec4efd0781E4b5bC',
  fundingPartner: '0x4b85d24F1995D1FBD93D454C4883B13f21ca34D5',
  usdc: '0x5425890298aed601595a70AB815c96711a31Bc65',
  loanRegistry: '0x75eBfec02dAE1e0cd631C2d4961c5EE1849D4Fd3',
  collateralVault: '0x45E96820551466861d20f081ab390CAA9368F68B',
  liquidationEngine: '0xe29EAEbCc8D90b18BD13AfEdbf5ceF274f3a58c4'
};

const USDC_DECIMALS = 6n;
const LOAN_AMOUNT = 10_000_000n;
const COLLATERAL_AMOUNT = 15_000_000n;
const PRICE_USDC = 1_000_000n;
const PRICE_DECIMALS = 6n;
const LTV_BPS = 6667;
const DEFAULTED_STATUS = 5;

const erc20Abi = [
  'function balanceOf(address account) view returns (uint256)',
  'function allowance(address owner, address spender) view returns (uint256)',
  'function approve(address spender, uint256 amount) returns (bool)',
  'function decimals() view returns (uint8)',
  'function symbol() view returns (string)'
];

const loanRegistryAbi = [
  'function createLoan(address borrower,address originator,address collateralToken,uint256 collateralAmount,uint256 loanAmount,uint256 ltv,uint256 dueDate) returns (uint256 loanId)',
  'function setLoanStatus(uint256 loanId,uint8 newStatus)',
  'function getLoanStatus(uint256 loanId) view returns (uint8)',
  'event LoanCreated(uint256 indexed loanId,address indexed borrower,address indexed originator,address collateralToken,uint256 collateralAmount,uint256 loanAmount,uint256 ltv)'
];

const collateralVaultAbi = [
  'function depositCollateral(uint256 loanId,uint256 amount)',
  'function getVault(uint256 loanId) view returns (tuple(uint256 loanId,address collateralToken,uint256 amount,address borrower,bool locked,bool liquidated))'
];

const liquidationEngineAbi = [
  'function canLiquidate(uint256 loanId,uint256 collateralPrice,uint256 priceDecimals) view returns (bool allowed,string reason)',
  'function liquidateLoan(uint256 loanId,uint256 collateralPrice,uint256 priceDecimals,address fundingPartner)',
  'event LoanLiquidated(uint256 indexed loanId,uint256 proceedsAmount,address indexed proceedsToken,address indexed fundingPartner,uint256 fundingPartnerAmount,uint256 originatorFeeAmount,uint256 borrowerRemainderAmount)'
];

const provider = new ethers.JsonRpcProvider(RPC_URL);
const operator = new ethers.Wallet(DEPLOYER_PRIVATE_KEY, provider);
const borrowerSigner = new ethers.Wallet(BORROWER_PRIVATE_KEY, provider);

assertAddress('operator', operator.address, ADDRESSES.originator);
assertAddress('borrower', borrowerSigner.address, ADDRESSES.borrower);

const usdc = new ethers.Contract(ADDRESSES.usdc, erc20Abi, provider);
const registryAsOperator = new ethers.Contract(ADDRESSES.loanRegistry, loanRegistryAbi, operator);
const vaultAsBorrower = new ethers.Contract(ADDRESSES.collateralVault, collateralVaultAbi, borrowerSigner);
const engineAsOperator = new ethers.Contract(ADDRESSES.liquidationEngine, liquidationEngineAbi, operator);

const participants = [
  ['Borrower', ADDRESSES.borrower],
  ['FundingPartner', ADDRESSES.fundingPartner],
  ['Originator', ADDRESSES.originator],
  ['CollateralVault', ADDRESSES.collateralVault],
  ['LiquidationEngine', ADDRESSES.liquidationEngine]
];

console.log('Fuji liquidation smoke: 10 USDC principal / 15 USDC collateral');
console.log('Operator:', operator.address);
console.log('Borrower:', borrowerSigner.address);
console.log('FundingPartner:', ADDRESSES.fundingPartner);
console.log('USDC:', ADDRESSES.usdc);

const symbol = await usdc.symbol();
const decimals = await usdc.decimals();
if (symbol !== 'USDC' || Number(decimals) !== Number(USDC_DECIMALS)) {
  throw new Error(`Unexpected token metadata: ${symbol} decimals=${decimals}`);
}

await printBalances('before');
await requireBalance(ADDRESSES.borrower, COLLATERAL_AMOUNT, 'borrower collateral');

const dueDate = BigInt(Math.floor(Date.now() / 1000) + 90 * 24 * 60 * 60);
const createTx = await registryAsOperator.createLoan(
  ADDRESSES.borrower,
  ADDRESSES.originator,
  ADDRESSES.usdc,
  0,
  LOAN_AMOUNT,
  LTV_BPS,
  dueDate
);
const createReceipt = await createTx.wait();
const loanId = extractLoanId(createReceipt);
console.log('LoanCreated tx:', createTx.hash);
console.log('LoanId:', loanId.toString());

const currentAllowance = await usdc.connect(borrowerSigner).allowance(ADDRESSES.borrower, ADDRESSES.collateralVault);
if (currentAllowance < COLLATERAL_AMOUNT) {
  const approveTx = await usdc.connect(borrowerSigner).approve(ADDRESSES.collateralVault, COLLATERAL_AMOUNT);
  await approveTx.wait();
  console.log('USDC approve tx:', approveTx.hash);
} else {
  console.log('USDC approve skipped: existing allowance is enough');
}

const depositTx = await vaultAsBorrower.depositCollateral(loanId, COLLATERAL_AMOUNT);
await depositTx.wait();
console.log('Collateral deposit tx:', depositTx.hash);

const statusAfterDeposit = await registryAsOperator.getLoanStatus(loanId);
console.log('Status after deposit:', statusAfterDeposit.toString());

const defaultTx = await registryAsOperator.setLoanStatus(loanId, DEFAULTED_STATUS);
await defaultTx.wait();
console.log('Default status tx:', defaultTx.hash);

const [allowed, reason] = await engineAsOperator.canLiquidate(loanId, PRICE_USDC, PRICE_DECIMALS);
console.log('canLiquidate:', allowed, reason);
if (!allowed) throw new Error(`Liquidation not allowed: ${reason}`);

const liquidationTx = await engineAsOperator.liquidateLoan(loanId, PRICE_USDC, PRICE_DECIMALS, ADDRESSES.fundingPartner);
const liquidationReceipt = await liquidationTx.wait();
console.log('Liquidation tx:', liquidationTx.hash);

const finalStatus = await registryAsOperator.getLoanStatus(loanId);
const finalVault = await vaultAsBorrower.getVault(loanId);
console.log('Final loan status:', finalStatus.toString());
console.log('Final vault amount:', finalVault.amount.toString());
console.log('Final vault locked:', finalVault.locked);
console.log('Final vault liquidated:', finalVault.liquidated);

for (const log of liquidationReceipt.logs) {
  try {
    const parsed = engineAsOperator.interface.parseLog(log);
    if (parsed?.name === 'LoanLiquidated') {
      console.log('LoanLiquidated event:', JSON.stringify({
        loanId: parsed.args.loanId.toString(),
        proceedsAmount: formatUsdc(parsed.args.proceedsAmount),
        fundingPartnerAmount: formatUsdc(parsed.args.fundingPartnerAmount),
        originatorFeeAmount: formatUsdc(parsed.args.originatorFeeAmount),
        borrowerRemainderAmount: formatUsdc(parsed.args.borrowerRemainderAmount)
      }));
    }
  } catch {}
}

await printBalances('after');
console.log('Smoke complete');

function loadEnvFile(path) {
  if (!existsSync(path)) return;
  const lines = readFileSync(path, 'utf8').split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const separator = trimmed.indexOf('=');
    if (separator === -1) continue;
    const key = trimmed.slice(0, separator).trim();
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key) || process.env[key]) continue;
    let value = trimmed.slice(separator + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    process.env[key] = value;
  }
}

function requireSecret(name) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required`);
  return value;
}

function requireOneOfSecrets(names) {
  for (const name of names) {
    const value = process.env[name];
    if (value) return value;
  }
  throw new Error(`One of these env vars is required: ${names.join(', ')}`);
}

function assertAddress(label, actual, expected) {
  if (actual.toLowerCase() !== expected.toLowerCase()) {
    throw new Error(`${label} signer mismatch: expected ${expected}, got ${actual}`);
  }
}

async function requireBalance(address, amount, label) {
  const balance = await usdc.balanceOf(address);
  if (balance < amount) {
    throw new Error(`Insufficient ${label} balance: need ${formatUsdc(amount)}, got ${formatUsdc(balance)}`);
  }
}

async function printBalances(label) {
  console.log(`Balances ${label}:`);
  for (const [name, address] of participants) {
    const balance = await usdc.balanceOf(address);
    console.log(`  ${name}: ${formatUsdc(balance)} USDC`);
  }
}

function formatUsdc(value) {
  return ethers.formatUnits(value, Number(USDC_DECIMALS));
}

function extractLoanId(receipt) {
  for (const log of receipt.logs) {
    try {
      const parsed = registryAsOperator.interface.parseLog(log);
      if (parsed?.name === 'LoanCreated') return parsed.args.loanId;
    } catch {}
  }
  throw new Error('LoanCreated event not found');
}
