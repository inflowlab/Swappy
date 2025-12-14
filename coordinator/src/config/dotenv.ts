import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

type Origin = 'shell' | 'defaults' | 'dotenv' | 'dotenvLocal';

type ApplyOptions = {
  /**
   * Only override keys whose origin matches one of these values.
   * Keys present at process start are treated as "shell" and are never overridden.
   */
  overrideOrigins: ReadonlySet<Origin>;
  /** Origin to assign to keys set by this file. */
  origin: Origin;
};

function parseEnvLine(line: string): { key: string; value: string } | null {
  const trimmed = line.trim();
  if (trimmed === '' || trimmed.startsWith('#')) return null;

  // Support "export KEY=VALUE" lines.
  const withoutExport = trimmed.startsWith('export ')
    ? trimmed.slice('export '.length).trim()
    : trimmed;

  const eq = withoutExport.indexOf('=');
  if (eq <= 0) return null;

  const key = withoutExport.slice(0, eq).trim();
  if (!/^[A-Z0-9_]+$/.test(key)) return null;

  let value = withoutExport.slice(eq + 1).trim();

  // Strip surrounding quotes (simple, intentional; avoids surprising expansions).
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    value = value.slice(1, -1);
  }

  return { key, value };
}

function applyEnvFile(
  filePath: string,
  opts: ApplyOptions,
  origins: Map<string, Origin>
): Set<string> {
  if (!fs.existsSync(filePath)) return new Set();
  const contents = fs.readFileSync(filePath, 'utf8');

  const keysSet = new Set<string>();
  for (const rawLine of contents.split(/\r?\n/)) {
    const parsed = parseEnvLine(rawLine);
    if (!parsed) continue;
    const { key, value } = parsed;

    const existing = process.env[key];
    const existingOrigin = origins.get(key) ?? 'shell';

    // Always set missing keys, otherwise only override keys whose origin is allowed.
    const isMissing = existing === undefined || existing.trim() === '';
    const shouldSet = isMissing || opts.overrideOrigins.has(existingOrigin);
    if (shouldSet) {
      process.env[key] = value;
      origins.set(key, opts.origin);
      keysSet.add(key);
    }
  }

  return keysSet;
}

function findCoordinatorRoot(startDir: string): string {
  // Walk up a few levels to find coordinator/package.json. This makes the loader robust
  // regardless of whether it's executed from src/ (tsx) or dist/ (node).
  let dir = startDir;
  for (let i = 0; i < 6; i++) {
    const pkgPath = path.join(dir, 'package.json');
    if (fs.existsSync(pkgPath)) {
      try {
        const raw = fs.readFileSync(pkgPath, 'utf8');
        const parsed = JSON.parse(raw) as { name?: unknown };
        if (parsed?.name === '@swappy/coordinator') return dir;
      } catch {
        // ignore and continue walking up
      }
    }
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  // Fallback: go up 3 levels (works for both src/config and dist/config layouts).
  return path.resolve(startDir, '..', '..', '..');
}

/**
 * Loads env vars from coordinator-local files into process.env.
 *
 * Precedence (lowest → highest):
 * - `env.local` (tracked defaults for dev/demo)
 * - `.env` (developer local overrides)
 * - `.env.local` (developer local overrides)
 * - Shell / process environment (already present before startup) always wins
 */
export function loadCoordinatorEnvFiles(): void {
  const here = path.dirname(fileURLToPath(import.meta.url)); // e.g. coordinator/src/config OR coordinator/dist/config
  const coordinatorRoot = findCoordinatorRoot(here);

  const defaultsPath = path.join(coordinatorRoot, 'env.local');
  const dotEnvPath = path.join(coordinatorRoot, '.env');
  const dotEnvLocalPath = path.join(coordinatorRoot, '.env.local');

  // Snapshot current env keys as "shell" origins.
  const origins = new Map<string, Origin>();
  for (const k of Object.keys(process.env)) origins.set(k, 'shell');

  // Apply defaults (only fill missing keys).
  applyEnvFile(
    defaultsPath,
    { overrideOrigins: new Set<Origin>(), origin: 'defaults' },
    origins
  );

  // `.env` overrides defaults and fills missing keys (but never overrides shell).
  applyEnvFile(
    dotEnvPath,
    { overrideOrigins: new Set<Origin>(['defaults']), origin: 'dotenv' },
    origins
  );

  // `.env.local` overrides defaults + `.env` and fills missing keys (but never overrides shell).
  applyEnvFile(
    dotEnvLocalPath,
    { overrideOrigins: new Set<Origin>(['defaults', 'dotenv']), origin: 'dotenvLocal' },
    origins
  );

  // Helpful debugging for misconfigured local envs (no secrets printed).
  if ((process.env.NETWORKS_SUPPORTED ?? '').trim() === '') {
    // eslint-disable-next-line no-console
    console.error(
      `[env] NETWORKS_SUPPORTED is missing/empty after env-file load. ` +
        `here=${here} root=${coordinatorRoot} ` +
        `exists(env.local)=${fs.existsSync(defaultsPath)} ` +
        `exists(.env)=${fs.existsSync(dotEnvPath)} ` +
        `exists(.env.local)=${fs.existsSync(dotEnvLocalPath)}`
    );
  }
}


