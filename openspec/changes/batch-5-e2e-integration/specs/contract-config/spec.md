# Contract Config Specification

## Purpose

Define the accepted Batch 5 behavior for safe Fuji contract address and ABI configuration evidence across backend, frontend, tests, and demo documentation.

## Requirements

### Requirement: Broadcast-Authoritative Fuji Addresses

The system MUST use the Fuji broadcast artifact as the authoritative source for Batch 5 public contract address labels. The accepted contract mapping is:

- `LoanRegistry`: `0xb6832e4c43e97d5ad11e99abcb23d9a734a4be14`
- `CollateralVault`: `0xe550a10f585e5595ae187f08a701bdef890de057`
- `LoanReceiptNFT`: `0xf88b6e8c107a0a5da6f398734783541cbe12a38c`
- `PaymentAttestation`: `0xa222a02e828d5480be971b80d4157f2abe1fabda`
- `LiquidationEngine`: `0x212f6565319caa343c8c39e9b11a447febf2055a`

#### Scenario: Corrected address labels are resolved

- GIVEN Batch 5 runtime configuration, UI evidence, tests, or docs display Fuji contract addresses
- WHEN a contract is identified by name
- THEN the displayed public address MUST match the broadcast-authoritative mapping above
- AND stale labels from README prose or user notes MUST NOT override the broadcast artifact mapping.

#### Scenario: Address evidence is safe to review

- GIVEN a reviewer inspects Batch 5 address evidence
- WHEN the system reports configured contract names and addresses
- THEN it MUST report only public contract names, public addresses, artifact names, network identifiers, and non-secret source references
- AND it MUST NOT expose RPC credentials, private keys, wallet secrets, tokens, or `.env` values.

### Requirement: ABI References Come From Committed Artifacts

The system MUST resolve ABI references for Batch 5 contracts from committed Foundry output artifacts or other committed non-secret ABI references. The system MUST make missing or mismatched ABI references observable as configuration or validation failures rather than silently using unrelated contract interfaces.

#### Scenario: ABI reference exists for each configured contract

- GIVEN Batch 5 configuration references Fuji contracts
- WHEN validation checks contract names, addresses, and ABI references
- THEN each configured contract MUST have a corresponding committed ABI reference for its expected interface
- AND tests SHOULD be able to assert the contract-to-ABI association without live chain access.

#### Scenario: ABI mismatch is not hidden

- GIVEN a configured contract address is paired with a missing or incompatible ABI reference
- WHEN runtime validation or a contract-backed operation needs the ABI
- THEN the system MUST expose a safe configuration error or unavailable state
- AND it MUST NOT continue by pretending unrelated ABI evidence is valid.

### Requirement: Secret-Free Runtime Configuration

The system MUST commit only safe examples, placeholders, public addresses, ABI references, and documentation for runtime configuration. The system MUST NOT read, print, commit, derive, or require repository access to `.env` values, private keys, credentials, tokens, seed phrases, wallet secrets, or secret-manager outputs.

#### Scenario: Repository config contains only safe material

- GIVEN a reviewer searches Batch 5 committed config, examples, docs, and tests
- WHEN they inspect Fuji integration settings
- THEN public addresses, ABI references, network names, and placeholders MAY be present
- AND secret-bearing values MUST NOT be present.

#### Scenario: Tests validate config without secret reads

- GIVEN strict TDD tests exercise config behavior
- WHEN they validate address loading, ABI references, and missing-prerequisite errors
- THEN they MUST use fixtures, public artifacts, placeholders, or fake adapters
- AND they MUST NOT read secret files or print secret material.

### Requirement: Contract Evidence Is Visible Across Backend And Frontend

The system MUST make the active Fuji contract configuration verifiable from safe backend/frontend evidence where contract-backed behavior is presented. At minimum, evidence MUST identify relevant contract names and public addresses for origination, payment attestation, receipt, and liquidation contexts when those contexts depend on Fuji contracts.

#### Scenario: Origination evidence identifies relevant contracts

- GIVEN a loan origination flow reaches collateral deposit, activation, or receipt evidence
- WHEN contract evidence is displayed or recorded
- THEN it MUST identify the relevant public contract names and addresses such as `LoanRegistry`, `CollateralVault`, and `LoanReceiptNFT` when available.

#### Scenario: Payment and liquidation evidence identify relevant contracts

- GIVEN payment attestation or liquidation evidence is displayed or recorded
- WHEN contract evidence is available
- THEN payment evidence MUST identify `PaymentAttestation` context
- AND liquidation evidence MUST identify `LiquidationEngine` context
- AND both MUST use the accepted public address mapping.
