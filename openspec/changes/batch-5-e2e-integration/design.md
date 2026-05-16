# Design — batch-5-e2e-integration

## status
complete

## executive_summary
Batch 5 should add a small runtime/evidence layer around the existing mock-first Fastify API, React borrower widget, institutional dashboard, and Foundry artifacts. The normal frontend route `/` is Fuji-backed mode and must never silently fall back to mock evidence; `/demo` is deterministic mock/demo mode. API business paths stay canonical (`/loans`, `/events`, `/dashboard/summary`, etc.); mode is selected by deployment/API base URL plus safe runtime config, and is made observable through additive runtime metadata, response headers, and evidence labels. Fuji contract configuration is public, broadcast-authoritative, ABI-validated, and secret-free. Demo repeatability is handled by a guarded demo reset route plus CLI script and runbook. Implementation should be split before apply because doing route mode, backend config/adapters, evidence UI, reset, docs, and validation in one slice is likely over the 400 changed-line review budget.

## inputs_read
- `.pi-chain-runs/batch-5-sdd-plan/ba0bf12e/sdd-chain/proposal.md`
- `.pi-chain-runs/batch-5-sdd-plan/ba0bf12e/sdd-chain/spec.md`
- `openspec/config.yaml`
- `openspec/changes/batch-5-e2e-integration/specs/*/spec.md`
- `context-build/batch-5-e2e-context.md`
- `src/app.ts`
- `src/adapters/web3.ts`
- `src/modules/loans/routes.ts`
- `src/modules/payments/routes.ts`
- `src/modules/dashboard/routes.ts`
- `src/modules/events/routes.ts`
- `src/store/demoStore.ts`
- `web/src/App.tsx`
- `web/src/api/client.ts`
- `web/src/state/borrowerJourney.ts`
- `web/src/screens/LoanActivityScreen.tsx`
- `web/src/screens/InstitutionalDashboardScreen.tsx`
- `web/src/components/EventTimeline.tsx`
- `web/src/components/AuditTrail.tsx`
- `web/src/components/LoanDetailPanel.tsx`
- `broadcast/Deploy.s.sol/43113/run-latest.json`
- `package.json`
- selected existing tests under `tests/` and `web/src/`

## decisions

### 0. Real collateral token and verification posture
- Current deployed contracts support ERC-20 collateral, not native AVAX. `CollateralVault.depositCollateral` uses ERC-20 `transferFrom`, and `LoanRegistry.createLoan` rejects zero-address collateral tokens.
- For the first real Fuji E2E, use **WAVAX on Fuji as collateral** and keep **USDC as the liquidation proceeds currency**. WAVAX preserves the AVAX collateral narrative while satisfying ERC-20 `approve`/`transferFrom` vault mechanics. Treat **BTC.b as stretch-only** until a Fuji contract/funding path is prevalidated.
- The frontend wallet prompt is not proof of deposit. Backend must independently verify transaction receipt, token transfer logs, `CollateralDeposited`, `LoanRegistry.getLoan(loanId)`, and `CollateralVault.getVault(loanId)` before marking collateral evidence as `fuji-live`.
- Detailed documentation lives in `docs/demo/fuji-real-e2e-collateral-verification.md`.

### 1. Runtime route model: frontend route chooses mode; API paths remain canonical
- `/` means **Fuji-backed mode**.
- `/demo` means **deterministic mock/demo mode**.
- The React app should derive mode from `window.location.pathname` through a small pure resolver, for example `resolveRuntimeRoute(pathname)`.
- No React router is required for Batch 5; the existing single-screen app can keep internal borrower/dashboard view state and add a top-level `runtimeMode` prop/context.
- The frontend API client should resolve base URL by mode:
  - Fuji mode: `VITE_BOVEDA_FUJI_API_BASE_URL`, then legacy `VITE_BOVEDA_API_BASE_URL`, then same-origin.
  - Demo mode: `VITE_BOVEDA_DEMO_API_BASE_URL`, then legacy `VITE_BOVEDA_API_BASE_URL`, then same-origin.
- API business endpoints should remain the canonical paths from `docs/demo/openapi.yaml`; do not create `/demo/loans`, `/demo/events`, or parallel business schemas.
- The API should expose mode observability additively, preferably via:
  - `GET /runtime` for safe public runtime metadata; and
  - `x-boveda-runtime-mode` / `x-boveda-evidence-source` response headers on canonical API responses.
- The frontend should compare route mode with API-reported mode. A mismatch must render configuration-needed guidance instead of presenting the data as correct live or demo evidence.

Rationale: this preserves the existing canonical API contract while allowing `/` and `/demo` to point at separate API deployments or ports during the hackathon. It avoids request-level adapter switching inside a single Fastify route graph, which would be a larger refactor because current route modules receive `store` and `web3` at registration time.

### 2. API mode selection: no silent mock fallback for `/`
Add a small runtime composition module around `buildFastifyApp`:

```ts
type RuntimeMode = 'fuji' | 'demo';
type EvidenceSource = 'fuji-live' | 'fuji-unavailable' | 'demo-simulated';

type RuntimeConfig = {
  mode: RuntimeMode;
  chainId: 43113;
  networkName: 'Avalanche Fuji';
  explorerBaseUrl: string;
  contracts: FujiContractConfig[];
  abiStatus: 'valid' | 'invalid';
  prerequisites: 'ready' | 'missing' | 'unavailable';
};
```

Adapter composition should be:

1. `demo` mode → `createMockWeb3Adapter({ evidenceSource: 'demo-simulated' })` and deterministic `DemoStore.fromSeed(...)`.
2. `fuji` mode + valid public config + externally supplied runtime prerequisites → `createFujiWeb3Adapter(...)` behind the existing `Web3Adapter` interface.
3. `fuji` mode + missing/unavailable prerequisites → `createUnavailableWeb3Adapter(...)` that returns safe `WEB3_UNAVAILABLE` errors for write-like operations and reports `fuji-unavailable`; it must not call the mock adapter.

`buildFastifyApp(deps?: Partial<AppDeps> & { runtime?: RuntimeConfig })` can continue supporting test injection. Production/default construction should use a safe `loadRuntimeConfig` that only reads named non-secret mode/public settings and validates public contract/ABI files. It must not log or print RPC URLs, private keys, tokens, seed phrases, or `.env` values.

### 3. Web3 adapter contract: keep the seam, add evidence metadata at boundaries
The existing `Web3Adapter` methods are the right seam:
- `activateLoan`
- `registerPaymentAttestation`
- `liquidateLoan`
- optional `refreshPendingEvents`

Keep these methods, but add backward-compatible metadata to outcomes rather than changing endpoint paths:

```ts
type EvidenceRef = {
  mode: 'fuji' | 'demo';
  source: 'fuji-live' | 'fuji-unavailable' | 'demo-simulated';
  status: 'live' | 'pending' | 'unavailable' | 'simulated';
  label: string;
  txHash?: `0x${string}`;
  blockNumber?: number | null;
  explorerUrl?: string;
  contracts?: Array<{ name: FujiContractName; address: `0x${string}`; abiArtifact: string }>;
};
```

Route handlers should continue writing canonical `txHash` and `blockNumber` fields for compatibility, and should add evidence metadata inside event payloads and/or additive response fields where useful. Existing UI/tests that only depend on canonical fields should continue working.

Suggested contract-to-operation mapping:
- Loan creation/selection and activation context: `LoanRegistry`, `CollateralVault`, `LoanReceiptNFT`.
- Collateral deposit evidence: `CollateralVault` plus supplied deposit tx hash when present.
- Payment attestation: `PaymentAttestation`.
- Liquidation: `LiquidationEngine`, and `CollateralVault` when collateral release/proceeds context is shown.

### 4. Fuji contract config: broadcast-authoritative, public, ABI-validated
Create a committed public config source for backend validation, for example `config/fuji-contracts.json`, with no secrets:

```json
{
  "chainId": 43113,
  "networkName": "Avalanche Fuji",
  "explorerBaseUrl": "https://testnet.snowtrace.io",
  "contracts": {
    "LoanRegistry": {
      "address": "0xb6832e4c43e97d5ad11e99abcb23d9a734a4be14",
      "abiArtifact": "out/LoanRegistry.sol/LoanRegistry.json"
    },
    "CollateralVault": {
      "address": "0xe550a10f585e5595ae187f08a701bdef890de057",
      "abiArtifact": "out/CollateralVault.sol/CollateralVault.json"
    },
    "LoanReceiptNFT": {
      "address": "0xf88b6e8c107a0a5da6f398734783541cbe12a38c",
      "abiArtifact": "out/LoanReceiptNFT.sol/LoanReceiptNFT.json"
    },
    "PaymentAttestation": {
      "address": "0xa222a02e828d5480be971b80d4157f2abe1fabda",
      "abiArtifact": "out/PaymentAttestation.sol/PaymentAttestation.json"
    },
    "LiquidationEngine": {
      "address": "0x212f6565319caa343c8c39e9b11a447febf2055a",
      "abiArtifact": "out/LiquidationEngine.sol/LiquidationEngine.json"
    }
  }
}
```

The config validator should:
- verify every required contract name exists;
- verify every address is a hex address;
- verify the mapping matches `broadcast/Deploy.s.sol/43113/run-latest.json` for the five accepted contracts;
- verify each ABI artifact exists and contains an `abi` array;
- return a safe validation error if anything is missing or mismatched;
- never read `.env`, private keys, RPC credentials, tokens, seed phrases, or secret manager output.

The frontend should not duplicate ABI artifacts. It should receive public contract evidence through `/runtime` and operation/event payloads.

### 5. Explorer link model: deterministic and source-gated
Add a tiny pure helper shared conceptually by backend and frontend, implemented separately if needed:

```ts
buildFujiExplorerLink(kind: 'tx' | 'address' | 'block', value: string | number, evidenceSource: EvidenceSource): string | null
```

Rules:
- Only return links for `evidenceSource === 'fuji-live'`.
- Only return links when `explorerBaseUrl` is configured from public config and the value is syntactically valid.
- For simulated evidence, missing evidence, pending evidence, invalid hashes, or unavailable Fuji mode, return `null` and render a label instead.
- Link labels should be explicit: `View Fuji tx`, `View Fuji contract`, `View Fuji block`.
- Do not link deterministic mock hashes, even if they start with `0x`.

Recommended URL forms with the configured base:
- transaction: `${explorerBaseUrl}/tx/${txHash}`
- address/contract: `${explorerBaseUrl}/address/${address}`
- block: `${explorerBaseUrl}/block/${blockNumber}`

### 6. UI labels: route mode and evidence source must be visible everywhere evidence appears
Add a small frontend runtime/evidence layer:
- `web/src/runtime/runtimeMode.ts`: route/base-URL resolver and labels.
- `web/src/runtime/evidence.ts`: evidence label/explorer helpers.
- `RuntimeModeBanner` or equivalent near the existing header.
- `EvidenceBadge` and `ExplorerLink` helpers used by borrower activity, event timeline, audit trail, and loan detail.

Labels should be unambiguous:
- `/` healthy Fuji: `Fuji live mode — Avalanche Fuji evidence enabled`.
- `/` missing prerequisites: `Fuji mode unavailable — live chain evidence pending. Use /demo for deterministic simulated evidence.`
- `/demo`: `Demo mode — simulated evidence only; no live Fuji finality.`
- Simulated tx/event/receipt: `Simulated demo evidence`.
- Live tx/event/receipt: `Fuji live evidence`.
- Missing live evidence: `Fuji evidence pending/unavailable`.

Button and copy adjustments:
- In `/demo`, keep verbs like `Record simulated collateral deposit`, `Attest simulated payment`, `Simulate liquidation`.
- In `/`, use Fuji-aware copy such as `Record Fuji collateral evidence`, `Attest payment on Fuji`, `Execute Fuji liquidation`, but disable or show configuration-needed guidance when the API reports `fuji-unavailable`.
- Do not claim a mock transaction is live merely because it is hash-shaped.

### 7. Cross-surface evidence data flow

#### Fuji or demo operation flow
1. Frontend route resolver selects `runtimeMode` and API base URL.
2. Frontend loads `GET /runtime` and canonical borrower/dashboard endpoints.
3. API runtime config selects `Web3Adapter` at startup.
4. Borrower action calls existing canonical endpoint.
5. Route handler performs canonical state checks and calls `web3` if needed.
6. Adapter returns tx/block/receipt/evidence metadata:
   - mock adapter: deterministic hash + `demo-simulated`;
   - Fuji adapter: live tx/block/contract evidence when prerequisites and operation succeed;
   - unavailable adapter: safe error or pending/unavailable evidence, never fabricated live hashes.
7. Store records canonical loan state and events with additive evidence metadata.
8. Borrower UI, dashboard summary/detail, and event feed render the same loan ID, same state, same evidence source, and source-gated explorer links.

#### Existing canonical state semantics
- Keep state transitions in `src/domain/stateMachine.ts` and route handlers authoritative.
- Keep canonical endpoints from `docs/demo/openapi.yaml`.
- Do not redesign Solidity contracts or introduce keeper/oracle/DEX/custody/KYC flows for Batch 5.

### 8. Reset script and runbook
Use a guarded reset path for deterministic demo state only.

Backend changes:
- Add `DemoStore.reset(seed?: SeedFile)` or rebuild store state through a small reset controller.
- Register `POST /demo/reset` only when runtime mode is `demo` and demo reset is enabled.
- The reset handler should restore loans/events/risk/payment attestations from `data/demo/loans.seed.json`.
- The reset response should include safe evidence only: mode, reset timestamp, seed source path, loan count, event count, and a simulated/demo label.
- In `fuji` mode, the reset route should be unavailable or return a safe 404/403; it must not mutate live chain state or historical artifacts.

Script changes:
- Add an npm script such as `demo:reset` that invokes a small Node script (`scripts/demo-reset.mjs` or `.ts` if existing tooling supports it).
- The script should call the demo API reset endpoint using a non-secret public base URL argument or environment variable name; it must not print secret-bearing env values.
- The script should verify `GET /runtime` reports demo mode before reset, then verify expected starting state after reset.

Runbook changes:
- Add or update `docs/demo/e2e-runbook.md`.
- Include two consecutive runs:
  1. open `/demo`;
  2. run happy origination evidence checkpoint;
  3. run payment attestation checkpoint;
  4. run margin-call/liquidation checkpoint;
  5. inspect dashboard/audit trail/loan detail evidence labels;
  6. run `npm run demo:reset -- --base-url <demo-api-url>`;
  7. repeat the complete run and confirm prior payment/liquidation evidence is not presented as newly generated.
- Document Fuji prerequisites only as external/operator-supplied placeholders, never values.

### 9. Validation strategy
Strict TDD is active; apply must record RED/GREEN/TRIANGULATE/REFACTOR evidence.

Recommended test additions by slice:

1. Runtime/config unit tests
   - `src/config/runtime.test.ts` or equivalent.
   - Assert corrected Fuji address mapping.
   - Assert ABI artifact association exists for each required contract.
   - Assert missing ABI/address mismatch returns safe config error.
   - Assert tests use fixtures/injected config, not `.env` or live Fuji.

2. Adapter composition tests
   - Demo mode selects mock adapter and labels evidence `demo-simulated`.
   - Fuji mode with missing prerequisites selects unavailable adapter and never falls back to mock.
   - Fuji mode with injected fake Fuji adapter returns `fuji-live` evidence.

3. API route/mode tests
   - `GET /runtime` returns safe public mode/config metadata.
   - Canonical endpoints include mode/evidence headers.
   - Mutations in unavailable Fuji mode surface safe `WEB3_UNAVAILABLE` or equivalent errors without fabricated hashes.
   - Demo reset endpoint resets state and is unavailable in Fuji mode.

4. Frontend runtime route tests
   - `/` resolves Fuji mode and Fuji API base URL.
   - `/demo` resolves demo mode and demo API base URL.
   - Route/API mode mismatch renders configuration-needed guidance.

5. Frontend evidence rendering tests
   - Borrower activity, `EventTimeline`, `AuditTrail`, and `LoanDetailPanel` show `Fuji live`, `Fuji unavailable`, or `Simulated demo` labels.
   - Explorer links render only for `fuji-live` valid tx/address/block evidence.
   - Mock hashes never become explorer links.

6. E2E repeatability test
   - In a deterministic app/test harness, execute flow once, reset, execute again.
   - Assert starting state after reset and evidence labels on both runs.

Required validation commands for touched areas:
- `npm test -- --run`
- `npm run typecheck`
- `npm run build`
- `npm run lint`
- `forge build` and `forge test` only if Solidity, deploy scripts, or contract artifacts are changed. This design recommends not touching Solidity or deployment scripts for Batch 5.

### 10. Rollout and fallback

Rollout order:
1. Add runtime/config validation and safe contract metadata.
2. Add adapter composition and unavailable-Fuji behavior.
3. Add frontend route mode resolver and API base URL selection.
4. Add evidence labels/explorer links to borrower and dashboard surfaces.
5. Add demo reset script/runbook and repeatability tests.

Fallback behavior:
- `/demo` remains the reliable deterministic path throughout implementation.
- If Fuji prerequisites are absent, `/` shows unavailable/configuration-needed state and directs users to `/demo`; it must not call the mock adapter and present results as live.
- If ABI/address validation fails, Fuji mode should report configuration error and disable live evidence actions.
- If explorer URL construction fails, render the evidence value and label without a link.
- If reset automation fails, document manual recovery but treat the script failure as a Batch 5 blocker unless explicitly de-scoped.

Rollback:
- Revert Batch 5 runtime/evidence/config/reset additions without changing preserved Batch 2/3/4 artifacts.
- Keep canonical endpoints and mock adapter behavior available.
- Do not mutate contract semantics to roll back.

### 11. Review workload risk and slicing recommendation
A single implementation slice would touch backend config, adapter composition, route metadata, frontend routing, API client, borrower UI, dashboard UI, reset script, docs, and tests. That is likely above the 400 changed-line review budget.

Recommended review slices before apply:
1. **Runtime config + adapter selection**: backend public config, ABI/address validation, runtime metadata, unavailable-Fuji adapter, tests.
2. **Frontend route mode + API base selection**: `/` vs `/demo`, mode banner, API runtime metadata client, mismatch handling, tests.
3. **Evidence rendering**: borrower + dashboard evidence labels and explorer-link integrity, tests.
4. **Reset/runbook/repeatability**: demo reset endpoint/script/runbook and two-run deterministic test.

Pause before `sdd-apply` if tasks forecast these slices still exceed 400 changed lines each, require contract semantic changes, or require adding a new web3 dependency/signing path beyond the existing adapter seam.

## risks
- True live Fuji writes may require a signer/RPC client dependency or externally injected service not currently present in dependencies. If that scope becomes necessary, it should be explicitly approved before apply.
- Running `/` and `/demo` simultaneously is simplest with two API instances or base URLs; a single in-process request-selected API would require broader route/store refactoring.
- Adding `GET /runtime` is an additive endpoint; reviewers should confirm it does not conflict with canonical API governance.
- Explorer base URL should be validated during tasks; if Avalanche explorer URL preference changes, keep it public/configurable and source-gated.
- Evidence metadata added to payloads must remain backward-compatible with existing tests and UI selectors.
- Reset endpoint must be hard-disabled outside demo mode to avoid implying live-chain reset.

## artifacts
- Created: `openspec/changes/batch-5-e2e-integration/design.md`
- Created: `.pi-chain-runs/batch-5-sdd-plan/ba0bf12e/sdd-chain/design.md`

## next_recommended
Proceed to SDD `tasks` and split implementation into reviewable strict-TDD slices. Pause before apply if the task forecast exceeds the 400 changed-line budget or if live Fuji signing/RPC implementation requires a new dependency or secret-bearing runtime contract.

## memory
Engram save-back was requested, but no memory tools are exposed in this subagent runtime. Persistence was performed through OpenSpec and chain artifacts only.

## skill_resolution
none
