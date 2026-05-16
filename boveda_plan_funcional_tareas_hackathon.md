# Bóveda — Plan funcional, batches de trabajo y agrupación de tareas

Este documento traduce la tesis y arquitectura de `boveda_documento_final_hackathon.md` en un plan funcional de ejecución para hackathon. El objetivo es separar el trabajo en módulos claros, batches paralelizables y tareas verificables para construir una demo dual en 36 horas.

## Resultado esperado

Al final del hackathon, Bóveda debe demostrar que un originador financiero puede usar infraestructura en Avalanche para ofrecer crédito respaldado por colateral cripto sin custodiar cripto ni construir la capa técnica completa.

La demo debe cubrir dos casos:

1. **Caso institucional tradicional:** PyME/exportador con USDC recibe préstamo MXN simulado vía originador/SOFOM.
2. **Caso cripto-nativo:** startup web3 recibe bridge loan en USDC de un fondo VC usando colateral cripto.

## Principios de recorte

| Principio                  | Decisión funcional                                                                                  |
| -------------------------- | --------------------------------------------------------------------------------------------------- |
| Demo antes que completitud | Construir solo lo necesario para contar el flujo completo.                                          |
| Pocos contratos sólidos    | Priorizar `LoanRegistry`, `CollateralVault` y `LoanReceiptNFT`; mockear adapters complejos.         |
| Off-chain explícito        | KYC, SPEI, CLABE, contratos legales y facturas quedan fuera del MVP.                                |
| On-chain verificable       | Vault, estado del préstamo, NFT, hashes de atestaciones y eventos críticos viven en Avalanche Fuji. |
| Riesgo demostrable         | Wavy Node puede ser mock/adaptador, pero debe ser central en la narrativa y UI.                     |
| Liquidación visible        | La demo debe mostrar LTV, default/liquidación simulada y distribución de proceeds.                  |

## Separación funcional del sistema

### 1. Smart contracts / Avalanche

Responsable de la custodia programable, estados del préstamo, NFT y eventos verificables.

Incluye:

- Crear préstamo.
- Crear vault o asociar vault por préstamo.
- Depositar colateral.
- Activar préstamo.
- Emitir Loan Receipt NFT soulbound.
- Registrar pagos vía hash/atestación.
- Calcular o recibir estado de LTV para demo.
- Ejecutar liquidación simulada o real en testnet.
- Liberar colateral o marcar préstamo liquidado.

No incluye:

- DEX real complejo si compromete el tiempo.
- Oracle production-grade con múltiples fallback.
- Auditoría formal.

### 2. Backend / API Bóveda

Responsable de orquestar el flujo para el originador y conectar UI con contratos.

Incluye:

- API para crear solicitud de préstamo.
- Cálculo de términos sugeridos.
- Mock/adaptador de Wavy Node.
- Mock de payment attestor.
- Servicio de firma de atestaciones.
- Listener o indexador simple de eventos on-chain.
- Endpoints para dashboard institucional.
- Estados agregados: cartera activa, LTV promedio, margin calls, pagos y liquidaciones.

No incluye:

- KYC real.
- Payment processor real.
- Conciliación contable completa.
- Off-ramp USDC → MXN.

### 3. Borrower Widget

Responsable de mostrar el flujo del usuario final.

Incluye:

- Conectar wallet.
- Ver oferta de préstamo.
- Ver colateral requerido y LTV.
- Depositar colateral.
- Ver estado del préstamo.
- Ver NFT/receipt.
- Simular pago de cuota.
- Ver alerta de margin call o liquidación.

No incluye:

- Wallet propia.
- KYC real.
- Formularios largos de onboarding.

### 4. Institutional Dashboard

Responsable de mostrar valor para originador, fondeador y jurado institucional.

Incluye widgets:

- Capital utilizado / cartera activa.
- Vaults activos.
- LTV promedio y LTV por préstamo.
- Préstamos en margin call.
- Pagos atestados.
- Liquidaciones ejecutadas.
- Exposición por activo.
- Audit trail on-chain.

No incluye:

- Reportería contable completa.
- Roles/permisos granulares.
- Exportaciones avanzadas.

### 5. Demo, pitch y narrativa

Responsable de conectar tecnología con valor de negocio.

Incluye:

- Script de demo dual.
- Slides mínimas.
- Datos semilla para ambos casos.
- Frases de posicionamiento.
- Explicación clara de qué es on-chain y qué queda off-chain.
- Riesgos y mitigaciones.
- Encaje con Bankaool, Arkangeles, Wavy Node, Oracle y Avalanche.

## Batches de trabajo

Los batches están pensados para correr en paralelo, pero con puntos de integración obligatorios. Cada batch produce un entregable demoable.

## Batch 0 — Alineación y contratos de integración

**Objetivo:** que todo el equipo use los mismos nombres, estados, eventos y datos de prueba.

**Duración sugerida:** 1-2 horas.

**Dependencias:** ninguna.

| Tarea                                  | Descripción                                                                               | Entregable                          | Dueño sugerido      |
| -------------------------------------- | ----------------------------------------------------------------------------------------- | ----------------------------------- | ------------------- |
| B0.1 Definir flujo canónico            | Fijar los pasos de originación, pago y liquidación que se van a demoear.                  | `demo-flow.md` o sección en README. | PM/demo             |
| B0.2 Definir modelo mínimo de préstamo | Campos: loanId, borrower, originator, collateralToken, amount, LTV, thresholds, status.   | Interface JSON compartida.          | Backend + contracts |
| B0.3 Definir estados                   | Requested, Approved, Active, MarginCall, Repaid, Defaulted, Liquidated, Cancelled.        | Enum compartido.                    | Contracts           |
| B0.4 Definir eventos                   | LoanCreated, CollateralDeposited, LoanActivated, InstallmentPaid, MarginCall, Liquidated. | Lista de eventos y payloads.        | Contracts + backend |
| B0.5 Crear datos semilla               | Dos préstamos: PyME USDC→MXN simulado y startup→USDC.                                     | JSON seed/demo fixtures.            | Backend + demo      |

**Criterio de aceptación:** frontend, backend y contratos pueden trabajar contra el mismo contrato de datos sin reinterpretar nombres.

## Batch 1 — Smart contracts MVP

**Objetivo:** tener una base on-chain verificable para el flujo principal.

**Duración sugerida:** 8-12 horas.

**Dependencias:** Batch 0.

| Tarea                               | Descripción                                                        | Entregable                             | Dependencias |
| ----------------------------------- | ------------------------------------------------------------------ | -------------------------------------- | ------------ |
| B1.1 Crear LoanRegistry             | Registrar préstamos, estados y metadata mínima.                    | Contrato compilando con tests básicos. | B0           |
| B1.2 Crear CollateralVault          | Permitir depósito, bloqueo y liberación/liquidación de colateral.  | Contrato o módulo integrado.           | B1.1         |
| B1.3 Crear LoanReceiptNFT           | NFT soulbound asociado al loanId, sin transferencias.              | Contrato ERC721/SBT funcional.         | B1.1         |
| B1.4 Registrar atestaciones de pago | Guardar hash de pago y emitir evento `InstallmentPaid`.            | Función + evento.                      | B1.1         |
| B1.5 Implementar liquidación demo   | Marcar préstamo como liquidado y simular distribución de proceeds. | Función `liquidate()` demoable.        | B1.2         |
| B1.6 Deploy en Fuji                 | Desplegar contratos y guardar addresses.                           | Addresses + explorer links.            | B1.1-B1.5    |

**Criterio de aceptación:** se puede crear préstamo, depositar colateral, activar, emitir receipt, registrar pago y liquidar en Fuji o entorno local con salida reproducible.

**Recorte permitido:** fusionar `LoanRegistry` + `LoanReceiptNFT` si el tiempo aprieta; simular liquidación sin swap real.

## Batch 2 — Backend, riesgo y atestaciones

**Objetivo:** exponer una API simple que permita operar el flujo desde las pantallas y sostener la narrativa institucional.

**Duración sugerida:** 8-12 horas.

**Dependencias:** Batch 0. Integra con Batch 1 cuando haya ABI/addresses.

| Tarea                                | Descripción                                                  | Entregable                         | Dependencias |
| ------------------------------------ | ------------------------------------------------------------ | ---------------------------------- | ------------ |
| B2.1 Crear API base                  | Endpoints health, loans, risk, payments, dashboard.          | Server corriendo.                  | B0           |
| B2.2 Implementar cálculo de términos | LTV máximo, thresholds, monto sugerido según activo y score. | Endpoint `/quote` o `/risk/terms`. | B0           |
| B2.3 Integrar/mockear Wavy Node      | Devolver risk score, AML status, expiry y firma/mock.        | Endpoint `/risk/wallet`.           | B2.1         |
| B2.4 Firmar atestaciones de pago     | Generar payload y hash para registrar pago on-chain.         | Endpoint `/payments/attest`.       | B2.1         |
| B2.5 Conectar contratos              | Usar ABI/addresses para crear/activar/pagar/liquidar.        | Service web3 funcional.            | B1.6 parcial |
| B2.6 Dashboard aggregation           | Calcular métricas de cartera y exposición.                   | Endpoint `/dashboard/summary`.     | B2.1 + seeds |
| B2.7 Event listener simple           | Leer eventos o refrescar estado post-transacción.            | Estado sincronizado para UI.       | B1.6         |

**Criterio de aceptación:** desde backend se puede completar el flujo mínimo o simularlo con consistencia, y el dashboard recibe métricas reales o fixtureadas con trazabilidad.

**Recorte permitido:** si el listener consume tiempo, usar refresh manual por tx hash o fixtures actualizados después de cada acción.

## Batch 3 — Borrower Widget

**Objetivo:** construir la experiencia del usuario final en pocos pasos visuales.

**Duración sugerida:** 8-10 horas.

**Dependencias:** Batch 0. Puede iniciar contra mocks del Batch 2.

| Tarea                             | Descripción                                             | Entregable                      | Dependencias  |
| --------------------------------- | ------------------------------------------------------- | ------------------------------- | ------------- |
| B3.1 Pantalla de solicitud/oferta | Mostrar monto, colateral, LTV, plazo y tasa.            | UI de oferta.                   | B0 + seeds    |
| B3.2 Conexión de wallet           | Conectar wallet compatible y mostrar address.           | Wallet connect funcionando.     | B0            |
| B3.3 Depósito de colateral        | Invocar contrato o simular hasta integrar.              | Acción de depósito visible.     | B1/B2 parcial |
| B3.4 Estado del préstamo          | Mostrar Active, paid installments, LTV actual, receipt. | Pantalla de préstamo activo.    | B2            |
| B3.5 Simular pago                 | Botón para pagar cuota y registrar atestación.          | Evento de pago visible.         | B2.4/B2.5     |
| B3.6 Simular margin/liquidación   | Mostrar alerta y resultado de liquidación.              | Pantalla de riesgo/liquidación. | B2/B1.5       |

**Criterio de aceptación:** un jurado puede entender el flujo del borrower sin explicación técnica previa.

**Recorte permitido:** dos pantallas principales: `Oferta + depósito` y `Estado + pago/liquidación`.

## Batch 4 — Institutional Dashboard

**Objetivo:** mostrar por qué Bóveda es infraestructura para originadores y fondeadores, no solo una app cripto.

**Duración sugerida:** 8-10 horas.

**Dependencias:** Batch 0 y endpoints de Batch 2, aunque puede iniciar con fixtures.

| Tarea                     | Descripción                                                    | Entregable              | Dependencias    |
| ------------------------- | -------------------------------------------------------------- | ----------------------- | --------------- |
| B4.1 Layout institucional | Crear estructura clara con cards y tabla de cartera.           | Dashboard base.         | B0              |
| B4.2 Widgets de cartera   | Capital utilizado, préstamos activos, vaults activos, mora.    | Cards principales.      | B2.6 o fixtures |
| B4.3 Widget LTV/riesgo    | LTV promedio, préstamos en margin call, exposición por activo. | Sección de riesgo.      | B2.6            |
| B4.4 Audit trail          | Lista de eventos con links o tx hashes.                        | Tabla de eventos.       | B1/B2           |
| B4.5 Vista de préstamo    | Detalle de loanId, borrower wallet, colateral, pagos, estado.  | Drawer/page de detalle. | B2              |
| B4.6 Modo demo dual       | Toggle entre Caso A institucional y Caso B cripto-nativo.      | Selector de demo.       | B0.5            |

**Criterio de aceptación:** el dashboard comunica garantías al fondeador: colateral verificable, LTV, pagos atestados y liquidación programática.

**Recorte permitido:** usar fixtures estáticos para métricas agregadas si el flujo on-chain ya se ve en audit trail.

## Batch 5 — Integración end-to-end

**Objetivo:** unir los módulos en un flujo demoable, estable y repetible.

**Duración sugerida:** 6-8 horas.

**Dependencias:** Batches 1-4 en versión mínima.

| Tarea                            | Descripción                                            | Entregable                            | Dependencias |
| -------------------------------- | ------------------------------------------------------ | ------------------------------------- | ------------ |
| B5.1 Integrar addresses/ABI      | Configurar frontend/backend con contratos desplegados. | `.env.example` o config sin secretos. | B1.6         |
| B5.2 Probar originación completa | Crear préstamo → depositar → activar → receipt.        | Flujo feliz funcionando.              | B1-B3        |
| B5.3 Probar pago atestado        | Simular pago → hash → evento on-chain → dashboard.     | Pago visible en UI.                   | B2-B4        |
| B5.4 Probar liquidación          | Forzar LTV/default → liquidar → dashboard actualizado. | Liquidación visible.                  | B1-B4        |
| B5.5 Preparar reset demo         | Script o procedimiento para volver a estado inicial.   | `demo-reset` o guía manual.           | Todos        |
| B5.6 Congelar scope              | Bloquear features nuevas; solo fixes de demo.          | Lista de no-go.                       | Todos        |

**Criterio de aceptación:** se puede correr la demo completa dos veces seguidas sin intervención improvisada.

## Batch 6 — Pitch, narrativa y materiales

**Objetivo:** convertir la demo en una historia ganadora para jurado institucional y técnico.

**Duración sugerida:** paralelo durante todo el hackathon; cierre final 4-6 horas.

**Dependencias:** documento canónico y avances de demo.

| Tarea                    | Descripción                                                    | Entregable               | Dependencias       |
| ------------------------ | -------------------------------------------------------------- | ------------------------ | ------------------ |
| B6.1 Script de demo      | Escribir recorrido paso a paso, quién habla y qué se muestra.  | `demo-script.md`.        | B0                 |
| B6.2 Slides mínimas      | Problema, solución, arquitectura, demo dual, negocio, roadmap. | Deck final.              | Documento canónico |
| B6.3 Narrativa partners  | Bankaool, Arkangeles, Wavy Node, Oracle, Avalanche.            | Slide o talking points.  | Documento canónico |
| B6.4 Riesgos y recortes  | Explicar qué no entra y por qué es correcto.                   | Slide de MVP scope.      | B0-B5              |
| B6.5 Ensayo cronometrado | Practicar demo con tiempos y fallback.                         | Runbook de presentación. | B5                 |
| B6.6 Plan B              | Screenshots/video por si falla testnet o wallet.               | Carpeta de backup.       | B5                 |

**Criterio de aceptación:** la presentación puede defender qué es Bóveda, por qué Avalanche importa, dónde entra Wavy Node y por qué el MVP es realista.

## Orden recomendado por olas

### Ola 1 — Contrato de trabajo común

- B0.1 Definir flujo canónico.
- B0.2 Definir modelo mínimo de préstamo.
- B0.3 Definir estados.
- B0.4 Definir eventos.
- B0.5 Crear datos semilla.

**Salida:** todos pueden trabajar en paralelo sin romper integración.

### Ola 2 — Construcción paralela de módulos

- Batch 1: contratos.
- Batch 2: backend contra mocks.
- Batch 3: borrower widget contra mocks.
- Batch 4: dashboard contra fixtures.
- Batch 6: narrativa y slides iniciales.

**Salida:** cada módulo tiene una versión aislada demoable.

### Ola 3 — Integración mínima

- B2.5 Conectar contratos.
- B3.3 Depósito de colateral real o semi-real.
- B4.4 Audit trail con tx/eventos.
- B5.1 Configuración ABI/addresses.
- B5.2 Flujo de originación completa.

**Salida:** primer end-to-end feliz.

### Ola 4 — Riesgo, pagos y liquidación

- B2.3 Wavy Node mock/adaptador.
- B2.4 Atestaciones de pago.
- B1.5 Liquidación demo.
- B3.5 Pago.
- B3.6 Margin/liquidación.
- B4.3 Riesgo y exposición.
- B5.3/B5.4 pruebas integradas.

**Salida:** demo muestra valor diferencial, no solo originación.

### Ola 5 — Pulido y congelamiento

- B5.5 Reset demo.
- B5.6 Congelar scope.
- B6.4 Riesgos y recortes.
- B6.5 Ensayo.
- B6.6 Plan B.

**Salida:** demo repetible y pitch coherente.

## Asignación sugerida para equipo de 4 personas

| Persona | Foco primario                   | Foco secundario                    |
| ------- | ------------------------------- | ---------------------------------- |
| Dev A   | Smart contracts / Fuji          | ABI, eventos, deploy scripts       |
| Dev B   | Backend / API / atestaciones    | Wavy Node mock, dashboard data     |
| Dev C   | Frontend Borrower Widget        | Wallet, flujo de usuario, polish   |
| Dev D   | Institutional Dashboard / pitch | Demo script, slides, datos semilla |

### Si el equipo es de 3 personas

| Persona | Foco                                       |
| ------- | ------------------------------------------ |
| Dev A   | Smart contracts + deploy                   |
| Dev B   | Backend + integración + Wavy/payment mocks |
| Dev C   | Frontend completo + demo/pitch             |

### Si el equipo es de 2 personas

| Persona | Foco                         |
| ------- | ---------------------------- |
| Dev A   | Contratos + backend mínimo   |
| Dev B   | Frontend + dashboard + pitch |

Recorte obligatorio con 2 personas: dashboard con fixtures, liquidación simulada y mínimo número de pantallas.

## Matriz de dependencias

| Módulo          | Depende de                      | Puede empezar con mocks | Bloquea a                     |
| --------------- | ------------------------------- | ----------------------: | ----------------------------- |
| Smart contracts | Batch 0                         |                      No | Integración real, audit trail |
| Backend         | Batch 0                         |                      Sí | Frontend dinámico, dashboard  |
| Borrower Widget | Batch 0                         |                      Sí | Demo de usuario               |
| Dashboard       | Batch 0                         |                      Sí | Demo institucional            |
| Demo/pitch      | Documento canónico              |                      Sí | Presentación final            |
| Integración E2E | Contratos + backend + UI mínima |                      No | Ensayo final                  |

## Checklist de aceptación por demo

### Caso A — Institucional tradicional

- [ ] Se muestra una PyME/exportador con USDC como colateral.
- [ ] Se calcula préstamo MXN simulado con LTV conservador.
- [ ] Se deposita colateral en vault.
- [ ] Se activa préstamo y se emite receipt.
- [ ] Se registra pago MXN como atestación/hash on-chain.
- [ ] Dashboard muestra exposición, LTV y audit trail.
- [ ] Se explica que Bankaool/fondeador no toca cripto.

### Caso B — Cripto-nativo

- [ ] Se muestra startup web3 pidiendo bridge loan.
- [ ] Se deposita colateral cripto.
- [ ] Se desembolsa USDC simulado o testnet.
- [ ] Se registra pago USDC o default.
- [ ] Se ejecuta liquidación demo.
- [ ] Dashboard muestra liquidación y proceeds.
- [ ] Se explica por qué GTM inicial es cripto-nativo.

## Checklist técnico mínimo

- [ ] Contratos compilan.
- [ ] Contratos desplegados o entorno local listo.
- [ ] Addresses documentadas.
- [ ] Backend corre con un comando.
- [ ] Frontend corre con un comando.
- [ ] Seeds disponibles.
- [ ] Demo reset documentado.
- [ ] No hay dependencia de KYC/SPEI/off-ramp real.
- [ ] Wavy Node aparece como input central, aunque sea mock/adaptador.
- [ ] Avalanche aparece en los eventos, vaults y narrativa técnica.

## Cut line: qué se elimina si falta tiempo

Eliminar en este orden:

1. Oracle real con fallback múltiple.
2. Swap real en DEX para liquidación.
3. Listener automático de eventos.
4. Vista de detalle avanzada del dashboard.
5. Multi-activo amplio.
6. Receipt NFT metadata completa.
7. Segundo caso de uso con transacciones reales; mantenerlo como fixture narrativo si hace falta.

No eliminar:

- Vault/colateral visible.
- Estado de préstamo.
- Atestación de pago por hash/evento.
- Dashboard institucional básico.
- Narrativa Wavy Node + Avalanche.
- Demo de liquidación aunque sea simulada.

## Entregables finales

| Entregable              | Descripción                                                       |
| ----------------------- | ----------------------------------------------------------------- |
| Smart contracts         | Contratos MVP, deploy scripts, addresses Fuji/local.              |
| Backend/API             | Endpoints para quote, risk, payments, dashboard y contract calls. |
| Borrower Widget         | Flujo de solicitud, wallet, depósito, estado, pago/liquidación.   |
| Institutional Dashboard | Métricas institucionales, audit trail, cartera y exposición.      |
| Demo script             | Guion paso a paso con fallback.                                   |
| Deck                    | Slides de pitch.                                                  |
| README                  | Cómo correr, qué está mockeado y qué es real.                     |
| Backup assets           | Screenshots/video por si falla infraestructura en vivo.           |

## Resumen ejecutivo de ejecución

1. Primero se define el contrato de datos común.
2. Después se construyen contratos, backend, borrower widget y dashboard en paralelo.
3. La primera integración debe priorizar originación feliz.
4. La segunda integración agrega pago atestado y liquidación.
5. Al final se congela scope, se ensaya y se presenta con backup.

La clave no es construir todo Bóveda. La clave es demostrar una infraestructura institucional creíble: colateral programable en Avalanche, riesgo wallet vía Wavy Node, pagos fiat/USDC atestados, monitoreo de LTV y liquidación automática visible para originadores y fondeadores.
