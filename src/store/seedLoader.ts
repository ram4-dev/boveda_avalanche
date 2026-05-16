import { readFileSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import type { SeedFile } from '../domain/types.js';

const DEFAULT_SEED_PATH = path.join(process.cwd(), 'data/demo/loans.seed.json');

export async function loadSeedFile(seedPath = DEFAULT_SEED_PATH): Promise<SeedFile> {
  const raw = await readFile(seedPath, 'utf8');
  return JSON.parse(raw) as SeedFile;
}

export function loadSeedFileSync(seedPath = DEFAULT_SEED_PATH): SeedFile {
  // Synchronous startup keeps Fastify route registration deterministic for tests and local demo.
  return JSON.parse(readFileSync(seedPath, 'utf8')) as SeedFile;
}
