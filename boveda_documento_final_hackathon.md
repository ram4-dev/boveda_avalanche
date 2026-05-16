# Bóveda — Infraestructura institucional para crédito fiat respaldado por colateral cripto

> Documento canónico de tesis y arquitectura para el hackathon LatAm Institucional de Avalanche (16-17 mayo 2026).

---

## One-liner

**Bóveda es la infraestructura que permite a instituciones financieras y originadores de crédito ofrecer préstamos fiat respaldados por colateral cripto, sin tener que custodiar cripto, construir smart contracts, operar liquidaciones ni desarrollar scoring on-chain propio.**

Para el originador: producto nuevo, colateral programable, audit trail completo, mejores garantías para su fondeador.

Para el usuario: acceso a crédito fiat regulado sin vender sus criptoactivos, y construcción de historial crediticio sin renunciar a su tesoro digital.

Bóveda no reemplaza al banco ni al originador. Bóveda provee la capa de colateral, verificación, auditabilidad y liquidación.

---

## Tesis

En LatAm convergen dos realidades:

**Por el lado del usuario:** existe una clase creciente de personas, PyMEs, freelancers, exportadores y startups web3 con patrimonio verificable on-chain (BTC, USDC, USDT, AVAX), pero invisibles para el sistema crediticio tradicional. Necesitan liquidez en moneda local, no quieren vender su cripto (impuestos + pérdida de upside), y las alternativas existentes los obligan a elegir entre DeFi (output en stablecoins, no fiat local, sin contraparte regulada) o CeFi cripto custodial (riesgo de contraparte post-Celsius/BlockFi).

**Por el lado del originador:** instituciones financieras, SOFOMs, fintechs de lending, fondos de inversión y vehículos crediticios podrían querer ofrecer préstamos respaldados por cripto, pero enfrentan cuatro barreras técnicas:

1. No quieren custodiar cripto.
2. No tienen infraestructura de smart contracts.
3. No saben verificar riesgo on-chain ni AML de wallets.
4. No tienen mecanismos confiables para monitorear LTV y liquidar colateral automáticamente.

**Bóveda resuelve esa brecha:** provee una capa plug-and-play para que cualquier originador de crédito pueda aceptar cripto como garantía programable sin convertirse en experto cripto. El cripto vive en Avalanche como colateral programable; el fiat se mueve por los rieles habituales del originador.

---

## Positioning vs Go-to-Market: la distinción clave

Es importante separar dos decisiones que suelen confundirse.

### Positioning — para quién está diseñada la infraestructura

Bóveda es **infraestructura institucional**. La arquitectura — separación de roles, audit trail, atestaciones firmadas, compliance design, controles de riesgo — está diseñada desde el día uno para que un banco regulado, una SOFOM o una fintech licenciada la pueda adoptar.

### Go-to-Market — quién es el primer cliente comercial

El primer cliente que paga es cripto-nativo, porque tienen ciclos de venta más cortos y dolor inmediato:

- Fintechs cripto-friendly con base de usuarios existente.
- Fondos VC web3 que dan bridge loans a startups con tesoro cripto.
- Exchanges y wallets reguladas con usuarios cripto-nativos.

Esta es la estrategia clásica de B2B fintech de éxito (Plaid, Stripe, Marqeta): vender a digital-natives primero, expandir a instituciones tradicionales después. El positioning institucional siempre estuvo presente, pero el wedge inicial es cripto-nativo por pragmatismo de adopción.

### Por qué importa esta distinción

Sin esta separación, el pitch se rompe por los dos lados: el institucional se debilita ("¿no son ustedes solo DeFi con extra pasos?") y la GTM tradicional se vuelve imposible (ciclos de venta de 12-18 meses con SOFOMs). Con esta separación:

- El jurado institucional ve infraestructura seria diseñada para ellos.
- El equipo puede vender mañana a un fondo VC web3 sin esperar regulación.
- Los partners del hackathon (Bankaool, Arkangeles) tienen un rol concreto y futuro.

---

## Qué es y qué NO es Bóveda

### Qué es Bóveda

- Una plataforma B2B de infraestructura financiera para crédito cripto-colateralizado.
- Una capa de smart contracts en Avalanche que custodia colateral programable.
- Un motor de riesgo que integra Wavy Node y otras señales on-chain.
- Un servicio de atestaciones que conecta pagos fiat off-chain con estado on-chain.
- Un dashboard institucional para originadores y fondeadores.

### Qué NO es Bóveda

- No es billetera cripto-fiat para consumidores.
- No es la entidad que presta directamente al usuario final.
- No toma líneas de crédito bancarias para originar cartera propia.
- No es banco, SOFOM, exchange ni custodio discrecional.
- No es una plataforma offshore de préstamos cripto.

Bóveda es **una capa de infraestructura** sobre la que otros construyen productos crediticios.

---

## Diferenciación competitiva

Bóveda ocupa un espacio vacío entre tres categorías existentes. La diferenciación contra cada una vale oro en el pitch.

### Contra DeFi lending (Aave, Compound, MakerDAO)

DeFi entrega más cripto a cambio de cripto. El usuario sale con stablecoins que después tiene que rampear a fiat por su cuenta. No hay contraparte regulada, no hay relación legal, no hay historial crediticio reportable, no hay servicio al cliente.

**Bóveda entrega fiat local a través de un originador regulado.** El usuario sale con plata útil en su cuenta bancaria, tiene contraparte rastreable y construye historial crediticio reportable a buró.

### Contra CeFi cripto-lending (Nexo, Ledn, ex-Celsius, ex-BlockFi)

CeFi opera como custodio discrecional: el colateral entra al balance sheet de la compañía, que después lo presta, lo invierte o lo usa como considera. Esto fue exactamente la causa de las quiebras de 2022-2023.

**Bóveda no es custodio discrecional.** El colateral vive en un vault programable on-chain. Ni el originador ni Bóveda pueden moverlo arbitrariamente. Las reglas de liquidación están en código, son auditables, y cualquiera puede verificar el estado del vault en cualquier momento. Es post-Celsius por diseño.

### Contra bancos tradicionales

Los bancos piden historial crediticio. Para el usuario cripto-nativo ese historial no existe — y la única forma de construirlo es vender cripto, pagar impuestos, depositar en banco y empezar de cero. La cripto deja de ser garantía y se convierte en evento fiscal.

**Bóveda rompe ese trade-off.** El colateral cripto *es* el historial inicial. El préstamo otorgado y pagado por un originador regulado *construye* historial crediticio reportable a buró sin que el usuario tenga que vender un solo satoshi. Cuando el préstamo se cancela, el colateral vuelve completo. El usuario salió con historial y conservó su upside.

### One-liner competitivo

> *Bóveda permite que cualquier persona o empresa con cripto acceda a crédito fiat regulado sin vender sus activos, y que cualquier originador financiero ofrezca ese producto sin construir infraestructura cripto.*

Doble lado, doble valor, sin jerga.

---

## Cliente objetivo

### Primer cliente comercial (GTM 0-12 meses)

**Perfil A — Fondos VC web3 y aceleradoras cripto.**
Hoy dan bridge loans a startups web3 con tesoro en stablecoins o ETH, basados en term sheets y confianza. Con Bóveda, el mismo bridge loan se vuelve sobrecolateralizado, auditable, con liquidación automática. Tickets de USD 100k-5M, ciclos de venta cortos, dolor concreto.

**Perfil B — Fintechs cripto-friendly con base de usuarios.**
Empresas que ya atienden comunidades cripto y necesitan diferenciación de producto. Bóveda les permite lanzar un producto de crédito sin construir capa cripto interna.

**Perfil C — Exchanges y wallets reguladas con base de usuarios cripto-nativos.**
Tienen usuarios con cripto pero no quieren operar lending directamente. Bóveda es la capa que les permite ofrecer crédito sin tomar riesgo crediticio en su balance.

### Cliente expansión (GTM 12-36 meses)

**Perfil D — SOFOMs mexicanas, fintechs de lending tradicionales, vehículos financieros respaldados por bancos.**
Acá entran Bankaool y sus clientes corporativos. Ciclo de venta más largo, requiere trabajo regulatorio, pero TAM enorme.

**Perfil E — Bancos tradicionales con banca corporativa.**
Para clientes corporativos del banco que tienen tesoro en cripto (exportadores que cobran en USDC, empresas con tesorería diversificada). Bóveda permite al banco ofrecer crédito a estos clientes sin tomar cripto en su balance.

---

## Encaje con partners del hackathon

### Bankaool

Bankaool es **channel partner y futuro cliente**, no cliente del MVP.

*Como channel partner:* Bankaool tiene relaciones con SOFOMs y fintechs que ya son sus clientes corporativos. Bóveda les permite a esos clientes lanzar productos crediticios diferenciados, y Bankaool sigue siendo el fondeador habitual. **Bóveda expande el negocio actual de Bankaool sin que tenga que tocar cripto.**

*Como cliente futuro directo:* cuando un cliente corporativo de Bankaool (una PyME exportadora, una empresa con tesorería cripto) necesita capital de trabajo, hoy Bankaool no puede ofrecer crédito contra su tesoro en USDC. Con Bóveda, sí. Es un producto nuevo de banca corporativa.

### Arkangeles

Arkangeles puede usar Bóveda para **capturar una pool de inversores que hoy no puede tocar**: cripto-nativos que quieren diversificar a real estate pero no quieren vender cripto. Con Bóveda como puente, esos inversores ponen cripto como colateral, sacan fiat, e invierten en Arkangeles. Arkangeles no toca cripto, captura más capital.

*Encaje exacto dependiente de la charla de kickoff: los pain points reales de Arkangeles se presentan al inicio del hackathon, y la narrativa puede ajustarse ahí.*

### Wavy Node

Wavy Node es el proveedor de scoring de riesgo y AML on-chain de la integración core de Bóveda. La atestación de Wavy Node es input central del motor de riesgo. Esta integración es **protagónica, no decorativa** — califica a Bóveda para el premio Wavy Node ($200 USD por equipo top 3 + compromiso de continuar post-hackathon).

### Oracle

Stack de infraestructura cloud (créditos de $500 USD a todos los entregables finales). Backend de Bóveda corre en Oracle Cloud.

### Ledger Leaders Week

Mentoría legal y de compliance para los ganadores. Bóveda tiene preguntas regulatorias específicas que estos mentores pueden ayudar a resolver post-hackathon: estructura legal del originador en México, tratamiento contable de la atestación, marco regulatorio para vehículos web3, etc.

---

## Modelo operativo

```text
Banco / Fondeador (Bankaool, fondos VC)
  ↓ línea de crédito o capital
Originador financiero (SOFOM, fintech, fondo VC, vehículo crediticio)
  ↓ préstamo fiat o USDC
Usuario final (persona, PyME, startup web3)
  ↓ deposita colateral cripto
Bóveda Vault Infrastructure en Avalanche
```

### Rol del banco / fondeador

- Provee capital al originador.
- No interactúa directamente con cripto.
- No opera wallets.
- No liquida activos digitales.
- Evalúa al originador según sus propios criterios crediticios.

### Rol del originador financiero

- Diseña el producto crediticio (montos, plazos, tasas).
- Realiza KYC/KYB de usuarios.
- Aprueba o rechaza préstamos.
- Desembolsa fiat (o USDC, según preferencia del cliente).
- Cobra cuotas.
- Mantiene relación legal con el cliente.
- Usa Bóveda como capa de administración de garantía cripto.

### Rol de Bóveda

- Provee infraestructura de colateral programable.
- Verifica activos on-chain.
- Evalúa riesgo de wallet vía Wavy Node y otras señales.
- Crea vaults personalizados por préstamo.
- Emite Loan Receipt NFT no transferible.
- Registra eventos críticos y atestaciones on-chain.
- Monitorea precio y LTV en tiempo real.
- Ejecuta liquidación programática según reglas predefinidas.
- Devuelve excedentes al borrower.
- Provee dashboard y API al originador.

### Rol del usuario final

- Solicita préstamo al originador.
- Completa KYC con el originador.
- Conecta wallet y deposita colateral.
- Recibe fiat (o USDC) del originador.
- Paga cuotas al originador.
- Recupera colateral si cumple, o recibe excedente si hay liquidación.

---

## Liquidación: flujo de USDC al originador

Decisión arquitectónica clave: cuando una liquidación se ejecuta, el colateral se convierte a USDC dentro de Avalanche y se transfiere a la wallet del originador.

### Por qué USDC y no fiat

- Bóveda nunca toca rieles fiat. Eso simplifica masivamente el compliance.
- El originador decide cuándo convertir USDC → MXN (u otra moneda local) según su flujo de tesorería.
- Para originadores cripto-nativos (fondos VC, fintechs cripto), USDC es la moneda de operación habitual y no requiere conversión.
- Avalanche tiene finality sub-segundo y costos bajos, lo que hace que la liquidación sea económicamente viable incluso en préstamos chicos.

### Por qué al originador y no al banco

- El banco financió al originador, no al usuario. Los proceeds van al originador como contraparte directa del préstamo retail.
- Si el originador tiene cuenta de cobranza controlada o fideicomiso con el banco, el ingreso de USDC entra a ese vehículo según reglas de waterfall.

### Limitación reconocida

Si el originador es una SOFOM tradicional sin operatoria cripto, recibir USDC en wallet sigue siendo custodia cripto. Esto explica por qué la GTM inicial son originadores cripto-friendly. Para expandir a originadores tradicionales se requerirá una capa de off-ramp automatizada (custodio o exchange regulado que convierta y deposite MXN). Esto es roadmap post-hackathon.

---

## Qué queda on-chain vs off-chain

Bóveda no pone "todo" en blockchain. Blockchain se usa como capa de colateral, ejecución y auditabilidad de eventos críticos.

### On-chain (Avalanche)

- loanId, borrower wallet, vault address
- collateral token, collateral amount
- LTV inicial, margin call threshold, liquidation threshold
- estado del préstamo (Requested, Active, MarginCall, Repaid, Defaulted, Liquidated)
- Loan Receipt NFT
- hashes de términos, schedule, atestaciones
- eventos: aprobación, activación, pago, margin call, liquidación, liberación

### Off-chain (backend Bóveda + originador)

- KYC, CURP/RFC/INE
- Cuenta bancaria/CLABE
- Contrato legal completo
- Comprobantes SPEI/transferencia
- Facturas fiscales
- Datos personales
- Scoring detallado
- Documentos del cliente
- Conciliación contable
- Relación contractual entre originador y fondeador

### Principio operativo

> *Bóveda publica en Avalanche una huella verificable de cada evento crítico del préstamo, manteniendo datos sensibles y pagos fiat fuera de la cadena.*

---

## Loan Receipt NFT: factura hoy, identidad crediticia mañana

El NFT que se emite al activar el préstamo no es solo una factura visual — es la primera pieza de un buró de crédito pseudónimo on-chain.

### Qué contiene

- loanId
- vault address
- hashes de términos, tasa, plazo, schedule
- referencias al originador
- hashes de eventos de pago (atestaciones)

**No contiene datos personales.** El NFT no tiene nombre, CURP, dirección ni monto desnudo — solo hashes verificables que prueban que esos datos existen sin exponerlos.

### Por qué es soulbound (no transferible)

Un préstamo no debería ser vendible sin consentimiento explícito del usuario y del originador. Hacer el NFT no transferible evita mercados secundarios no autorizados, fraude de identidad crediticia y especulación con deuda retail.

### Por qué importa para el futuro

Como el NFT vive en la wallet del usuario y es descubrible por exploradores y agregadores, **construye reputación crediticia pseudónima portable**. Mañana, otro originador puede consultar el historial de NFTs de Bóveda asociados a una wallet y decidir términos preferenciales: *"esta wallet tiene 4 préstamos pagados puntualmente con Bóveda en los últimos 18 meses → ofrecemos tasa preferencial."*

Esto convierte a Bóveda en un **estándar de identidad crediticia on-chain**, no solo en un producto. Es la jugada de plataforma. No hace falta construirlo en la hackathon, pero hay que mencionarlo como roadmap: convierte la pregunta "¿esto es defendible?" en "esto se vuelve infraestructura crítica con cada préstamo nuevo".

---

## Flujo principal de originación

```text
1.  Usuario solicita préstamo en la plataforma del originador.
2.  Originador realiza KYC/KYB.
3.  Originador llama a Bóveda API para evaluar colateral.
4.  Usuario conecta wallet.
5.  Bóveda consulta Wavy Node (risk score + AML).
6.  Bóveda lee balances on-chain.
7.  Bóveda calcula términos sugeridos:
    - colateral aceptado
    - valor del colateral (vía oráculo)
    - LTV máximo según política del originador
    - margin call threshold
    - liquidation threshold
    - monto máximo sugerido en fiat o USDC
8.  Originador revisa, ajusta y aprueba.
9.  Bóveda crea vault personalizado en Avalanche.
10. Usuario deposita colateral en el vault.
11. Bóveda emite LoanReceiptNFT a la wallet del usuario.
12. Originador desembolsa fiat (o USDC) al usuario.
13. Bóveda registra activación on-chain.
14. Préstamo entra en estado Active.
```

---

## Flujo de pago de cuotas

El usuario paga al originador en fiat (o USDC). Bóveda recibe atestaciones del originador o del payment processor.

```text
Usuario
  ↓ paga cuota (SPEI, débito, transferencia USDC)
Originador / payment processor
  ↓ confirma pago
Backend de Bóveda
  ↓ valida y firma atestación
Smart contract en Avalanche
  ↓ registra cuota como pagada
LoanRegistry actualiza estado
```

### Estructura de la atestación

El originador envía:

```json
{
  "loanId": "LOAN-123",
  "installmentId": "3",
  "amount": "5200",
  "currency": "MXN",
  "paidAt": "2026-05-15T15:30:00Z",
  "paymentReference": "SPEI-REF-XXXX",
  "status": "CONFIRMED"
}
```

Bóveda publica solo el hash on-chain:

```text
paymentHash = hash(
  loanId,
  installmentId,
  amount,
  currency,
  paidAt,
  paymentReference
)
```

El smart contract emite el evento:

```text
InstallmentPaid(
  loanId,
  installmentId,
  paymentHash,
  attestor,
  timestamp
)
```

Los datos completos quedan off-chain. La huella verificable queda on-chain.

---

## Flujo de liquidación

### Liquidación por LTV crítico

```text
Oráculo actualiza precio del colateral
  ↓
LTV calculado supera liquidationThreshold
  ↓
Keeper/bot llama liquidate()
  ↓
Vault vende el colateral necesario en DEX de Avalanche
  ↓
Proceeds en USDC se distribuyen según reglas
```

### Liquidación por impago

```text
No hay atestación de pago válida en la fecha esperada
  ↓
Período de gracia vence
  ↓
Préstamo queda defaultable
  ↓
Keeper/bot llama liquidate()
  ↓
Vault vende colateral necesario
```

### Distribución de proceeds

```text
USDC obtenido de la liquidación
  ↓
1. Deuda pendiente + intereses → wallet del originador
2. Fees predefinidos → wallet de Bóveda
3. Reward del keeper (si aplica) → wallet del keeper
4. Excedente → wallet del borrower
```

### Regla clave

> *Bóveda liquida solo lo necesario para cubrir deuda pendiente, fees definidos y costos del keeper. Cualquier excedente vuelve al usuario.*

### Por qué Avalanche es la cadena correcta

- **Finality sub-segundo:** la liquidación ejecuta antes de que el precio siga cayendo.
- **Costos bajos:** una liquidación en Ethereum mainnet puede costar más que el fee permitido en un préstamo chico. En Avalanche es viable incluso en préstamos retail.
- **Liquidez en DEX:** Trader Joe, GMX y otros tienen pools profundos en USDC, BTC.b, WAVAX para los activos elegibles iniciales.
- **EVM compatible:** stack de desarrollo estándar, auditabilidad por herramientas conocidas, integración con wallets existentes.

---

## Arquitectura técnica

### Smart contracts en Avalanche

**LoanRegistry**
- Estado central de cada préstamo.
- Estados: Requested, Approved, Active, MarginCall, Repaid, Defaulted, Liquidated, Cancelled.
- Coordina acciones entre vaults, oráculos, atestadores.

**CollateralVault**
- Custodia el colateral por préstamo.
- Permite depósito, retiro condicional (solo bajo reglas), y liquidación.
- No permite retiro arbitrario por Bóveda ni por el originador.

**LoanReceiptNFT**
- Soulbound (no transferible).
- Contiene loanId, vault address, hashes de términos.
- Sin datos personales.

**PriceOracleAdapter**
- Consume Chainlink / Pyth / RedStone.
- Calcula valor del colateral y LTV en tiempo real.
- Soporta oracle fallback para resiliencia.

**RiskAttestationVerifier**
- Verifica atestaciones firmadas de Wavy Node.
- Valida score, AML status, expiry, wallet, nonce y firma.
- Rechaza atestaciones expiradas o con nonce reutilizado.

**PaymentAttestationVerifier**
- Verifica firmas de payment attestors autorizados.
- Registra cuotas como pagadas.
- Detecta atestaciones duplicadas.

**LiquidationEngine**
- Ejecuta liquidación si se cumplen condiciones.
- Calcula deuda pendiente, fees, keeper reward y excedente.
- Envía proceeds al destinatario correcto.

### Backend de Bóveda

- API REST/GraphQL para originadores.
- Motor de originación y cálculo de términos.
- Listener de eventos on-chain (Avalanche).
- Monitor de LTV en tiempo real.
- Bot de margin call y liquidación.
- Servicio de atestaciones firmadas.
- Conciliador de pagos.
- Dashboard institucional.
- Logging y auditoría.

### Frontend

**Borrower Widget (embebible por el originador)**
- Conexión de wallet.
- Visualización de oferta de préstamo.
- Depósito de colateral.
- Visualización de deuda, cuotas, LTV.
- Adición de colateral (si quiere bajar LTV).
- Historial de eventos.

**Institutional Dashboard**
- Línea de crédito total / capital utilizado.
- Cartera activa (préstamos abiertos).
- LTV promedio y por préstamo.
- Préstamos en margin call.
- Mora.
- Pagos recibidos (atestados).
- Liquidaciones ejecutadas.
- Vaults activos.
- Audit trail on-chain.
- Exposición por activo / por usuario / por sector.

---

## Motor de riesgo

El motor no depende de un único score ni de IA autónoma. Es un policy engine determinístico con inputs múltiples.

### Inputs

- Wallet risk score (Wavy Node).
- AML flags (Wavy Node + listas externas).
- Tipo de activo, liquidez, volatilidad histórica.
- Monto solicitado, plazo.
- LTV inicial propuesto.
- Historial del usuario en Bóveda.
- Datos de capacidad de pago (provistos por el originador).
- Concentración actual de la cartera del originador.

### Política de aprobación (ejemplo)

```text
Auto-aprobar si:
- monto <= límite máximo del originador
- wallet risk score <= umbral permitido
- AML status = limpio
- LTV inicial <= máximo permitido para ese activo
- activo es elegible según la política
- usuario completó KYC
- cartera no excede límites de concentración
```

### Política de LTV por activo (ejemplo conservador)

```text
USDC / USDT: LTV máximo 75-85%
BTC.b:        LTV máximo 40-55%
WAVAX:        LTV máximo 30-45%
Long-tail:    no aceptados
```

Cuanto más volátil el activo, menor LTV inicial.

### Rol de la IA

La IA **no aprueba préstamos**. Asiste en:
- explicar la decisión al originador,
- generar reportes de riesgo,
- resumir señales,
- preparar escalamientos.

El decisor es el policy engine o un risk officer autorizado del originador.

### Fallback de scoring

Sin scoring no hay respuesta — pero "sin respuesta" no debe ser "fallar el préstamo". El fallback es:

1. Cache de scores recientes válidos (por X horas).
2. Segundo proveedor de scoring de backup.
3. Si ambos fallan: degradar a "manual review" por el originador, nunca aprobación ciega.

Esto se documenta como design intent; en la demo puede mockearse.

---

## Garantías que Bóveda ayuda a ofrecer al fondeador

Bóveda no es originador, pero su infraestructura **mejora las garantías que el originador puede ofrecer a su fondeador (banco o fondo)**. Esto importa para que Bankaool o fondos similares puedan ampliar líneas con menos riesgo.

### Lo que Bóveda permite al originador reportar

- **Colateral verificable on-chain por préstamo.**
- **LTV en tiempo real** por préstamo y por cartera.
- **Liquidación programática** según reglas auditables.
- **Audit trail completo** de cada evento crítico.
- **Risk scoring on-chain** demostrable: ninguna wallet con AML crítico fue aprobada.
- **Covenants verificables automáticamente:**
  - LTV máximo y promedio
  - concentración por activo
  - colateral total
  - préstamos en margin call
  - cartera respaldada por colateral válido

### Lo que esto le permite al fondeador

> *"Financio solo la cartera elegible reportada por Bóveda según estas reglas."*

Esto convierte el préstamo mayorista del banco al originador en una operación **borrowing-base** controlada, no en una línea ciega. Reduce dramáticamente el riesgo para el banco.

---

## MVP de hackathon

### Objetivo

Demostrar que un originador financiero puede ofrecer un préstamo respaldado por colateral cripto usando infraestructura Bóveda, en dos casos de uso paralelos que cubren ambas audiencias del jurado.

### Demo dual

**Caso A — Institucional tradicional (Bankaool / SOFOM angle):**

```text
1. Una PyME exportadora cobra en USDC.
2. Necesita capital de trabajo en MXN sin vender USDC.
3. Un originador (SOFOM cliente de Bankaool) usa Bóveda.
4. PyME deposita USDC como colateral.
5. Recibe MXN simulado del originador.
6. Paga cuotas en MXN, atestadas on-chain.
7. Bankaool ve, en el dashboard institucional, la exposición agregada.
```

**Caso B — Cripto-nativo (fondo VC angle):**

```text
1. Un fondo VC web3 le da un bridge loan a una startup.
2. La startup deposita ETH/stablecoins en el vault de Bóveda.
3. Recibe USDC del fondo (no MXN — flujo cripto-nativo).
4. Paga cuotas en USDC, atestadas on-chain.
5. Si default, vault liquida automáticamente.
```

### Misma infraestructura, dos audiencias

La slide del jurado dice: *Bóveda funciona para ambos mundos porque está diseñada para los dos desde el día uno.*

### Lo que entra en el MVP

- LoanRegistry, CollateralVault, LoanReceiptNFT desplegados en Avalanche Fuji.
- PriceOracleAdapter con Chainlink testnet.
- RiskAttestationVerifier integrado con Wavy Node (mock o adapter real).
- PaymentAttestationVerifier con firma de attestor mockeado.
- LiquidationEngine con simulación de caída de precio.
- Institutional Dashboard (4-5 widgets clave).
- Borrower Widget (2-3 pantallas).
- Demo guiada con dos casos de uso.

### Lo que NO entra

- SPEI real, CLABE real, KYC real.
- Conversión fiat real.
- Wallet completa.
- Multi-país, multi-activo amplio.
- Sistema de cobro automático real.

### Recorte realista (priorizar lo que la demo necesita)

Equipo de 3-4 personas en 36 horas:

- 1-2 personas: smart contracts (3 contratos sólidos: Vault, LoanRegistry+Receipt fusionados, Liquidation; el resto se mockea con eventos firmados).
- 1 persona: backend + Institutional Dashboard.
- 1 persona: Borrower Widget + integración Wavy Node + pitch/demo.

**No intentar 7 contratos completos.** Hacer pocos contratos bien y mockear lo demás con eventos firmados off-chain.

---

## Modelo de negocio

Bóveda monetiza por capas SaaS + transaccional:

1. **Setup fee** — onboarding del originador, configuración de política, integración.
2. **Monthly SaaS fee** — acceso a dashboard, API, monitoreo.
3. **Fee por préstamo originado** — porcentaje del monto al activar.
4. **Collateral management fee** — fee mensual por vault activo.
5. **Liquidation fee** — fee predefinido y limitado en caso de liquidación.

```text
Revenue = setup_fee + monthly_SaaS + fee_per_loan + collateral_mgmt + liquidation_fee
```

**Principio:** no depender de liquidation fees, porque genera incentivos negativos (Bóveda no debe lucrar con que el usuario pierda). El revenue principal viene del flujo normal (originación, vault activo, SaaS).

---

## Riesgos y mitigaciones

### Riesgo de adopción

Originadores tradicionales pueden no querer acercarse a cripto.

*Mitigación:* GTM inicial con originadores cripto-friendly (fondos VC web3, fintechs cripto). Expansión a tradicionales en fase 2 con casos de éxito demostrados.

### Riesgo regulatorio

Aunque Bóveda sea infraestructura, participa en un flujo con criptoactivos.

*Mitigación:* no custodiar discrecionalmente, publicar solo hashes, separar roles, mantener KYC/AML en el originador, integrar Wavy Node, trabajar con Ledger Leaders Week post-hackathon.

### Riesgo técnico

Smart contracts, oráculos y liquidaciones pueden fallar.

*Mitigación:* auditoría, oráculos redundantes con fallback, pausas de emergencia limitadas, límites por activo, LTV conservador, testnet y pilotos controlados.

### Riesgo de liquidez

El colateral puede caer demasiado rápido o no liquidarse bien.

*Mitigación:* aceptar solo activos altamente líquidos (USDC, BTC.b, WAVAX), limitar LTV, liquidación parcial temprana, haircuts por volatilidad, caps por activo, monitoreo continuo de profundidad de pools DEX.

### Riesgo de scoring (single point of failure)

Sin Wavy Node no hay scoring.

*Mitigación:* cache de scores recientes válidos, segundo proveedor de backup, degradación a manual review.

### Riesgo de off-ramp (cliente tradicional)

Originadores tradicionales reciben USDC, no MXN.

*Mitigación:* GTM inicial con cripto-nativos (que operan en USDC). Para tradicionales, capa de off-ramp automatizada vía custodio o exchange regulado en fase 2.

---

## Roadmap post-hackathon

### Fase 1 — Piloto (0-6 meses)

- Auditoría de smart contracts.
- Wavy Node productivo.
- Primer originador cripto-nativo en producción (fondo VC o fintech cripto).
- 50-200 préstamos en piloto controlado.
- Activos: USDC, BTC.b.
- LTV conservador.
- Datos para iteración.

### Fase 2 — Escalamiento (6-18 meses)

- Múltiples originadores.
- Más activos elegibles.
- Capa de off-ramp automatizada para originadores tradicionales.
- Primer originador tradicional (SOFOM o fintech tradicional).
- Trabajo regulatorio con apoyo legal.
- API pública y documentación.

### Fase 3 — Estándar de mercado (18-36 meses)

- Bankaool y bancos regionales como channel partners activos.
- Buró de crédito on-chain pseudónimo basado en NFTs portables.
- Múltiples geografías LatAm.
- Integración con otros originadores y fondeadores.
- Posible tokenización de cartera para mercado secundario.

---

## Por qué Bóveda puede ganar esta hackathon

### 1. Encaje directo con el tema del hackathon

"LatAm Institucional — soluciones reales a problemas reales." Bóveda no inventa un caso de uso: resuelve cómo abrir crédito fiat respaldado por cripto sin que el banco toque cripto. Bankaool y Arkangeles tienen roles concretos.

### 2. Uso protagónico de Avalanche

Avalanche no es decoración. Vault, NFT, atestaciones y liquidación viven en Avalanche. Finality sub-segundo y costos bajos son argumentos técnicos defendibles, no eslogan.

### 3. Uso protagónico de Wavy Node

Risk score y AML on-chain son inputs centrales, no extra. Califica directo para el premio Wavy Node y para continuar post-hackathon.

### 4. Narrativa institucional clara con GTM realista

Positioning institucional + GTM cripto-nativo primero. No promete lo que no puede entregar. No es DeFi disfrazado de fintech.

### 5. MVP demostrable en 36 horas con dos casos de uso

La demo dual (institucional + cripto-nativo) cubre dos audiencias del jurado con una sola infraestructura.

### 6. Modelo de negocio claro y simple

SaaS + fee por préstamo + collateral management. Sin depender de liquidation fees.

### 7. Camino realista post-hackathon

Piloto con cripto-nativo → expansión a tradicional → estándar de mercado. No requiere convertirse en banco ni en SOFOM. Solo requiere ejecutar bien la capa de infraestructura.

---

## Frase final de pitch

**Bóveda is the infrastructure layer that lets financial institutions and credit originators offer fiat loans backed by crypto collateral. Originators keep the customer relationship, fiat disbursement and repayment flow; Bóveda handles wallet risk verification, Avalanche collateral vaults, payment attestations, LTV monitoring and automated liquidation. Designed for traditional institutions, deployed first with crypto-native originators.**

En español:

**Bóveda es la infraestructura que permite a instituciones financieras y originadores de crédito ofrecer préstamos fiat respaldados por colateral cripto. El originador mantiene la relación con el cliente, el desembolso y el cobro fiat; Bóveda resuelve la verificación de wallet, los vaults en Avalanche, las atestaciones de pago, el monitoreo de LTV y la liquidación automática. Diseñada para instituciones tradicionales, desplegada primero con originadores cripto-nativos.**
