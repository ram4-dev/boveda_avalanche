# Setup Avalanche Fuji Testnet

## Paso 1: Obtener el Private Key del Deployer

1. Ve a https://core.app/ (Avalanche Core Wallet)
2. Crea o importa una wallet
3. Asegúrate de tener AVAX en Fuji testnet (ver Paso 3)
4. Exporta tu private key:
   - En Core, abre Settings → Private Keys
   - Copia tu private key (sin el prefijo "0x" si viene con él)

## Paso 2: Configurar .env

1. En la raíz del proyecto, copia `.env.example` a `.env`
2. Reemplaza `0x...your_private_key_here...` con tu private key real
3. **NO subas .env a git** (ya está en .gitignore)

```bash
DEPLOYER_PRIVATE_KEY=0xtuPrivateKeyAqui...
```

## Paso 3: Obtener testnet tokens (AVAX y USDC en Fuji)

### AVAX (gas token)
1. Ve a https://faucet.avax.network/
2. Selecciona Fuji (C-Chain)
3. Pega tu address
4. Espera 30 segundos

### USDC en Fuji
Hay dos opciones:

**Opción A: Usar USDC oficial de Fuji**
- Address: `0x5425890298aed601595a70ab815c96711a756142` (verificar)
- Faucet: https://faucet.avax.network/

**Opción B: Usar MockERC20**
- Deployar nosotros un token ficticio en testing
- Mejor para testing local con Foundry

## Paso 4: Verificar configuración

```bash
# Test que tu private key es válido
cast wallet address --private-key YOUR_PRIVATE_KEY

# Debería mostrarte tu address (ej: 0x...)
```

## Paso 5: Configurar oracle Chainlink-compatible

El deploy script ahora puede dejar el oracle on-chain funcionando si pasás token colateral + feed Chainlink.

### Variables requeridas para oracle real

```bash
CHAINLINK_MAX_STALENESS_SECONDS=86400
COLLATERAL_TOKEN_ADDRESS=0x...      # token que se guarda como loan.collateralToken
COLLATERAL_USD_FEED_ADDRESS=0x...   # feed Chainlink AggregatorV3 token/USD en Fuji
```

Reglas:

- `COLLATERAL_TOKEN_ADDRESS` debe ser exactamente el token que usan los loans como colateral.
- `COLLATERAL_USD_FEED_ADDRESS` debe ser un feed oficial/verificado de Chainlink en Avalanche Fuji.
- No hardcodeamos feeds en contrato para evitar direcciones stale o de red equivocada.
- Si esas variables quedan en cero, el script deploya `ChainlinkPriceOracle` pero no lo conecta a `LiquidationEngine`; el engine queda en modo fallback/manual para demo.

### Qué hace el deploy script

Si ambas addresses están seteadas:

```solidity
priceOracle.setFeed(COLLATERAL_TOKEN_ADDRESS, COLLATERAL_USD_FEED_ADDRESS);
liquidationEngine.setPriceOracle(address(priceOracle));
```

Desde ese momento `LiquidationEngine` ignora precios manuales del caller y usa `ChainlinkPriceOracle.getPrice(loan.collateralToken)`.

### Verificación post-deploy

1. Guardá la address logueada de `ChainlinkPriceOracle`.
2. Confirmá que `LiquidationEngine` loguea una oracle address no-cero.
3. Para cada colateral adicional, configurar feed post-deploy con una tx admin:

```bash
cast send <CHAINLINK_PRICE_ORACLE> \
  "setFeed(address,address)" \
  <COLLATERAL_TOKEN_ADDRESS> \
  <COLLATERAL_USD_FEED_ADDRESS> \
  --rpc-url fuji \
  --private-key <DEPLOYER_PRIVATE_KEY>
```

No pegues private keys en docs, PRs, issues ni logs compartidos.

## Paso 6: Deploying

```bash
forge script script/Deploy.s.sol --rpc-url fuji --broadcast --verify
```

---

## Checklist rápido

- [ ] Core Wallet creada en https://core.app/
- [ ] Private key exportado
- [ ] `.env` creado con DEPLOYER_PRIVATE_KEY
- [ ] AVAX en Fuji testnet (mín 0.5 AVAX)
- [ ] `.env` NO está en git (verificar .gitignore)
- [ ] `COLLATERAL_TOKEN_ADDRESS` definido para el token real usado en loans
- [ ] `COLLATERAL_USD_FEED_ADDRESS` verificado contra docs oficiales Chainlink/Fuji
- [ ] `CHAINLINK_MAX_STALENESS_SECONDS` definido según tolerancia demo
- [ ] Deploy log muestra `ChainlinkPriceOracle` y, si hubo feed, `Configured Chainlink USD feed`
