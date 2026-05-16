# Borrower Widget Delta Spec: Demo Control Panel Customization

## ADDED Requirements

### Requirement: Presenter can edit collateral price and derived LTV

The Borrower Widget SHALL provide demo controls for changing the collateral reference price and SHALL recompute derived collateral value and current LTV in the UI.

#### Scenario: Collateral price decrease triggers margin warning

- Given the canonical demo loan has AVAX collateral and an active principal balance
- When the presenter lowers the collateral reference price enough to cross the margin-call threshold
- Then the UI shows the updated collateral value
- And the UI shows the updated current LTV
- And the UI shows a margin-call warning as demo-simulated state

#### Scenario: Collateral price reset restores canonical values

- Given the presenter has changed collateral price
- When the presenter resets the demo
- Then collateral price, collateral value, and current LTV return to the canonical API-loaded loan values

### Requirement: Presenter can override risk score and AML status

The Borrower Widget SHALL provide demo controls for changing risk score and AML/risk status while clearly labeling the output as demo simulation.

#### Scenario: Risk score pass state

- Given the demo panel is visible
- When the presenter sets risk score to a passing score and AML status PASS
- Then the risk summary shows Risk passed
- And the max LTV guidance remains visible

#### Scenario: Risk review state

- Given the demo panel is visible
- When the presenter sets AML status REVIEW
- Then the risk summary shows a review warning
- And the borrower flow remains visibly not blocked by wallet secrets or private-key requirements

#### Scenario: Risk blocked state

- Given the demo panel is visible
- When the presenter sets AML status BLOCK
- Then the risk summary shows a blocked state
- And the UI makes clear this is a demo risk override

### Requirement: Presenter can process one payment

The Borrower Widget SHALL provide a control to process exactly one demo payment and show payment evidence.

#### Scenario: One payment records evidence

- Given the loan is Active or MarginCall
- When the presenter selects Process one payment
- Then the UI shows a new payment attestation or local demo payment evidence
- And the outstanding principal decreases by one scheduled payment amount
- And the event timeline or payment summary reflects the payment action

### Requirement: Presenter can complete all payments and release collateral

The Borrower Widget SHALL provide a control to complete all remaining demo payments and move the loan to a repaid/collateral-release state.

#### Scenario: Complete all payments shows repaid state

- Given the loan has an outstanding principal balance
- When the presenter selects Complete all payments
- Then outstanding principal becomes 0 USD
- And the loan status is shown as Repaid
- And collateral is shown as releasable or released
- And borrower mutation controls that no longer apply are disabled

#### Scenario: Collateral release is explicit simulation

- Given all payments are completed
- When the UI shows collateral release
- Then it labels the release as API/local demo simulation until contracts are wired
- And it does not imply real on-chain release settlement

### Requirement: Presenter can miss or expire payments to drive default

The Borrower Widget SHALL provide controls to mark the next payment overdue or auto-expire payments for default demonstration.

#### Scenario: Miss next payment shows overdue state

- Given the loan is Active
- When the presenter selects Miss next payment
- Then next payment due date is shown as overdue
- And the UI shows borrower action required

#### Scenario: Auto-expire payments drives default state

- Given the loan is Active or MarginCall
- When the presenter selects Auto-expire payments
- Then the loan status is shown as Defaulted in demo state
- And liquidation becomes available
- And the UI labels the state transition as demo-simulated

### Requirement: Presenter can trigger liquidation after margin breach or default

The Borrower Widget SHALL provide a liquidation scenario control that is available after margin breach or default.

#### Scenario: Liquidation shows proceeds distribution

- Given the demo loan is in MarginCall or Defaulted state
- When the presenter triggers liquidation
- Then the UI shows Liquidated terminal state
- And proceeds are shown in USDC
- And funding partner, originator fee, and borrower remainder amounts are visible

#### Scenario: Liquidation is disabled before eligible state

- Given the demo loan is healthy Active and below margin-call LTV
- When the presenter views liquidation controls
- Then liquidation is disabled or explained as unavailable until margin/default state

### Requirement: Presenter can auto-run liquidation sequence

The Borrower Widget SHALL provide an automatic demo sequence that shows risk movement/default leading to liquidation without requiring every intermediate action to be clicked manually.

#### Scenario: Auto-run liquidation from collateral crash

- Given the demo loan is Active
- When the presenter starts the automatic liquidation demo
- Then the UI first shows collateral price drop and LTV breach
- And then shows MarginCall or Defaulted state
- And then shows Liquidated terminal state
- And each step is labeled as local demo automation unless real contract integration is active

#### Scenario: Auto-run sequence can be reset

- Given an automatic liquidation demo has completed
- When the presenter selects Reset demo
- Then all automatic sequence state is cleared
- And the canonical API-loaded loan state is restored

### Requirement: Demo liquidation shows recipient wallet

The Borrower Widget SHALL show the destination wallet used for demo liquidation proceeds.

#### Scenario: Presenter sets recipient wallet

- Given the demo controls are visible
- When the presenter enters a proceeds recipient wallet address
- Then liquidation output shows the recipient wallet
- And the UI labels the transfer as local demo routing unless Batch 5 contract integration is active

#### Scenario: Connected wallet can be used as recipient

- Given an injected wallet is connected
- When the presenter chooses to use connected wallet for proceeds
- Then the demo recipient wallet matches the connected address
- And no private keys or seed phrases are requested

### Requirement: Presenter can apply video demo presets

The Borrower Widget SHALL provide scenario presets for common video demo flows.

#### Scenario: Healthy borrower preset

- Given the presenter selects Healthy borrower
- Then collateral price, LTV, risk score, and payment state show a safe active loan

#### Scenario: Collateral crash preset

- Given the presenter selects Collateral crash
- Then collateral price drops
- And LTV crosses the margin-call or liquidation threshold
- And the risk area explains the breach

#### Scenario: Full repayment preset

- Given the presenter selects Full repayment
- Then payments are complete
- And collateral release is shown

#### Scenario: Default and liquidation preset

- Given the presenter selects Default and liquidation
- Then the loan is shown as defaulted or liquidated
- And proceeds/distribution are visible

### Requirement: Demo controls are visibly separated from borrower-facing controls

The Borrower Widget SHALL visually separate presenter demo controls from borrower actions.

#### Scenario: Demo panel labeling

- Given the app loads with a selected loan
- When the presenter views the left panel
- Then the panel contains a Demo controls label
- And simulation-only controls are labeled as local demo overrides

### Requirement: Reset restores canonical API state

The Borrower Widget SHALL provide a reset action that clears local demo overrides and reloads canonical Batch 2 API state.

#### Scenario: Reset after multiple overrides

- Given collateral price, risk score, payment state, and status have been overridden
- When the presenter selects Reset demo
- Then local overrides are cleared
- And canonical loan, event, quote, risk, payment, and liquidation display state is restored

### Requirement: Tests cover demo panel behavior

The implementation SHALL add unit and UI tests for demo override state and visible feedback.

#### Scenario: Reducer tests cover state transitions

- Given demo override reducer tests
- When price, risk, payment, default, liquidation, release, and reset actions are applied
- Then derived state matches expected LTV/status/payment outputs

#### Scenario: UI tests cover presenter controls

- Given demo panel UI tests
- When a user changes collateral price, risk status, and payment mode
- Then visible text and controls reflect the selected demo scenario

## MODIFIED Requirements

### Requirement: Existing borrower journey remains canonical by default

The existing Borrower Widget SHALL continue to load canonical Batch 2 API data by default before local demo overrides are applied.

#### Scenario: Initial load remains unchanged

- Given the app loads without presenter overrides
- When borrower data is fetched
- Then existing offer, wallet, loan activity, event timeline, and API-simulated action behavior remain visible
- And existing regression tests continue to pass
