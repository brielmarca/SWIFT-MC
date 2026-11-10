import './staging-preflight.mjs';
import process from 'node:process';
import console from 'node:console';
import { spawnSync } from 'node:child_process';
import pg from 'pg';
import { assertStagingDatabase } from './staging-config.ts';
const client = new pg.Client({ connectionString: assertStagingDatabase(process.env.DIRECT_DATABASE_URL), connectionTimeoutMillis: 5000 });
try {
  await client.connect();
  const { rows } = await client.query('SELECT current_database() AS name');
  if (rows[0]?.name !== 'swiftmc_staging') throw new Error();
  const result = spawnSync('node', ['node_modules/prisma/build/index.js', 'migrate', 'deploy'], { encoding: 'utf8' });
  if (result.status !== 0) throw new Error();
  console.log('Staging migrations applied.');
} catch { console.error('Staging migration failed; inspect database/migration status using private tooling.'); process.exitCode = 1; }
finally { await client.end(); }
