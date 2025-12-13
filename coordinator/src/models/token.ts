export type TokenRegistryEntry = {
  // Canonical coin type (e.g. 0x2::sui::SUI)
  id: string;
  symbol: string;
  decimals: number;
  // Display-only, indicative pricing (string for safe formatting)
  indicativePriceUsd?: string;
};


