# Boveda Avalanche Hackathon

Boveda is a credit infrastructure demo for MXN loans backed by on-chain collateral. The app runs a React/Vite frontend, a Fastify API, and Solidity contracts deployed on Avalanche Fuji.

## Live URLs

- App: https://hackathones.ram4.dev/
- Landing: https://hackathones.ram4.dev/landing
- Pitch deck: https://hackathones.ram4.dev/pitch
- Runtime: https://hackathones.ram4.dev/runtime
- Health: https://hackathones.ram4.dev/health

## Stack

- Frontend: React 19, Vite, TypeScript
- Backend: Node.js, Fastify, TypeScript, Vercel serverless functions
- Blockchain: Solidity, Foundry, ethers.js
- Network: Avalanche Fuji
- Collateral token: Fuji USDC

## Run Locally

```bash
npm install
npm run dev:fuji
npm run dev:web
```

For validation:

```bash
npm run typecheck
npm run build:web
```

## Avalanche Fuji Deployment

- Network: Avalanche Fuji
- Chain ID: `43113`
- Explorer: `https://testnet.snowtrace.io`
- Contract config: `config/fuji-contracts.json`
- Deploy evidence: `docs/demo/fuji-demo-addresses.md`

### Smart Contract Addresses

| Contract | Address | Explorer |
| --- | --- | --- |
| LoanRegistry | `0x75eBfec02dAE1e0cd631C2d4961c5EE1849D4Fd3` | https://testnet.snowtrace.io/address/0x75eBfec02dAE1e0cd631C2d4961c5EE1849D4Fd3 |
| CollateralVault | `0x45E96820551466861d20f081ab390CAA9368F68B` | https://testnet.snowtrace.io/address/0x45E96820551466861d20f081ab390CAA9368F68B |
| LoanReceiptNFT | `0x03AbD300629808fA9763DdB820469B2FC065e64F` | https://testnet.snowtrace.io/address/0x03AbD300629808fA9763DdB820469B2FC065e64F |
| PaymentAttestation | `0x3dDC450C16231807d63f560c01455808ce130B0e` | https://testnet.snowtrace.io/address/0x3dDC450C16231807d63f560c01455808ce130B0e |
| LiquidationEngine | `0xe29EAEbCc8D90b18BD13AfEdbf5ceF274f3a58c4` | https://testnet.snowtrace.io/address/0xe29EAEbCc8D90b18BD13AfEdbf5ceF274f3a58c4 |
| ChainlinkPriceOracle | `0xd2DD7E68963343A5b22fC6757d50Cf27Fdf4bdB4` | https://testnet.snowtrace.io/address/0xd2DD7E68963343A5b22fC6757d50Cf27Fdf4bdB4 |

### Token Address

| Token | Address | Notes | Explorer |
| --- | --- | --- | --- |
| Fuji USDC | `0x5425890298aed601595a70AB815c96711a31Bc65` | 6 decimals; used as collateral and liquidation proceeds token. | https://testnet.snowtrace.io/address/0x5425890298aed601595a70AB815c96711a31Bc65 |

### Demo Wallets

| Role | Address |
| --- | --- |
| Borrower / Nova Labs | `0x6f981Bf8d4fA751db294Bb62dDEB3d904514F2CF` |
| Originator / Operator / Attestor / Admin | `0x1139dd3EF90bbA276Edf3fA7ec4efd0781E4b5bC` |
| FundingPartner / Boveda Demo Credit Pool | `0x4b85d24F1995D1FBD93D454C4883B13f21ca34D5` |

## Demo Economics

| Field | Amount |
| --- | ---: |
| Principal | 10 USDC |
| Collateral | 15 USDC |
| Funding partner liquidation recovery | 10 USDC |
| Originator liquidation fee | 0.5 USDC |
| Borrower liquidation remainder | 4.5 USDC |

## Environment Variables

The live Fuji API requires these variables in Vercel or local `.env` files. Do not commit secret values.

- `BOVEDA_RUNTIME_MODE=fuji`
- `BOVEDA_FUJI_ORIGINATOR_PRIVATE_KEY`
- `BOVEDA_FUJI_BORROWER_PRIVATE_KEY`
- `BOVEDA_FUJI_ATTESTOR_PRIVATE_KEY`
- `BOVEDA_FUJI_FUNDING_PARTNER_ADDRESS`

## Useful Paths

- `contracts/`: Solidity contracts
- `src/`: Fastify API and domain logic
- `api/index.ts`: Vercel serverless entrypoint
- `web/src/`: React frontend
- `web/public/landing/`: static landing page
- `web/public/pitch/`: static pitch deck
- `config/fuji-contracts.json`: canonical Fuji contract addresses and ABI artifact paths
