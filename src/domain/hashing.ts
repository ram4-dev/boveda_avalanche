import { createHash } from 'node:crypto';
import { canonicalJson } from './canonicalJson.js';

export function sha256Hex(input: string): `0x${string}` {
  return `0x${createHash('sha256').update(input).digest('hex')}`;
}

export function sha256Canonical(value: unknown): `0x${string}` {
  return sha256Hex(canonicalJson(value));
}

export function shortHash(value: unknown, length = 12): string {
  return sha256Canonical(value).slice(2, 2 + length);
}
