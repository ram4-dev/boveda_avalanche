// Dev runner that boots the API in Avalanche Fuji mode.
// Loads .env so signer secrets are visible to src/adapters/web3.ts, sets the
// runtime-mode env name, then defers to src/index.ts. Values are never logged.
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

loadDotEnv(resolve(process.cwd(), '.env'));
process.env.BOVEDA_RUNTIME_MODE = 'fuji';
await import('../src/index.ts');

function loadDotEnv(path) {
  if (!existsSync(path)) return;
  const lines = readFileSync(path, 'utf8').split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const separator = trimmed.indexOf('=');
    if (separator === -1) continue;
    const key = trimmed.slice(0, separator).trim();
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key) || process.env[key]) continue;
    let value = trimmed.slice(separator + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    process.env[key] = value;
  }
}
