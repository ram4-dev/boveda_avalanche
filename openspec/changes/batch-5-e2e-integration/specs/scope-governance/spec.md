# Scope Governance Specification

## Purpose

Define Batch 5 scope-freeze behavior so implementation remains focused on end-to-end demo integration, evidence reporting, repeatability, and validation instead of expanding into production systems or broad redesign.

## Requirements

### Requirement: Batch 5 Scope Freeze

After Batch 5 integration planning, the system and project work MUST allow only demo-critical fixes, evidence/reporting gaps, reset/repeatability fixes, and validation issues that support the approved Batch 5 acceptance criteria.

#### Scenario: Demo-critical issue is allowed

- GIVEN implementation discovers a defect that blocks route mode labeling, contract evidence, origination, payment attestation, liquidation, dashboard/event visibility, reset, or required validation
- WHEN the defect is triaged under Batch 5 scope
- THEN it MAY be included as a Batch 5 fix
- AND the fix MUST remain limited to the smallest behavior needed to satisfy approved acceptance criteria.

#### Scenario: Non-critical expansion is rejected

- GIVEN a proposed change adds production custody, KYC, fiat rails, accounting, oracle automation, keeper automation, DEX automation, broad contract redesign, pitch material generation, or unrelated real-source dashboard expansion
- WHEN it is evaluated against Batch 5 scope
- THEN it MUST be rejected or deferred to a later approved change
- AND it MUST NOT be implemented as part of Batch 5.

### Requirement: Canonical API And State Semantics Are Preserved

Batch 5 MUST preserve canonical API behavior from `docs/demo/openapi.yaml` and state/event semantics from `docs/demo/states-events.md` unless an approved later design identifies a minimal explicit Batch 5 blocker.

#### Scenario: Existing endpoint surface remains canonical

- GIVEN implementation needs borrower, dashboard, loan, payment, liquidation, or event data
- WHEN endpoint paths, fields, or enum values are selected
- THEN `docs/demo/openapi.yaml` MUST remain the canonical source
- AND new parallel endpoint schemas MUST NOT be invented for convenience.

#### Scenario: Existing lifecycle semantics remain canonical

- GIVEN implementation needs to represent loan activation, payment, margin-call, default, liquidation, repayment, or terminal states
- WHEN state changes or event records are produced
- THEN `docs/demo/states-events.md` and existing accepted lifecycle semantics MUST remain authoritative
- AND core contract semantics MUST NOT be broadly redesigned for Batch 5.

### Requirement: Review Workload Guard Is Enforced Before Apply

Batch 5 planning MUST surface review workload risk before implementation. If expected changes exceed the 400 changed-lines review budget, require broad backend and frontend rewrites in one slice, touch contract semantics, or need chained delivery decisions, apply MUST pause for an explicit delivery decision.

#### Scenario: Forecast exceeds review budget

- GIVEN tasks or design forecast more than 400 changed lines or broad multi-area implementation in one slice
- WHEN apply is about to start
- THEN the project MUST pause for an explicit delivery strategy decision
- AND the work SHOULD be split into reviewable slices unless the user approves a larger Batch 5 work unit.

#### Scenario: Contract semantics change is requested

- GIVEN a proposed implementation requires Solidity semantics, deployment behavior, or contract artifact changes beyond address/ABI references
- WHEN it is evaluated for Batch 5 apply
- THEN the project MUST treat it as high-risk scope expansion
- AND it MUST be explicitly approved before implementation proceeds.
