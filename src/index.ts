import { buildFastifyApp } from './app.js';
import { loadRuntimeConfig, parseRuntimeMode } from './config/runtime.js';

const runtime = loadRuntimeConfig({ mode: parseRuntimeMode(process.env.BOVEDA_RUNTIME_MODE) });
const app = buildFastifyApp({ runtime });
const port = Number(process.env.PORT ?? 3000);
const host = process.env.HOST ?? '0.0.0.0';

try {
  await app.listen({ port, host });
} catch (error) {
  app.log.error(error);
  process.exit(1);
}
