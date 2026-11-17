import './staging-preflight.mjs';
import process from 'node:process';
import console from 'node:console';
import { spawnSync } from 'node:child_process';
import pg from 'pg';
import { stagingDatabaseConnection, stagingDatabaseTls, STAGING_DB_NAME } from './staging-config.ts';

const tls = stagingDatabaseTls(process.env);
const db = stagingDatabaseConnection(process.env.DIRECT_DATABASE_URL);
const client = new pg.Client({
  connectionString: db.runtimeUrl,
  connectionTimeoutMillis: 5000,
  ssl: { ...tls, rejectUnauthorized: true },
});
const env = { ...process.env, DATABASE_URL: db.migrationUrl, DIRECT_DATABASE_URL: db.migrationUrl };
env.PGSSLROOTCERT = process.env.DATABASE_SSL_CA_PATH;
env.PGSSLMODE = 'verify-full';
env.PGHOSTADDR = '127.0.0.1';

try {
  console.log('Staging database preflight: verifying TLS and read-only connectivity...');
  await client.connect();
  const { rows } = await client.query('SELECT current_database() AS name');
  if (rows[0]?.name !== STAGING_DB_NAME) throw new Error('unexpected database');
  await client.query('SELECT 1 AS ok');
  console.log('Staging database preflight passed (verified TLS, read-only connectivity).');
  const result = spawnSync('node', ['node_modules/prisma/build/index.js', 'migrate', 'deploy'], {
    stdio: 'inherit',
    env,
  });
  if (result.status !== 0) throw new Error('migrate deploy failed');
  console.log('Staging migrations applied.');
} catch {
  console.error('Staging migration failed; inspect database/migration status using private tooling.');
  process.exitCode = 1;
} finally {
  await client.end().catch(() => {});
}
