function pow10BigInt(n: number): bigint {
  let v = 1n;
  for (let i = 0; i < n; i++) v *= 10n;
  return v;
}

export function parseDecimalToBigInt(value: string, decimals: number): bigint {
  const trimmed = value.trim();
  if (!/^\d+(\.\d+)?$/.test(trimmed)) {
    throw new Error('Invalid decimal string.');
  }
  const [wholeStr, fracStrRaw] = trimmed.split('.');
  const fracStr = fracStrRaw ?? '';
  if (fracStr.length > decimals) {
    throw new Error('Too many fractional digits.');
  }
  const base = pow10BigInt(decimals);
  const whole = BigInt(wholeStr) * base;
  const fracPadded = (fracStr + '0'.repeat(decimals)).slice(0, decimals);
  const frac = decimals === 0 ? 0n : BigInt(fracPadded);
  return whole + frac;
}

export function formatBigIntToDecimal(value: bigint, decimals: number): string {
  const base = pow10BigInt(decimals);
  const whole = value / base;
  const frac = value % base;
  if (decimals === 0 || frac === 0n) return whole.toString();

  const fracStr = frac.toString().padStart(decimals, '0').replace(/0+$/, '');
  return fracStr.length === 0 ? whole.toString() : `${whole.toString()}.${fracStr}`;
}

export function parseUsdPriceToMicros(priceUsd: string): bigint {
  // Price is a decimal string, scaled to 1e6 micros for integer math.
  return parseDecimalToBigInt(priceUsd, 6);
}


