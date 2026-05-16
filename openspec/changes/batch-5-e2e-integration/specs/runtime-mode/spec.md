# Runtime Mode Specification

## Purpose

Define Batch 5 route-based runtime mode behavior so judges, operators, tests, and reviewers can distinguish real Fuji-backed execution from deterministic mock/demo execution without relying on hidden configuration or narrative explanation.

## Requirements

### Requirement: Route-Based Runtime Mode Separation

The system MUST treat the normal `/` application route as real Fuji-backed API mode when external runtime prerequisites are supplied, and MUST treat `/demo` as deterministic mock/demo mode. The system MUST make the active route mode observable to users and tests.

#### Scenario: Normal route represents Fuji-backed mode

- GIVEN the application is opened at `/`
- AND external Fuji runtime prerequisites are supplied outside the repository
- WHEN the borrower flow, dashboard, or event surfaces request runtime evidence
- THEN the system MUST identify the active mode as real Fuji-backed mode
- AND evidence generated in that mode MUST be eligible for live transaction, event, receipt, block, or explorer references when those values are returned.

#### Scenario: Demo route represents mock mode

- GIVEN the application is opened at `/demo`
- WHEN the borrower flow, dashboard, demo controls, or event surfaces render evidence
- THEN the system MUST identify the active mode as mock/demo mode
- AND evidence generated in that mode MUST be deterministic and labeled as simulated or demo evidence.

#### Scenario: Route mode is not inferred from stale UI state

- GIVEN a user or test navigates between `/` and `/demo`
- WHEN mode-specific evidence is rendered after navigation
- THEN the displayed mode label MUST match the current route
- AND live Fuji evidence MUST NOT be shown as simulated evidence
- AND simulated evidence MUST NOT be shown as live Fuji evidence.

### Requirement: Honest Evidence Labeling

The system MUST label every transaction, event, receipt, payment, liquidation, or reset evidence item with enough context to determine whether it is live Fuji-backed evidence, pending/unavailable live evidence, or simulated demo evidence.

#### Scenario: Live evidence is labeled as Fuji evidence

- GIVEN a Fuji-backed operation returns a transaction hash, block number, event identifier, receipt token, or contract address
- WHEN that evidence appears in the borrower UI, dashboard, event feed, runbook output, or validation report
- THEN the evidence MUST be labeled as Fuji-backed or live chain evidence
- AND it SHOULD include a safe explorer link when a deterministic public explorer URL can be constructed from non-secret data.

#### Scenario: Simulated evidence is labeled as simulated

- GIVEN `/demo` or a mock adapter returns a simulated transaction hash, event, receipt marker, or liquidation marker
- WHEN that evidence appears in any UI, event feed, runbook output, or validation report
- THEN the evidence MUST be labeled as simulated or demo evidence
- AND it MUST NOT be described as live Fuji finality.

### Requirement: Fuji Unavailability Does Not Become Silent Mock Mode

When `/` cannot complete Fuji-backed behavior because external prerequisites are absent or unavailable, the system MUST show a clear unavailable, degraded, or configuration-needed state. The system MAY point users to `/demo` as a deterministic fallback, but MUST NOT silently relabel mock output as real Fuji-backed evidence.

#### Scenario: Fuji prerequisites are missing

- GIVEN the application is opened at `/`
- AND required non-repository Fuji runtime prerequisites are not available
- WHEN a user or test attempts an operation that requires live Fuji execution
- THEN the system MUST show a safe unavailable, pending, or configuration-needed state
- AND it MUST NOT fabricate live transaction hashes, block numbers, receipt tokens, or explorer links.

#### Scenario: Demo fallback remains available

- GIVEN Fuji mode is unavailable or intentionally disabled
- WHEN a user opens `/demo`
- THEN the deterministic mock/demo flow MUST remain available
- AND the UI MUST continue labeling all generated evidence as simulated.

### Requirement: Strict-TDD-Friendly Mode Tests

The system MUST make route mode and evidence-source behavior testable without reading secrets, private keys, `.env` values, tokens, or secret-manager outputs.

#### Scenario: Automated tests assert mode behavior without secrets

- GIVEN automated tests run with deterministic fixtures or fake adapters
- WHEN they exercise `/` and `/demo` mode behavior
- THEN they MUST be able to assert the active mode, labels, and evidence-source distinctions
- AND the tests MUST NOT require live private keys, RPC credentials, wallet secrets, or `.env` inspection.
