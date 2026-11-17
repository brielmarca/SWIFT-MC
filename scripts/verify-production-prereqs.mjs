#!/usr/bin/env node
/* global console, process */
import { accessSync, constants, readFileSync, statSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

function fail(message) {
  console.error(`FAIL: ${message}`);
  process.exitCode = 1;
}
function ok(message) { console.log(`OK: ${message}`); }

try {
  const env = readFileSync('deploy/production.env', 'utf8');
  ok('deploy/production.env exists (private; contents not printed)');
  if (!/^APP_ENV=production$/m.test(env)) fail('APP_ENV must be production');
  if (!/^BACKEND_RUNTIME=node$/m.test(env)) fail('BACKEND_RUNTIME must be node');
  if (!/^APP_URL=https:\/\/swiftmc\.com\.br$/m.test(env)) fail('APP_URL must be https://swiftmc.com.br');
  if (!/^PURCHASES_ENABLED=false$/m.test(env)) fail('PURCHASES_ENABLED must be false until approved rollout');
  if (!/^STRIPE_TEST_PURCHASES_ENABLED=false$/m.test(env)) fail('STRIPE_TEST_PURCHASES_ENABLED must be false');
  if (/^STRIPE_SECRET_KEY=(sk|rk)_live_/m.test(env)) ok('STRIPE_SECRET_KEY has live prefix (not validated)');
  else fail('STRIPE_SECRET_KEY missing or not live');
  if (/^STRIPE_WEBHOOK_SECRET=whsec_/m.test(env)) ok('STRIPE_WEBHOOK_SECRET present (not validated)');
  else fail('STRIPE_WEBHOOK_SECRET missing');
  if (/^DATABASE_URL=postgresql:\/\/swiftmc_production:.*@127\.0\.0\.1:5432\/swiftmc_production\?schema=public&sslmode=verify-full$/m.test(env)) ok('DATABASE_URL targets isolated loopback swiftmc_production with verify-full');
  else fail('DATABASE_URL must target isolated loopback swiftmc_production with verify-full');
  if (/^DIRECT_DATABASE_URL=/m.test(env)) fail('DIRECT_DATABASE_URL must not be set in production runtime env');
  if (/^DATABASE_SSL_SERVERNAME=db\.swiftmc\.com\.br$/m.test(env)) ok('DATABASE_SSL_SERVERNAME matches production certificate host');
  else fail('DATABASE_SSL_SERVERNAME must be db.swiftmc.com.br');
  if (/^MINECRAFT_BRIDGE_SERVER_ID=swift-production$/m.test(env)) ok('Bridge server id isolated');
  else fail('MINECRAFT_BRIDGE_SERVER_ID must be swift-production');
  if (/^MINECRAFT_FULFILLMENT_URL=/m.test(env) && !/^MINECRAFT_FULFILLMENT_URL=$/m.test(env)) fail('Legacy MINECRAFT_FULFILLMENT_URL must be unset');
} catch {
  fail('deploy/production.env is missing or unreadable');
}

try {
  accessSync('/etc/swiftmc-production/db-ca.pem', constants.R_OK);
  const mode = statSync('/etc/swiftmc-production/db-ca.pem').mode & 0o777;
  ok(`/etc/swiftmc-production/db-ca.pem readable (mode ${mode.toString(8)})`);
} catch {
  fail('/etc/swiftmc-production/db-ca.pem missing or unreadable (install verified root CA on VPS)');
}

const config = spawnSync('docker', ['compose', '-f', 'compose.production.yaml', 'config', '--quiet'], { encoding: 'utf8' });
if (config.status === 0) ok('docker compose production config is valid');
else fail('docker compose production config invalid or docker unavailable');

if (process.exitCode) {
  console.error('Prerequisites not satisfied; do not deploy or enable payments.');
  process.exit(1);
}
console.log('Local/static prerequisites checks passed. DB schema/grants, proxy routing, Stripe endpoint and Bridge still require operator validation.');
