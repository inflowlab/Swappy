import { readFile } from 'node:fs/promises';

import type { TokenRegistryEntry } from '../models/token.js';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function assertValidTokenEntry(value: unknown): asserts value is TokenRegistryEntry {
  if (!isRecord(value)) throw new Error('Invalid token entry: expected object.');
  if (typeof value.id !== 'string' || value.id.trim() === '') {
    throw new Error('Invalid token entry: id must be a non-empty string.');
  }
  if (typeof value.symbol !== 'string' || value.symbol.trim() === '') {
    throw new Error('Invalid token entry: symbol must be a non-empty string.');
  }
  if (typeof value.decimals !== 'number' || !Number.isInteger(value.decimals) || value.decimals < 0) {
    throw new Error('Invalid token entry: decimals must be a non-negative integer.');
  }
  if (value.indicativePriceUsd !== undefined && typeof value.indicativePriceUsd !== 'string') {
    throw new Error('Invalid token entry: indicativePriceUsd must be a string if present.');
  }
}

function resolveTokensConfigUrl(network: string): URL {
  // Keep explicit, deterministic paths: config/tokens.<network>.json
  return new URL(`../../config/tokens.${network}.json`, import.meta.url);
}

export async function loadTokensFromDisk(network: string): Promise<TokenRegistryEntry[]> {
  const configUrl = resolveTokensConfigUrl(network);
  const raw = await readFile(configUrl, 'utf-8');
  const parsed = JSON.parse(raw) as unknown;

  if (!Array.isArray(parsed)) {
    throw new Error('Invalid token registry file: expected a JSON array.');
  }

  for (const entry of parsed) {
    assertValidTokenEntry(entry);
  }

  return parsed as TokenRegistryEntry[];
}


