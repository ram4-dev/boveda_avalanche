# Demo Repeatability Specification

## Purpose

Define Batch 5 reset and runbook behavior required to run the complete demo twice consecutively without improvised manual recovery or misleading evidence labels.

## Requirements

### Requirement: Reset Returns Demo State To A Known Start

The system MUST provide a reset path that returns deterministic demo state to a known starting point for the Batch 5 origination, payment attestation, liquidation, dashboard, and event evidence flows.

#### Scenario: Reset prepares deterministic demo state

- GIVEN a complete `/demo` run has changed loan, event, payment, receipt, or liquidation state
- WHEN the reset path is executed
- THEN the next `/demo` run MUST start from the documented initial demo state
- AND stale payment, liquidation, receipt, or event evidence from the prior run MUST NOT be presented as newly generated evidence.

#### Scenario: Reset outcome is verifiable

- GIVEN reset completes
- WHEN a user, test, or runbook verification checks the demo state
- THEN it MUST be possible to verify the expected starting loan states, empty or seeded event conditions, and mode labels without reading secrets.

### Requirement: Runbook Supports Two Consecutive Full Runs

The system MUST provide a runbook that explains how to execute the Batch 5 demo, reset it, and execute it again. The runbook MUST identify expected evidence checkpoints and must not depend on hidden manual steps.

#### Scenario: Operator follows the runbook twice

- GIVEN an operator has the Batch 5 runbook and no access to secret values inside the repository
- WHEN the operator performs a full demo run, executes reset, and performs a second full demo run
- THEN both runs MUST reach happy origination, payment attestation, liquidation, dashboard/event visibility, and evidence-label checkpoints
- AND any live Fuji prerequisites MUST be described as externally supplied prerequisites or placeholders rather than committed secrets.

#### Scenario: Runbook distinguishes live and demo evidence

- GIVEN the runbook describes evidence checkpoints
- WHEN it references tx hashes, events, receipts, explorer links, or simulated markers
- THEN it MUST distinguish live Fuji-backed evidence from `/demo` simulated evidence
- AND it MUST NOT instruct operators to present simulated evidence as live chain evidence.

### Requirement: Repeatability Is Strict-TDD-Friendly

The reset and runbook acceptance path MUST be testable with deterministic state and without live chain dependencies for baseline `/demo` validation.

#### Scenario: Automated repeatability test runs without secrets

- GIVEN tests run against deterministic demo state
- WHEN they execute a full demo flow, reset state, and execute the flow again
- THEN both runs MUST produce expected state transitions, evidence labels, and dashboard/event visibility
- AND tests MUST NOT read `.env` files, private keys, RPC credentials, wallet secrets, or secret-manager outputs.

### Requirement: Reset Does Not Rewrite Historical Project Artifacts

The reset path MUST NOT delete, rewrite, or invalidate prior Batch 2, Batch 3, Batch 4, demo-control, or OpenSpec history. Reset applies to demo runtime state and documented repeatability evidence only.

#### Scenario: Reset preserves prior artifacts

- GIVEN prior batch artifacts and OpenSpec change folders exist in the repository
- WHEN Batch 5 reset is executed
- THEN those artifacts MUST remain intact
- AND reset MUST NOT modify accepted historical specs, proposals, designs, verification reports, or contract semantics.
