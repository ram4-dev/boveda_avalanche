# Bóveda — Estados, eventos y payloads compartidos

Este documento complementa `docs/demo/openapi.yaml`. OpenAPI es la fuente de verdad para schemas API; este archivo explica semántica, transiciones y eventos para backend, frontend y contratos.

## Estados (`LoanStatus`)

| Estado       | Significado                                                                        | Quién lo cambia                   |
| ------------ | ---------------------------------------------------------------------------------- | --------------------------------- |
| `Requested`  | Solicitud creada con términos propuestos, todavía sin aprobación final.            | Backend/originator                |
| `Approved`   | Originator/funding partner aprobó términos; el borrower puede depositar colateral. | Backend/originator                |
| `Active`     | Colateral depositado, préstamo activado y receipt emitido/registrado.              | Contract/backend                  |
| `MarginCall` | El LTV superó el umbral de margin call; borrower debe agregar colateral o repagar. | Risk engine/backend/contract demo |
| `Repaid`     | Préstamo pagado; colateral puede liberarse.                                        | Backend/attestor/contract         |
| `Defaulted`  | Incumplimiento confirmado antes de liquidar.                                       | Backend/originator                |
| `Liquidated` | Colateral liquidado o marcado como liquidado; proceeds en USDC distribuidos.       | Contract/backend                  |
| `Cancelled`  | Solicitud cancelada antes de activación.                                           | Backend/originator/borrower       |

## Transiciones permitidas

```text
Requested -> Approved
Requested -> Cancelled
Approved  -> Active
Approved  -> Cancelled
Active    -> MarginCall
Active    -> Repaid
Active    -> Defaulted
MarginCall -> Active
MarginCall -> Defaulted
MarginCall -> Liquidated
Defaulted -> Liquidated
```

Reglas:

- `Repaid`, `Liquidated` y `Cancelled` son terminales para la demo.
- `MarginCall -> Active` requiere pago parcial, colateral adicional o mejora de LTV.
- `Defaulted` es opcional: la demo puede ir de `MarginCall` a `Liquidated` para ahorrar pasos.
- Toda liquidación usa `proceedsCurrency = USDC`.

## Eventos canónicos

### `LoanCreated`

Se emite cuando existe una solicitud aceptada por el sistema.

```json
{
  "eventType": "LoanCreated",
  "loanId": "loan-web3-001",
  "borrowerWallet": "0x...",
  "originatorId": "originator-ark-capital-demo",
  "scenario": "WEB3_BRIDGE",
  "principalAmount": "150000",
  "principalCurrency": "USD",
  "collateralToken": "AVAX",
  "initialLtvBps": 5000,
  "status": "Requested"
}
```

### `LoanApproved`

Evento aplicativo para UI/backend. Puede no existir on-chain si la aprobación es off-chain.

```json
{
  "eventType": "LoanApproved",
  "loanId": "loan-web3-001",
  "approvedBy": "originator-ark-capital-demo",
  "fiatDisbursementRef": "wire-demo-2026-001",
  "status": "Approved"
}
```

### `CollateralDeposited`

```json
{
  "eventType": "CollateralDeposited",
  "loanId": "loan-web3-001",
  "vaultAddress": "0xVaultDemo...",
  "token": "AVAX",
  "amount": "2750",
  "txHash": "0x...",
  "status": "Approved"
}
```

### `LoanActivated`

```json
{
  "eventType": "LoanActivated",
  "loanId": "loan-web3-001",
  "vaultAddress": "0xVaultDemo...",
  "receiptTokenId": "1",
  "status": "Active"
}
```

### `ReceiptIssued`

Opcional si el receipt se maneja como evento separado.

```json
{
  "eventType": "ReceiptIssued",
  "loanId": "loan-web3-001",
  "receiptTokenId": "1",
  "owner": "0xBorrower...",
  "soulbound": true
}
```

### `InstallmentPaid`

```json
{
  "eventType": "InstallmentPaid",
  "loanId": "loan-web3-001",
  "installmentId": "inst-001",
  "amount": "12500",
  "currency": "USD",
  "paymentRail": "WIRE_SIMULATED",
  "attestationHash": "0xPaymentHash...",
  "remainingPrincipal": "137500",
  "status": "Active"
}
```

### `MarginCall`

```json
{
  "eventType": "MarginCall",
  "loanId": "loan-web3-001",
  "currentLtvBps": 7600,
  "marginCallLtvBps": 7000,
  "liquidationLtvBps": 8000,
  "requiredTopUpAmount": "32000",
  "requiredTopUpCurrency": "USDC",
  "status": "MarginCall"
}
```

### `Defaulted`

```json
{
  "eventType": "Defaulted",
  "loanId": "loan-web3-001",
  "reason": "MISSED_PAYMENT_AND_LTV_BREACH",
  "status": "Defaulted"
}
```

### `Liquidated`

```json
{
  "eventType": "Liquidated",
  "loanId": "loan-web3-001",
  "liquidationTxHash": "0x...",
  "proceedsAmount": "154200",
  "proceedsCurrency": "USDC",
  "distribution": {
    "fundingPartnerAmount": "150000",
    "originatorFeeAmount": "2100",
    "borrowerRemainderAmount": "2100"
  },
  "status": "Liquidated"
}
```

## Mapping sugerido a contratos

| API/OpenAPI           | Solidity sugerido                                                                                                                                                         |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `LoanStatus`          | `enum LoanStatus` con mismo orden/nombres si es práctico.                                                                                                                 |
| `LoanCreated`         | `event LoanCreated(bytes32 indexed loanId, address indexed borrower, address indexed originator, address collateralToken, uint256 principalAmount, uint16 initialLtvBps)` |
| `CollateralDeposited` | `event CollateralDeposited(bytes32 indexed loanId, address token, uint256 amount, address vault)`                                                                         |
| `LoanActivated`       | `event LoanActivated(bytes32 indexed loanId, uint256 receiptTokenId)`                                                                                                     |
| `InstallmentPaid`     | `event InstallmentPaid(bytes32 indexed loanId, bytes32 installmentId, bytes32 attestationHash, uint256 amount)`                                                           |
| `MarginCall`          | `event MarginCall(bytes32 indexed loanId, uint16 currentLtvBps, uint16 liquidationLtvBps)`                                                                                |
| `Liquidated`          | `event Liquidated(bytes32 indexed loanId, uint256 proceedsAmount, address proceedsToken)`                                                                                 |

Para hackathon, `loanId` puede ser string en API y `bytes32` on-chain usando `keccak256(bytes(loanId))`.
