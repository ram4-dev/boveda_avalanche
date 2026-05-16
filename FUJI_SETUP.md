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

## Paso 5: Deploying (después)

Una vez tengamos B1.1 listo:

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
