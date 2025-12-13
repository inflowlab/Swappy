import type { TokenRegistryEntry } from '../models/token.js';
import { loadTokensFromDisk } from './loadTokensFromDisk.js';

const cache = new Map<string, readonly TokenRegistryEntry[]>();

function deepFreezeTokens(tokens: TokenRegistryEntry[]): readonly TokenRegistryEntry[] {
  for (const t of tokens) Object.freeze(t);
  return Object.freeze(tokens.slice());
}

export async function getTokenRegistry(
  network: string
): Promise<readonly TokenRegistryEntry[]> {
  const key = network.trim().toLowerCase();
  const cached = cache.get(key);
  if (cached) return cached;

  const loaded = await loadTokensFromDisk(key);
  const frozen = deepFreezeTokens(loaded);
  cache.set(key, frozen);
  return frozen;
}


