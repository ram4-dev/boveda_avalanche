import { ethers } from 'ethers';
const p = new ethers.JsonRpcProvider('https://api.avax-test.network/ext/bc/C/rpc');
const abi = [
  'function getLoanStatus(uint256) view returns (uint8)',
  'function getLoan(uint256) view returns (tuple(uint256 id, address borrower, uint256 collateralAmount, uint256 loanAmount, uint256 originatorFeeAmount, address fundingPartner, uint256 fundingPartnerAmount, uint8 status, uint256 createdAt, uint256 updatedAt))'
];
const vaultAbi = ['function getVault(uint256) view returns (tuple(address borrower, address collateralToken, uint256 amount, bool locked, bool liquidated))'];
const registry = new ethers.Contract('0x75eBfec02dAE1e0cd631C2d4961c5EE1849D4Fd3', abi, p);
const vault = new ethers.Contract('0x45E96820551466861d20f081ab390CAA9368F68B', vaultAbi, p);
const statusLabel = ['None','Requested','Approved','Active','Repaid','Defaulted','Liquidated','Cancelled'];
for (const id of [1, 2, 3]) {
  try {
    const s = Number(await registry.getLoanStatus(id));
    const l = await registry.getLoan(id);
    const v = await vault.getVault(id).catch(() => null);
    const vaultLine = v ? `vault.amount=${(Number(v.amount)/1e6).toFixed(2)} locked=${v.locked} liquidated=${v.liquidated}` : 'no vault';
    console.log(`loanId=${id} status=${s}/${statusLabel[s] ?? 'unknown'} borrower=${l.borrower} loanAmount=${(Number(l.loanAmount)/1e6).toFixed(2)} USDC ${vaultLine}`);
  } catch (e) {
    console.log(`loanId=${id} error=${e.shortMessage ?? e.message}`);
  }
}
