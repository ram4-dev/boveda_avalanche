# Bóveda — Batch 0 Demo Flow

Este documento fija el flujo canónico de la demo para que frontend, backend y contratos trabajen con los mismos nombres, estados, eventos y datos.

## Decisión de Batch 0

- **Historia principal:** startup web3 que recibe un préstamo fiat de corto plazo usando cripto como colateral.
- **Historia secundaria:** PyME/exportador con tesorería en USDC que recibe capital de trabajo fiat vía originador.
- **Fuente de verdad técnica:** `docs/demo/openapi.yaml`.
- **Liquidación:** si hay liquidación, los proceeds se expresan y distribuyen en **USDC**, no en MXN.
- **Off-chain explícito:** KYC, contrato legal, transferencia fiat, SPEI/wire y buró se simulan por atestaciones y estados.

## Roles

| Rol              | Descripción en la demo                                            |
| ---------------- | ----------------------------------------------------------------- |
| `borrower`       | Empresa que solicita crédito y deposita colateral cripto.         |
| `originator`     | Entidad que origina/administra el préstamo fiat.                  |
| `fundingPartner` | Fondo, banco, SOFOM o vehículo que fondea el préstamo.            |
| `riskProvider`   | Wavy Node mock/adaptador para AML, score y señales on-chain.      |
| `attestor`       | Servicio backend que firma/hashéa pagos fiat o eventos off-chain. |
| `vault`          | Smart contract/cuenta on-chain que bloquea colateral.             |

## Flujo principal — Web3 startup bridge loan

**Caso:** una startup web3 necesita runway fiat de corto plazo sin vender su tesorería cripto. Un fondo/originador aprueba un préstamo fiat y Bóveda bloquea colateral on-chain. Si hay default, el colateral se liquida y los proceeds quedan en USDC.

1. **Quote**
   - Frontend llama `POST /quotes` con escenario `WEB3_BRIDGE`.
   - Backend devuelve monto sugerido, LTV inicial, umbrales y colateral requerido.

2. **Wallet risk check**
   - Frontend/backend llama `POST /risk/wallet`.
   - Wavy Node mock devuelve `riskScore`, `amlStatus`, `maxLtvBps`, `expiresAt` y un `assessmentHash`.

3. **Loan request**
   - Backend llama `POST /loans` con borrower, originator, terms, collateral y `riskAssessmentId`.
   - Estado inicial: `Requested`.
   - Evento aplicativo/on-chain esperado: `LoanCreated`.

4. **Approval**
   - Originator/funding partner aprueba términos.
   - Estado: `Approved`.
   - La transferencia fiat queda fuera de Bóveda y se representa como `fiatDisbursementRef`.

5. **Collateral deposit**
   - Borrower deposita 15 USDC de colateral en Avalanche Fuji/local para la demo real USDC.
   - Backend registra tx por `POST /loans/{loanId}/collateral/deposit`.
   - En Fuji, el backend debe verificar evidencia del adaptador/contrato; en `/demo`, la evidencia queda rotulada como `demo-simulated`.
   - Estado sigue `Approved` hasta activar.
   - Evento: `CollateralDeposited`.

6. **Activation + receipt**
   - Backend/contrato activa préstamo con `POST /loans/{loanId}/activate`.
   - Estado: `Active`.
   - Se emite `LoanReceiptNFT` soulbound o se registra `receiptTokenId`.
   - Evento: `LoanActivated` y opcionalmente `ReceiptIssued`.

7. **Payment attestation**
   - Borrower simula pago fiat off-chain.
   - Backend genera hash/atestación con `POST /loans/{loanId}/payments/attest`.
   - Contrato/backend registra `InstallmentPaid`.
   - Si el pago final deja saldo cero, `releaseEvidence` se reporta separado; sólo hay evento `CollateralReleased` cuando el adaptador confirma release.
   - Estado puede permanecer `Active` o pasar a `Repaid` si queda saldo cero.

8. **Risk movement / margin call**
   - Demo ajusta precio/valor de colateral o score.
   - Si LTV supera `marginCallLtvBps`, estado: `MarginCall`.
   - Evento: `MarginCall`.

9. **Liquidation in USDC**
   - Si LTV supera `liquidationLtvBps` o hay default, se llama `POST /loans/{loanId}/liquidate`.
   - Estado final: `Liquidated`.
   - Los proceeds se reportan en `USDC` aunque el préstamo haya sido fiat.
   - Para la demo real USDC, la distribución canónica es 10 USDC a `fundingPartner`, 0.5 USDC a `originatorFees` y 4.5 USDC a `borrowerRemainder` desde 15 USDC de colateral bloqueado.
   - Evento: `Liquidated` con distribución a `fundingPartner`, `originatorFees` y `borrowerRemainder`.

## Flujo secundario — PyME/exportador

**Caso:** una PyME/exportador con tesorería en USDC obtiene capital de trabajo fiat vía originador. La historia se muestra para explicar expansión institucional, no como camino principal de demo.

Diferencias contra el flujo principal:

- `scenario`: `SME_FIAT_WORKING_CAPITAL`.
- `originatorType`: `SOFOM` o `BANK_PARTNER`.
- `fiatRail`: `SPEI_SIMULATED`.
- `borrowerProfile`: PyME/exportador.
- Liquidación sigue expresada en USDC para mantener consistencia técnica y evitar demo de liquidación MXN.

## Estados compartidos

`Requested → Approved → Active → MarginCall → Defaulted → Liquidated`

Ramas alternativas:

- `Requested → Cancelled`
- `Approved → Cancelled`
- `Active → Repaid`
- `MarginCall → Active` si el borrower agrega colateral o baja el LTV.

La definición normativa está en `docs/demo/states-events.md`.

## No-goals del MVP

- KYC real.
- Transferencias fiat reales.
- Liquidación DEX production-grade.
- Oracle multi-source production-grade.
- Roles/permisos granulares.
- Reportería contable o buró real.
- Custodia discrecional fuera del vault programable.

## Checklist de aceptación Batch 0

- [ ] Frontend puede construir pantallas desde `openapi.yaml` y `loans.seed.json`.
- [ ] Backend puede mockear endpoints con los mismos nombres y enum values.
- [ ] Contracts puede mapear estados/eventos sin reinterpretar payloads.
- [ ] La demo principal es web3-first.
- [ ] Todo evento de liquidación muestra proceeds en USDC.
- [ ] La historia secundaria institucional existe sin bloquear el camino principal.
