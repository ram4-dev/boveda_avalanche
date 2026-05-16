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

## Batch 7 — Riesgo on-chain, top-up y automatización

**Objetivo:** cerrar la brecha entre demo mock-first e infraestructura operable: precios on-chain, monitoreo automático de LTV, liquidación por keeper y adición de colateral para reducir riesgo.

**Duración sugerida:** 8-12 horas.

**Dependencias:** Batch 1 mergeado/integrado, Batch 2 con adapter web3, Batch 3 para la acción borrower.

| Tarea                                    | Descripción                                                                            | Entregable                                      | Dependencias     |
| ---------------------------------------- | -------------------------------------------------------------------------------------- | ----------------------------------------------- | ---------------- |
| B7.1 Implementar `OracleAdapter`         | Leer precio/LTV desde Chainlink Fuji o adapter controlado, con interfaz reemplazable.  | Adapter + tests + fuente de precio documentada. | B1 + B2.5        |
| B7.2 Keeper de margin call/liquidación   | Servicio/bot que monitorea LTV y dispara margin call o liquidación cuando corresponde. | Keeper runnable, dry-run y runbook.             | B7.1 + B1.5 + B2 |
| B7.3 Adición de colateral en web3        | Permitir agregar colateral a un préstamo activo o en margin call para bajar LTV.       | Función/flujo contrato-vault + evento.          | B1.2 + B7.1      |
| B7.4 Adición de colateral en backend     | Exponer acción backend para top-up, llamar web3 adapter y refrescar estado/eventos.    | Endpoint/servicio de top-up + tests.            | B7.3 + B2        |
| B7.5 Adición de colateral en borrower UI | Mostrar acción para agregar colateral, resultado de tx/evento y LTV actualizado.       | Control UI + estado visible post-top-up.        | B7.4 + B3        |

**Criterio de aceptación:** se puede mostrar un préstamo en riesgo, agregar colateral para bajar LTV, o dejar que el keeper dispare margin call/liquidación usando precios de una fuente definida y trazable.

**Recorte permitido:** si Chainlink o el keeper completo consumen demasiado tiempo, usar un adapter de precio controlado y un keeper manual/dry-run, pero mantener las interfaces reales, eventos y runbook para reemplazo posterior.

## Batch 8 — Dashboard institucional con fuentes reales

**Objetivo:** conectar el dashboard institucional ya construido en otro worktree a fuentes de verdad reales, evitando que loans, métricas y audit trail salgan de mocks en el camino demo/productivo.

**Duración sugerida:** 6-10 horas.

**Dependencias:** Batch 4 dashboard UI, Batch 5 integración, y decisión de fuente al iniciar este batch.

| Tarea                                     | Descripción                                                                                                                | Entregable                               | Dependencias |
| ----------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------- | ------------ |
| B8.1 Definir fuente de verdad por dato    | Decidir, al hacer el batch, si loans, audit trail, receipts, pagos y métricas salen de blockchain, DB o enfoque híbrido.   | Matriz dato → fuente → fallback → dueño. | B1-B5        |
| B8.2 Capa de lectura real para dashboard  | Implementar adapters/repositorios para leer datos desde las fuentes definidas, no desde mocks del frontend.                | API/data layer real para dashboard.      | B8.1         |
| B8.3 Audit trail real                     | Mostrar eventos, tx hashes, receipts y liquidaciones desde chain/indexer/DB según la decisión de fuente.                   | Audit trail trazable y verificable.      | B8.1 + B8.2  |
| B8.4 Wiring del dashboard institucional   | Conectar el dashboard del otro worktree a la API/data layer real y remover mocks del camino principal.                     | Dashboard consumiendo fuentes reales.    | B4 + B8.2    |
| B8.5 Estados de sincronización y fallback | Mostrar pending/stale/unavailable cuando falte una fuente; cualquier fixture debe quedar explícitamente marcado como demo. | UX de estado y fallback honesto.         | B8.3 + B8.4  |

**Criterio de aceptación:** el dashboard institucional puede explicar de dónde sale cada dato crítico y mostrar loans, exposición, LTV, pagos, liquidaciones y audit trail desde la fuente definida para ese dato.

**Decisión diferida explícita:** este batch debe empezar definiendo si cada dato vive en blockchain, DB/indexer o ambos. No asumir una fuente única antes de revisar el estado real de contratos, backend y dashboard.

**Recorte permitido:** mantener fixtures solo para backup de presentación, etiquetados como demo/fallback, nunca como fuente principal del dashboard institucional.

## Batch 9 — Live demo transaccional para jurado

**Objetivo:** permitir que una persona del jurado opere una demo en vivo desde el dashboard institucional y vea movimientos reales de fondos/estado en testnet, con trazabilidad directa a explorer.

**Duración sugerida:** 6-10 horas.

**Dependencias:** Batch 1 deployado, Batch 5 integración, Batch 8 dashboard con fuentes reales, y wallet demo fondeada en testnet.

| Tarea                                        | Descripción                                                                                                                                             | Entregable                                         | Dependencias |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------- | ------------ |
| B9.1 Wallet demo fondeada/preautorizada      | Preparar una wallet de demo con fondos de testnet suficientes y mecanismo seguro de firma; nunca exponer private keys en frontend, repo, logs o docs.   | Wallet demo operativa + runbook seguro.            | B1.6 + B5.1  |
| B9.2 Operaciones live desde dashboard        | Permitir disparar desde el dashboard las acciones principales: crear/aprobar préstamo, depositar/top-up, activar, atestar pago, margin call y liquidar. | Panel de operaciones live para jurado/presentador. | B5 + B7 + B8 |
| B9.3 Estado y fondos visibles en tiempo real | Refrescar balances, estado de préstamo, eventos, tx hashes y proceeds después de cada operación.                                                        | Vista live con pending/success/error trazable.     | B8.2 + B8.3  |
| B9.4 Links a explorer para addresses/txs     | Cada address, vault, wallet, contrato, receipt y tx hash visible debe tener link al explorer elegido.                                                   | Helper de explorer links + cobertura UI.           | B1.6 + B8    |
| B9.5 Definir explorer canónico               | Decidir al implementar si se usa Snowtrace, Avascan, Routescan u otro explorer para Fuji/mainnet.                                                       | Decisión documentada en config/runbook.            | B9.4         |
| B9.6 Modo jurado y límites de seguridad      | Agregar guardrails para evitar operaciones destructivas/repetidas accidentalmente y mostrar claramente que son fondos testnet/demo.                     | Modo live demo con confirmaciones y límites.       | B9.1 + B9.2  |

**Criterio de aceptación:** un jurado puede entrar al dashboard, ejecutar o presenciar operaciones con una wallet demo fondeada, ver cambios de balances/estado, y abrir links de explorer para confirmar que las addresses y transacciones existen.

**Duda explícita:** el explorer canónico queda por definir al hacer este batch (`Snowtrace`, `Avascan`, `Routescan` u otro según soporte Fuji/mainnet y UX). El plan solo exige que todos los links salgan de una configuración centralizada.

**Decisión tomada:** para Fuji/testnet usamos `Snowtrace` como explorer canónico. Los links de tx y address deben generarse desde una configuración común, y el backend extiende esa ruta a los eventos on-chain.

**Regla de seguridad:** la wallet puede estar preconectada o preautorizada para la live demo, pero la private key, seed phrase o credencial de firma no debe vivir en el frontend ni quedar documentada en texto plano. Usar secret manager, signer backend controlado, wallet session o mecanismo equivalente.

**Recorte permitido:** si no hay tiempo para que el jurado dispare todas las acciones, dejar un modo presenter-driven: el jurado observa el dashboard y abre explorer links mientras el presentador confirma cada operación.

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

### Ola 5 — Integración real avanzada

- B7.1 OracleAdapter.
- B7.2 Keeper de margin call/liquidación.
- B7.3/B7.4/B7.5 Adición de colateral en web3, backend y UI.
- B8.1 Definir fuente de verdad por dato del dashboard.
- B8.2-B8.4 Conectar dashboard institucional a fuentes reales.

**Salida:** demo con riesgo automatizable, top-up de colateral y dashboard institucional trazable.

### Ola 6 — Live demo transaccional

- B9.1 Wallet demo fondeada/preautorizada.
- B9.2 Operaciones live desde dashboard.
- B9.3 Estado y fondos visibles en tiempo real.
- B9.4/B9.5 Links a explorer y explorer canónico.
- B9.6 Modo jurado y límites de seguridad.

**Salida:** jurado puede ver operaciones reales de testnet, fondos, estados y txs verificables en explorer.

### Ola 7 — Pulido y congelamiento

- B5.5 Reset demo.
- B5.6 Congelar scope.
- B6.4 Riesgos y recortes.
- B6.5 Ensayo.
- B6.6 Plan B.
- B8.5 Estados de sincronización y fallback honesto.

**Salida:** demo repetible y pitch coherente.

## Asignación sugerida para equipo de 4 personas

| Persona | Foco primario                   | Foco secundario                                                           |
| ------- | ------------------------------- | ------------------------------------------------------------------------- |
| Dev A   | Smart contracts / Fuji          | ABI, eventos, deploy scripts, OracleAdapter, keeper                       |
| Dev B   | Backend / API / atestaciones    | Wavy Node mock, top-up backend, signer/live ops, fuentes reales dashboard |
| Dev C   | Frontend Borrower Widget        | Wallet, top-up UI, explorer links, flujo de usuario, polish               |
| Dev D   | Institutional Dashboard / pitch | Dashboard real-data wiring, live demo panel, demo script, slides          |

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

| Módulo              | Depende de                                               | Puede empezar con mocks | Bloquea a                                 |
| ------------------- | -------------------------------------------------------- | ----------------------: | ----------------------------------------- |
| Smart contracts     | Batch 0                                                  |                      No | Integración real, audit trail             |
| Backend             | Batch 0                                                  |                      Sí | Frontend dinámico, dashboard              |
| Borrower Widget     | Batch 0                                                  |                      Sí | Demo de usuario                           |
| Dashboard           | Batch 0                                                  |                      Sí | Demo institucional                        |
| Integración E2E     | Contratos + backend + UI mínima                          |                      No | Ensayo final                              |
| Riesgo automatizado | Contratos + backend web3 + oracle                        |            Parcialmente | Top-up, keeper, liquidación automatizable |
| Dashboard real-data | Dashboard UI + contratos/backend/DB                      |            Parcialmente | Demo institucional con trazabilidad real  |
| Live demo           | Dashboard real-data + wallet demo + contratos deployados |                      No | Validación del jurado en vivo             |
| Demo/pitch          | Documento canónico y avances de demo                     |                      Sí | Presentación final                        |

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
- [ ] `OracleAdapter` definido e integrado o recortado explícitamente con adapter controlado.
- [ ] Keeper de margin call/liquidación runnable o documentado como dry-run/manual.
- [ ] Adición de colateral para bajar LTV cubierta en web3, backend y UI, o brecha documentada.
- [ ] Dashboard institucional consume fuentes reales definidas para loans, métricas y audit trail, o muestra fallback demo etiquetado.
- [ ] Wallet demo fondeada/preautorizada documentada sin exponer private key, seed phrase ni credenciales.
- [ ] Dashboard puede disparar u observar operaciones live con estados pending/success/error.
- [ ] Addresses y tx hashes visibles tienen links a explorer desde configuración centralizada.
- [ ] Avalanche aparece en los eventos, vaults y narrativa técnica.

## Cut line: qué se elimina si falta tiempo

Eliminar en este orden:

1. Oracle real con fallback múltiple; mantener `OracleAdapter` mínimo o controlado.
2. Swap real en DEX para liquidación.
3. Keeper completamente autónomo; mantener dry-run/manual si falta tiempo.
4. Listener automático de eventos; mantener refresh o indexación mínima si el dashboard necesita trazabilidad.
5. Jurado disparando operaciones directamente; mantener modo presenter-driven si falta tiempo.
6. Vista de detalle avanzada del dashboard.
7. Multi-activo amplio.
8. Receipt NFT metadata completa.
9. Segundo caso de uso con transacciones reales; mantenerlo como fixture narrativo si hace falta.

No eliminar:

- Vault/colateral visible.
- Estado de préstamo.
- Atestación de pago por hash/evento.
- Dashboard institucional básico.
- Fuente de verdad definida para datos críticos del dashboard, aunque el fallback sea demo etiquetado.
- Links a explorer para addresses/txs críticos, aunque el explorer canónico quede configurable.
- Narrativa Wavy Node + Avalanche.
- Demo de liquidación aunque sea simulada.
- Camino de top-up de colateral o brecha explícita web3/backend/UI.

## Entregables finales

| Entregable              | Descripción                                                                          |
| ----------------------- | ------------------------------------------------------------------------------------ |
| Smart contracts         | Contratos MVP, deploy scripts, addresses Fuji/local.                                 |
| Backend/API             | Endpoints para quote, risk, payments, dashboard, top-up y contract calls.            |
| Borrower Widget         | Flujo de solicitud, wallet, depósito, top-up, estado, pago/liquidación.              |
| Institutional Dashboard | Métricas institucionales, audit trail, cartera y exposición desde fuentes definidas. |
| Oracle/Keeper           | Adapter de precio/LTV y keeper o dry-run de margin call/liquidación.                 |
| Live demo kit           | Wallet demo fondeada, panel de operaciones live, explorer links y runbook seguro.    |
| Demo script             | Guion paso a paso con fallback.                                                      |
| Deck                    | Slides de pitch.                                                                     |
| README                  | Cómo correr, qué está mockeado y qué es real.                                        |
| Backup assets           | Screenshots/video por si falla infraestructura en vivo.                              |

## Resumen ejecutivo de ejecución

1. Primero se define el contrato de datos común.
2. Después se construyen contratos, backend, borrower widget y dashboard en paralelo.
3. La primera integración debe priorizar originación feliz.
4. La segunda integración agrega pago atestado y liquidación.
5. La integración avanzada agrega OracleAdapter, keeper, top-up de colateral y dashboard con fuentes reales definidas.
6. La live demo agrega wallet demo fondeada, operaciones desde dashboard y links a explorer para ver fondos/txs.
7. Al final se congela scope, se ensaya y se presenta con backup.

La clave no es construir todo Bóveda. La clave es demostrar una infraestructura institucional creíble: colateral programable en Avalanche, riesgo wallet vía Wavy Node, pagos fiat/USDC atestados, monitoreo de LTV y liquidación automática visible para originadores y fondeadores.
