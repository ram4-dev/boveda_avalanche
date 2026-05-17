import type { IncomingMessage, ServerResponse } from 'node:http';
import { buildFastifyApp } from '../src/app.js';
import { loadRuntimeConfig, parseRuntimeMode } from '../src/config/runtime.js';

process.env.BOVEDA_RUNTIME_MODE ??= 'fuji';

const runtime = loadRuntimeConfig({ mode: parseRuntimeMode(process.env.BOVEDA_RUNTIME_MODE) });
const app = buildFastifyApp({ runtime });
const ready = app.ready();

export default async function handler(request: IncomingMessage, response: ServerResponse) {
  await ready;
  app.server.emit('request', request, response);
}
