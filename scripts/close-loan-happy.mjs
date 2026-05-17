// Closes a Fuji loan via the happy path: setLoanStatus(loanId, Repaid) + releaseCollateral(loanId).
// Loads .env so signer secrets are visible; values are never printed.
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { ethers } from 'ethers';

loadDotEnv(resolve(process.cwd(), '.env'));

const LOAN_ID = Number(process.env.LOAN_ID ?? process.argv[2] ?? '4');
if (!Number.isInteger(LOAN_ID) || LOAN_ID <= 0) {
  throw new Error(`Invalid LOAN_ID=${process.argv[2]}`);
}

const RPC_URL = process.env.BOVEDA_FUJI_RPC_URL ?? 'https://api.avax-test.network/ext/bc/C/rpc';
const ORIGINATOR_KEY = requireOneOf(['BOVEDA_FUJI_ORIGINATOR_PRIVATE_KEY', 'DEPLOYER_PRIVATE_KEY']);
const BORROWER_KEY = requireOneOf(['BOVEDA_FUJI_BORROWER_PRIVATE_KEY', 'BORROWER_PRIVATE_KEY']);

const ADDRESSES = {
  borrower: '0x6f981Bf8d4fA751db294Bb62dDEB3d904514F2CF',
  originator: '0x1139dd3EF90bbA276Edf3fA7ec4efd0781E4b5bC',
  usdc: '0x5425890298aed601595a70AB815c96711a31Bc65',
  loanRegistry: '0x75eBfec02dAE1e0cd631C2d4961c5EE1849D4Fd3',
  collateralVault: '0x45E96820551466861d20f081ab390CAA9368F68B'
};

const REPAID_STATUS = 4;

const provider = new ethers.JsonRpcProvider(RPC_URL);
const originator = new ethers.Wallet(ORIGINATOR_KEY, provider);
const borrower = new ethers.Wallet(BORROWER_KEY, provider);

assertAddress('originator', originator.address, ADDRESSES.originator);
assertAddress('borrower', borrower.address, ADDRESSES.borrower);

const registry = new ethers.Contract(ADDRESSES.loanRegistry, [
  'function setLoanStatus(uint256,uint8)',
  'function getLoanStatus(uint256) view returns (uint8)'
], originator);

const vault = new ethers.Contract(ADDRESSES.collateralVault, [
  'function releaseCollateral(uint256)',
  'function getVault(uint256) view returns (tuple(address borrower, address collateralToken, uint256 amount, bool locked, bool liquidated))'
], borrower);

const usdc = new ethers.Contract(ADDRESSES.usdc, ['function balanceOf(address) view returns (uint256)'], provider);
const labels = ['Requested', 'Approved', 'Active', 'MarginCall', 'Repaid', 'Defaulted', 'Liquidated', 'Cancelled'];

console.log(`Closing loanId=${LOAN_ID} via happy path (setLoanStatus(Repaid) + releaseCollateral).`);
console.log(`Originator signer: ${originator.address}`);
console.log(`Borrower signer:   ${borrower.address}`);

const beforeBorrower = await usdc.balanceOf(ADDRESSES.borrower);
const beforeVault = await usdc.balanceOf(ADDRESSES.collateralVault);
console.log(`\nBefore: borrower=${(Number(beforeBorrower)/1e6).toFixed(2)} USDC · vault=${(Number(beforeVault)/1e6).toFixed(2)} USDC`);

const currentStatus = Number(await registry.getLoanStatus(LOAN_ID));
console.log(`Loan current status: ${currentStatus}/${labels[currentStatus] ?? 'unknown'}`);
if (currentStatus !== 2 && currentStatus !== 3) {
  throw new Error(`Loan ${LOAN_ID} must be Active or MarginCall to be repaid; got ${labels[currentStatus] ?? currentStatus}`);
}

const setTx = await registry.setLoanStatus(LOAN_ID, REPAID_STATUS);
const setReceipt = await setTx.wait();
console.log(`\nsetLoanStatus(Repaid) tx: ${setTx.hash}`);
console.log(`  block: ${setReceipt?.blockNumber ?? 'unknown'}`);
console.log(`  explorer: https://testnet.snowtrace.io/tx/${setTx.hash}`);

const releaseTx = await vault.releaseCollateral(LOAN_ID);
const releaseReceipt = await releaseTx.wait();
console.log(`\nreleaseCollateral tx: ${releaseTx.hash}`);
console.log(`  block: ${releaseReceipt?.blockNumber ?? 'unknown'}`);
console.log(`  explorer: https://testnet.snowtrace.io/tx/${releaseTx.hash}`);

const afterBorrower = await usdc.balanceOf(ADDRESSES.borrower);
const afterVault = await usdc.balanceOf(ADDRESSES.collateralVault);
const finalStatus = Number(await registry.getLoanStatus(LOAN_ID));
const finalVault = await vault.getVault(LOAN_ID);

console.log(`\nAfter: borrower=${(Number(afterBorrower)/1e6).toFixed(2)} USDC · vault=${(Number(afterVault)/1e6).toFixed(2)} USDC`);
console.log(`Final loan status: ${finalStatus}/${labels[finalStatus] ?? 'unknown'}`);
console.log(`Final vault: amount=${(Number(finalVault.amount)/1e6).toFixed(2)} locked=${finalVault.locked} liquidated=${finalVault.liquidated}`);
console.log('\nHappy path complete.');

function loadDotEnv(path) {
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

function requireOneOf(names) {
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
