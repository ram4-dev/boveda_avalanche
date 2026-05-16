# Bóveda Smart Contracts — Batch 1 MVP

## Estructura

```
boveda_avalanche/
├── contracts/
│   ├── LoanRegistry.sol       ✅ B1.1 (creado)
│   ├── CollateralVault.sol    ✅ B1.2 (implementado)
│   ├── LoanReceiptNFT.sol     ✅ B1.3 (implementado)
│   ├── PaymentAttestation.sol ✅ B1.4
│   ├── LiquidationEngine.sol  ✅ B1.5
│   ├── interfaces/
│   ├── mocks/
│   │   └── MockERC20.sol      ✅ (test helper)
├── script/
│   └── Deploy.s.sol           ⏳ (script de deployment)
├── test/
│   ├── LoanRegistry.t.sol     ✅ (tests para B1.1)
│   ├── CollateralVault.t.sol   ✅ (tests para B1.2)
│   ├── LoanReceiptNFT.t.sol    ✅ (tests para B1.3)
│   └── ...
├── foundry.toml               ✅ (configurado para Fuji)
├── .env.example               ✅
└── FUJI_SETUP.md              ✅ (guía de setup)
```

## Instalación rápida

### 1. Instalar Foundry

```bash
curl -L https://foundry.paradigm.xyz | bash
foundryup
```

Verifica que está instalado:
```bash
forge --version
```

### 2. Configurar Avalanche Fuji

Sigue [FUJI_SETUP.md](./FUJI_SETUP.md) para:
- Obtener tu private key
- Crear `.env` con `DEPLOYER_PRIVATE_KEY`
- Obtener AVAX en testnet

### 3. Compilar contratos

```bash
forge build
```

Debería compilar sin errores.

### 4. Ejecutar tests

```bash
# Todos los tests
forge test

# Un archivo específico
forge test test/LoanRegistry.t.sol -v

# Con output detallado
forge test -vvv
```

## Batch 1 — Tareas y estado

### B1.1 ✅ LoanRegistry
**Estado:** Implementado y testeado
**Qué hace:**
- Crear préstamos con estado inicial
- Almacenar: borrower, originator, colateral, monto, LTV
- Cambiar estado del préstamo (Requested → Active → Repaid, etc)
- Listado de préstamos por borrower/originator

**Usar:**
```solidity
LoanRegistry registry = new LoanRegistry();
uint256 loanId = registry.createLoan(
    borrower,
    originator,
    collateralToken,
    1000e18,      // colateral en wei
    500e18,       // monto préstamo
    5000,         // 50% LTV en basis points
    block.timestamp + 365 days
);
```

### B1.2 ✅ CollateralVault
**Próximo paso**
- Depósito de tokens ERC20
- Bloqueo por loanId
- Cálculo de LTV (con precios simulados)
- Liberación después de repago

### B1.3 ✅ LoanReceiptNFT
- NFT soulbound (no transferible)
- Mint al activar préstamo
- Metadata con loanId y hash de términos

### B1.4 ✅ PaymentAttestation
- Registrar pagos con hash
- Validar firma del attestor
- Emitir evento de pago

### B1.5 ✅ LiquidationEngine
- Liquidación simulada
- Transferencia de colateral a originador
- Devolver excedente a borrower

### B1.6 ⏳ Deploy en Fuji
- Script de deployment
- Verificación en Snowtrace

## Próximos pasos

1. ✅ Confirmar que Foundry compila (`forge build`)
2. ✅ Confirmar que tests pasan (`forge test`)
3. ✅ Implementar B1.2 (CollateralVault)
4. ✅ Implementar B1.3 (LoanReceiptNFT)
5. ✅ Implementar B1.4 (PaymentAttestation)
6. ✅ Implementar B1.5 (LiquidationEngine)
7. ⏳ Deploy y verificación en Fuji

## Testing tipología

```bash
# Test específico
forge test --match testCreateLoan -v

# Test de una función
forge test --match "testSetLoanStatus" -v

# Debug de un test fallido
forge test --match "testInvalidBorrower" -vvv
```

## Deployment

El script `script/Deploy.s.sol` deploya contratos base y, si recibe variables de oracle, deja `ChainlinkPriceOracle` conectado al `LiquidationEngine`.

```bash
forge script script/Deploy.s.sol --rpc-url fuji --broadcast --verify
```

Variables relevantes:

```bash
USDC_ADDRESS=0x...                       # opcional; si no se setea, deploya mock USDC
CHAINLINK_MAX_STALENESS_SECONDS=86400    # opcional; default 1 día
COLLATERAL_TOKEN_ADDRESS=0x...           # token usado como loan.collateralToken
COLLATERAL_USD_FEED_ADDRESS=0x...        # Chainlink AggregatorV3 token/USD en Fuji
```

Si `COLLATERAL_TOKEN_ADDRESS` y `COLLATERAL_USD_FEED_ADDRESS` están seteadas, el script ejecuta:

```solidity
priceOracle.setFeed(COLLATERAL_TOKEN_ADDRESS, COLLATERAL_USD_FEED_ADDRESS);
liquidationEngine.setPriceOracle(address(priceOracle));
```

Esto hace que `LiquidationEngine` ignore precios manuales y use el feed configurado al evaluar liquidaciones.

Esto:
1. Deploya todos los contratos a Fuji
2. Configura oracle si hay token/feed
3. Guarda/loguea addresses
4. Verifica en Snowtrace
5. Guarda ABIs para el backend

---

**¿Qué necesitas hacer ahora?**

1. Instalar Foundry: `curl -L https://foundry.paradigm.xyz | bash && foundryup`
2. Seguir [FUJI_SETUP.md](./FUJI_SETUP.md)
3. Ejecutar `forge build` para confirmar que compila
4. Ejecutar `forge test` para confirmar que los tests pasan
5. Avísame cuando esté listo para B1.2 (CollateralVault)
