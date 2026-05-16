# Proposal — Batch 5 E2E Integration

## Change ID
`batch-5-e2e-integration`

## Intent
Batch 5 turns the existing Bóveda Avalanche pieces into a repeatable, evidence-forward end-to-end hackathon demo. Batches 1–4 already provide deployed contract artifacts, a mock-first Fastify API, a borrower widget, and an institutional dashboard. This change formalizes the integration layer, runtime mode separation, evidence visibility, and reset process needed to demonstrate the complete flow twice without improvisation or misleading mock/live claims.

Prior Batch 2/3/4 and demo-control artifacts must be preserved as historical and functional inputs. This proposal adds a new Batch 5 change package; it does not archive, rewrite, or delete previous change artifacts.

## Decisions Captured
- Normal `/` represents the real Fuji-backed API mode.
- `/demo` represents labeled mock/demo mode.
- Mock evidence must be labeled as simulated and must not be presented as live chain evidence.
- Batch 5 acceptance requires repeated demo evidence: the full demo can run twice consecutively, with links to transactions/events where available.
- Reset requires both a script and a runbook.
- The Fuji broadcast artifact is the authoritative source for contract address labels.
- Corrected broadcast-authoritative contract mapping:
  - LoanRegistry: `0xb6832e4c43e97d5ad11e99abcb23d9a734a4be14`
  - CollateralVault: `0xe550a10f585e5595ae187f08a701bdef890de057`
  - LoanReceiptNFT: `0xf88b6e8c107a0a5da6f398734783541cbe12a38c`
  - PaymentAttestation: `0xa222a02e828d5480be971b80d4157f2abe1fabda`
  - LiquidationEngine: `0x212f6565319caa343c8c39e9b11a447febf2055a`
- No secrets in repo: do not read, print, commit, or derive `.env` values, private keys, credentials, tokens, seed phrases, or secret-manager outputs. Use public addresses, ABI references, examples, and placeholders only.

## Scope

### B5.1 — ABI/address configuration
- Add or update safe configuration surfaces for backend and frontend to reference deployed Fuji contract addresses and ABI artifacts.
- Source public contract addresses from `broadcast/Deploy.s.sol/43113/run-latest.json` and ABI references from committed Foundry outputs such as `out/**/*.json`.
- Keep secret-bearing runtime values outside the repository; document placeholders/examples only.
- Make the active runtime mode visible enough for operators and reviewers to distinguish Fuji-backed mode from mock mode.

### B5.2 — Happy origination flow
- Prove the complete origination path from loan creation/selection through **WAVAX collateral** deposit, activation, and receipt/transaction evidence.
- `/` should exercise the real Fuji-backed API path when live runtime prerequisites are supplied externally.
- `/demo` should continue to provide deterministic mock/demo behavior for hackathon repeatability and local fallback.
- Native AVAX is not the Batch 5 real collateral path because the deployed vault requires ERC-20 `approve` + `transferFrom` semantics.

### B5.3 — Payment attestation visibility
- Show payment attestation evidence after the borrower/payment action.
- Surface the relevant hash, transaction, event, receipt, or simulated marker in the borrower UI and institutional dashboard/event feed.
- Where live Fuji evidence exists, provide links to the relevant explorer or transaction/event source. Where evidence is simulated, label it clearly.

### B5.4 — Liquidation visibility
- Prove the liquidation path with an LTV/default trigger, liquidation outcome, USDC proceeds, and dashboard/event visibility.
- Preserve the existing state/event model from `docs/demo/states-events.md` and canonical endpoint surface from `docs/demo/openapi.yaml` unless the spec/design phase proves a minimal explicit gap.

### B5.5 — Reset script and runbook
- Provide a reset script for returning demo state to a known starting point.
- Provide a runbook that explains how to run the full demo, reset, and run it again.
- Acceptance requires the script plus runbook path to support two consecutive demo runs without improvised manual recovery.

### B5.6 — Scope freeze / no-go list
- Freeze Batch 5 after integration planning and allow only demo-critical fixes, evidence/reporting gaps, and validation issues.
- Prevent scope creep into production custody, oracle/keeper/DEX automation, broad contract redesign, or new endpoint schemas unrelated to Batch 5 evidence.

## Non-goals
- Production private-key handling in the frontend.
- Reading, committing, logging, or deriving secrets from `.env`, private keys, credentials, tokens, seed phrases, or secret-manager outputs.
- Production oracle, keeper, DEX, custody, KYC, fiat rail, or accounting automation.
- Broad contract redesign or changes to core contract semantics.
- Endpoint schema rewrites or parallel API surfaces unless a later spec/design phase identifies a minimal Batch 5 blocker.
- Claiming mock transaction hashes or local/demo events as live Fuji chain evidence.
- Batch 6 pitch materials, Batch 7 oracle/keeper/top-up work, or Batch 8 real-source dashboard expansion.

## Affected Areas
- OpenSpec artifacts under `openspec/changes/batch-5-e2e-integration/`.
- Backend composition and adapter seams, especially `src/app.ts`, `src/adapters/web3.ts`, and possible config/adapter modules for Fuji mode.
- Frontend mode routing and evidence surfaces under `web/src/`, including borrower journey, dashboard, demo controls, and API client seams where needed.
- Contract/deploy artifact references: `broadcast/Deploy.s.sol/43113/run-latest.json` and committed `out/**/*.json` ABI artifacts.
- Demo reset, runbook, and validation docs under `docs/demo/` and scripts if required.
- Existing API, lifecycle, payment, dashboard, borrower, and UI tests.

## Constraints and Dependencies
- Strict TDD remains active. Apply work must record RED, GREEN, TRIANGULATE, and REFACTOR evidence.
- Primary test runner: `npm test -- --run`.
- Full validation target: `npm test -- --run`, `npm run typecheck`, `npm run build`, `npm run lint`; add `forge build` and `forge test` if Solidity, deployment scripts, or contract artifacts are touched.
- Canonical public API surface is `docs/demo/openapi.yaml`.
- State/event semantics should follow `docs/demo/states-events.md`.
- README contract deployment status may be stale; broadcast evidence is authoritative for Batch 5 address labels.
- Review workload guard: pause before apply if planned work exceeds the 400 changed-lines budget or requires broad backend/frontend rewrites in one slice.

## Risks
- Fuji availability, RPC configuration, funded accounts, or external wallet prerequisites may be missing during demos; `/demo` must remain reliable and honestly labeled.
- Route/mode separation across `/` and `/demo` can become cross-cutting across frontend, backend, docs, and tests.
- Incorrect address labels would undermine live evidence; use the broadcast-authoritative mapping above.
- Over-expanding into endpoint rewrites or production automation would threaten reviewability and hackathon delivery.
- Mock evidence could mislead judges if not labeled clearly.
- Reset behavior can be brittle if it depends on hidden manual steps; script plus runbook must be explicit.
- Secret handling mistakes are high impact; no agent or script should inspect secret values.

## Rollback Plan
- Keep existing mock adapter and `/demo` path available as the safe fallback throughout implementation.
- If Fuji integration is unstable, disable Fuji mode via non-secret runtime configuration and continue presenting `/demo` as simulated evidence.
- Revert Batch 5 config/adapter/UI evidence changes without modifying preserved Batch 2/3/4 artifacts.
- Do not mutate contract semantics for rollback; public address/ABI references can be corrected from the broadcast artifact.
- If reset automation fails, retain the documented manual recovery path while treating script failure as a Batch 5 blocker until fixed or explicitly de-scoped.

## Success Criteria
- `openspec/changes/batch-5-e2e-integration/` contains approved proposal/spec/design/tasks artifacts before apply.
- `/` is configured and labeled as real Fuji-backed API mode when external runtime prerequisites are supplied.
- `/demo` is configured and labeled as mock/demo mode.
- Backend/frontend can resolve the corrected Fuji contract addresses and ABI references without committing or reading secrets.
- The happy origination flow shows collateral/activation/receipt evidence.
- Payment attestation evidence is visible in borrower-facing and institutional/dashboard surfaces.
- Liquidation evidence includes trigger context, outcome, USDC proceeds, and dashboard/event visibility.
- Reset script plus runbook support two consecutive full demo runs.
- Evidence includes transaction/event links where available and simulated markers only when clearly labeled.
- Existing Batch 2/3/4 functionality remains intact.
- Required validation commands pass for touched areas.
