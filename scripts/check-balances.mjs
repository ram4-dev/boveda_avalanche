import { ethers } from 'ethers';
const p = new ethers.JsonRpcProvider('https://api.avax-test.network/ext/bc/C/rpc');
const USDC = '0x5425890298aed601595a70AB815c96711a31Bc65';
const ADDRESSES = {
  Borrower: '0x6f981Bf8d4fA751db294Bb62dDEB3d904514F2CF',
  Originator: '0x1139dd3EF90bbA276Edf3fA7ec4efd0781E4b5bC',
  FundingPartner: '0x4b85d24F1995D1FBD93D454C4883B13f21ca34D5',
  CollateralVault: '0x45E96820551466861d20f081ab390CAA9368F68B',
  LiquidationEngine: '0xe29EAEbCc8D90b18BD13AfEdbf5ceF274f3a58c4'
};
const usdc = new ethers.Contract(USDC, ['function balanceOf(address) view returns (uint256)'], p);
console.log('=== USDC balances (Fuji) ===');
for (const [name, addr] of Object.entries(ADDRESSES)) {
  const b = await usdc.balanceOf(addr);
  console.log(`  ${name.padEnd(20)}: ${(Number(b) / 1e6).toFixed(2).padStart(8)} USDC`);
}

const reg = new ethers.Contract('0x75eBfec02dAE1e0cd631C2d4961c5EE1849D4Fd3',
  ['function getLoanStatus(uint256) view returns (uint8)'], p);
const labels = ['Requested', 'Approved', 'Active', 'MarginCall', 'Repaid', 'Defaulted', 'Liquidated', 'Cancelled'];
console.log('\n=== LoanRegistry loan statuses ===');
for (const id of [1, 2, 3, 4, 5]) {
  try {
    const s = Number(await reg.getLoanStatus(id));
    console.log(`  loanId=${id}: ${labels[s] ?? `unknown(${s})`}`);
  } catch (e) {
    console.log(`  loanId=${id}: not found`);
  }
}
