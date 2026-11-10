import './staging-preflight.mjs';
import process from 'node:process';
import console from 'node:console';
import { spawnSync } from 'node:child_process';
import pg from 'pg';
import { assertStagingDatabase, stagingDatabaseTls } from './staging-config.ts';
const connectionString = assertStagingDatabase(process.env.DIRECT_DATABASE_URL);
const tls = stagingDatabaseTls(process.env);
const client = new pg.Client({
  connectionString,
  connectionTimeoutMillis: 5000,
  ssl: { ...tls, rejectUnauthorized: true },
});
const env = { ...process.env, DATABASE_URL: connectionString, DIRECT_DATABASE_URL: connectionString };
if (process.env.DATABASE_SSL_CA_PATH) env.PGSSLROOTCERT = process.env.DATABASE_SSL_CA_PATH;
env.PGSSLMODE = 'verify-full';
try {
  await client.connect();
  const { rows } = await client.query('SELECT current_database() AS name');
  if (rows[0]?.name !== 'swiftmc_staging') throw new Error();
  const result = spawnSync('node', ['node_modules/prisma/build/index.js', 'migrate', 'deploy'], {
    stdio: 'inherit',
    env,
  });
  if (result.status !== 0) throw new Error();
  console.log('Staging migrations applied.');
} catch { console.error('Staging migration failed; inspect database/migration status using private tooling.'); process.exitCode = 1; }
finally { await client.end().catch(() => {}); }
