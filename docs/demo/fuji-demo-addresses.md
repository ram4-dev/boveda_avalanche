# Fuji Demo Addresses — Real USDC Collateral

This file records public addresses for the small-amount real-chain demo. It intentionally contains no private keys, seed phrases, RPC tokens, or secret values.

## Network

- Network: Avalanche Fuji
- Chain ID: `43113`
- Explorer: `https://testnet.snowtrace.io`

## Token

| Role      | Address                                      | Notes                                                                     |
| --------- | -------------------------------------------- | ------------------------------------------------------------------------- |
| Fuji USDC | `0x5425890298aed601595a70AB815c96711a31Bc65` | 6 decimals; used as both collateral token and liquidation proceeds token. |

## Demo wallets

| Logical role                                  | Address                                      | Funding notes                                                                                              |
| --------------------------------------------- | -------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| Borrower / Nova Labs                          | `0x6f981Bf8d4fA751db294Bb62dDEB3d904514F2CF` | Has 20 USDC and 0.2 AVAX. Deposits 15 USDC collateral and releases collateral on repayment.                |
| FundingPartner / Bóveda Demo Credit Pool      | `0x4b85d24F1995D1FBD93D454C4883B13f21ca34D5` | Has 20 USDC. Receives 10 USDC principal recovery on liquidation.                                           |
| Originator / Operator / Attestor / Admin demo | `0x1139dd3EF90bbA276Edf3fA7ec4efd0781E4b5bC` | Needs AVAX for gas. Deploys contracts, initiates liquidation, and signs payment attestations for the demo. |

## Demo economics

| Field                               |   Human amount |                Base units |
| ----------------------------------- | -------------: | ------------------------: |
| Principal                           |        10 USDC |                `10000000` |
| Collateral                          |        15 USDC |                `15000000` |
| Originator fee                      | 10% of surplus | `ORIGINATOR_FEE_BPS=1000` |
| FundingPartner liquidation recovery |        10 USDC |                `10000000` |
| Originator liquidation fee          |       0.5 USDC |                  `500000` |
| Borrower liquidation remainder      |       4.5 USDC |                 `4500000` |

## Contract deployment — redeployed 2026-05-16

Slice A changed contract ABI/semantics, so these addresses supersede the previous Fuji deployment for the real USDC collateral demo.

| Contract             | Address                                      | Notes                                                               |
| -------------------- | -------------------------------------------- | ------------------------------------------------------------------- |
| LoanRegistry         | `0x75eBfec02dAE1e0cd631C2d4961c5EE1849D4Fd3` | Stores demo loans.                                                  |
| CollateralVault      | `0x45E96820551466861d20f081ab390CAA9368F68B` | Has `liquidateCollateralTo`; wired to `LiquidationEngine`.          |
| LoanReceiptNFT       | `0x03AbD300629808fA9763DdB820469B2FC065e64F` | Registrar is the operator/deployer address.                         |
| PaymentAttestation   | `0x3dDC450C16231807d63f560c01455808ce130B0e` | Attestor is `0x1139dd3EF90bbA276Edf3fA7ec4efd0781E4b5bC`.           |
| LiquidationEngine    | `0xe29EAEbCc8D90b18BD13AfEdbf5ceF274f3a58c4` | `proceedsToken` is Fuji USDC; `originatorFeeBps` is 1000.           |
| ChainlinkPriceOracle | `0xd2DD7E68963343A5b22fC6757d50Cf27Fdf4bdB4` | Deployed but not connected; not required for defaulted liquidation. |

## Deploy evidence

| Item                      | Value                                                                |
| ------------------------- | -------------------------------------------------------------------- |
| Deployer                  | `0x1139dd3EF90bbA276Edf3fA7ec4efd0781E4b5bC`                         |
| Block                     | `55446761`                                                           |
| Broadcast artifact        | `broadcast/Deploy.s.sol/43113/run-latest.json`                       |
| CollateralVault deploy tx | `0x598265fe9e49ca2f208095a270ef2a6c2d3d32e6b484868428f3add908c7fc20` |
| LoanRegistry deploy tx    | `0x08fb6881d6a48af004abada5e53ebe30d7b1ba6c6fce2f600d1262c64e4fc64f` |
| setLiquidationEngine tx   | `0x38a4da0e409c24367c663bd7d0a8cc9b0c9cdaa3bf4564c8c4ec4a7df933c41e` |

## Verified wiring

Checked on Fuji after deploy:

| Check                                        | Result                                       |
| -------------------------------------------- | -------------------------------------------- |
| `CollateralVault.loanRegistry()`             | `0x75eBfec02dAE1e0cd631C2d4961c5EE1849D4Fd3` |
| `LiquidationEngine.collateralVault()`        | `0x45E96820551466861d20f081ab390CAA9368F68B` |
| `LiquidationEngine.proceedsToken()`          | `0x5425890298aed601595a70AB815c96711a31Bc65` |
| `LiquidationEngine.originatorFeeBps()`       | `1000`                                       |
| `PaymentAttestation.attestor()`              | `0x1139dd3EF90bbA276Edf3fA7ec4efd0781E4b5bC` |
| `ChainlinkPriceOracle.maxStalenessSeconds()` | `86400`                                      |

## Secret references required for deploy

The deploy flow needs a private key for the operator/deployer account, but the value must never be committed, printed, or pasted into chat.

Expected local secret key name:

- `DEPLOYER_PRIVATE_KEY` — must correspond to `0x1139dd3EF90bbA276Edf3fA7ec4efd0781E4b5bC`.

## Liquidation smoke — 2026-05-16

Executed a real Fuji liquidation smoke using the demo wallets and contracts above.

| Step | Tx / Result |
| --- | --- |
| `LoanRegistry.createLoan` | `0xe00042a892336b0f04278639b255fa9996a998cbacafcc9c8032224aa69d1494` |
| Loan ID | `1` |
| `USDC.approve(CollateralVault, 15 USDC)` | `0x35a6b67bc907b73c182cab623269cf8f16f09ab0a78dabcfa9ef129daf47041f` |
| `CollateralVault.depositCollateral(1, 15 USDC)` | `0xbf410bff14228631383c7547780178c0d83619dc6943e9598f64f5b5352bc5d7` |
| `LoanRegistry.setLoanStatus(1, Defaulted)` | `0xe3ed6b15730e85bde3eb8918244cab41e10572a50357b0787fc1389b5a9177f2` |
| `LiquidationEngine.liquidateLoan(1, ..., FundingPartner)` | `0xa85ddbd4b7c8ec61f374418459a8beb6230ba31930afbf5c9e8dac1fe8c923a7` |
| Final loan status | `6` (`Liquidated`) |
| Final vault amount | `0` |
| Final vault liquidated | `true` |

Balance evidence:

| Account | Before | After | Delta |
| --- | ---: | ---: | ---: |
| Borrower | 20.5 USDC | 10.0 USDC | -10.5 USDC |
| FundingPartner | 20.5 USDC | 30.5 USDC | +10.0 USDC |
| Originator | 0.0 USDC | 0.5 USDC | +0.5 USDC |
| CollateralVault | 0.0 USDC | 0.0 USDC | 0.0 USDC |
| LiquidationEngine | 0.0 USDC | 0.0 USDC | 0.0 USDC |

Event evidence:

```json
{"loanId":"1","proceedsAmount":"15.0","fundingPartnerAmount":"10.0","originatorFeeAmount":"0.5","borrowerRemainderAmount":"4.5"}
```
