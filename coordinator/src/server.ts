import { buildApp } from './app.js';
import { loadEnv } from './config/env.js';
import { loadCoordinatorEnvFiles } from './config/dotenv.js';

async function main(): Promise<void> {
  loadCoordinatorEnvFiles();
  const env = loadEnv();
  const app = buildApp({ env, logger: true });

  try {
    await app.listen({ port: env.port, host: env.host });
  } catch {
    // Fail fast without leaking details to logs (no secrets expected yet).
    process.exitCode = 1;
  }
}

void main();


