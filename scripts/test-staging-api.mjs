import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import process from 'node:process';
import console from 'node:console';
import { setTimeout as delay } from 'node:timers/promises';
import { createHmac } from 'node:crypto';
const { fetch } = globalThis;

// Read-only HTTP validation against a locally spawned build, with no real DB/provider.
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const caDir = mkdtempSync(join(tmpdir(), 'swiftmc-api-ca-'));
const caPath = join(caDir, 'origin-ca.pem');
writeFileSync(caPath, '-----BEGIN CERTIFICATE-----\nTEST\n-----END CERTIFICATE-----\n');
const origin = 'http://127.0.0.1:3197';
const secret = 'local-api-validation-only-'.repeat(3);
const child = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'start', '--hostname', '127.0.0.1', '--port', '3197'], {
  stdio: ['ignore', 'ignore', 'ignore'],
  env: { ...process.env, APP_ENV: 'staging', BACKEND_RUNTIME: 'node', APP_URL: 'https://stage.example.test',
    DATABASE_URL: 'postgresql://test:test@db-staging.swiftmc.com.br:9/swiftmc_staging?sslmode=verify-full&hostaddr=127.0.0.1', DIRECT_DATABASE_URL: '',
    DATABASE_SSL_CA_PATH: caPath, DATABASE_SSL_SERVERNAME: 'db-staging.swiftmc.com.br',
    PURCHASES_ENABLED: 'false', STRIPE_TEST_PURCHASES_ENABLED: 'true', STRIPE_SECRET_KEY: 'sk_test_local_validation',
    STRIPE_WEBHOOK_SECRET: 'whsec_local_validation', BACKEND_PROXY_SECRET: secret,
    MINECRAFT_BRIDGE_SERVER_ID: 'swift-staging', MINECRAFT_BRIDGE_ALLOWED_SERVER_IDS: 'swift-staging',
    MINECRAFT_BRIDGE_SECRET: '', MERCADOPAGO_ACCESS_TOKEN: '', MINECRAFT_FULFILLMENT_URL: '', RESEND_API_KEY: '' },
});
try {
  let ready = false;
  for (let i = 0; i < 120; i++) {
    if (child.exitCode !== null) throw new Error('API server exited');
    try { ready = (await fetch(origin + '/api/health/live')).ok; } catch { /* booting */ }
    if (ready) break;
    await delay(500);
  }
  assert.ok(ready, 'API server startup');
  const headers = { 'x-swift-backend-key': secret };
  const checks = [
    ['/api/session', {}, 403],
    ['/api/session', { headers }, 401],
    ['/api/health/ready', {}, 503],
    ['/api/login', { method: 'POST', headers, body: '{}' }, 403],
    // Authentication rate limiting fails closed when PostgreSQL is unavailable.
    ['/api/checkout/stripe', { method: 'POST', headers, body: '{}' }, 429],
    ['/api/webhooks/stripe', { method: 'POST', headers, body: '{}' }, 401],
    ['/v1/bridge/pending', { headers }, 401],
    ['/account', { headers, redirect: 'manual' }, 307],
  ];
  for (const [path, init, status] of checks) {
    const response = await fetch(origin + path, init);
    assert.equal(response.status, status, `${path}: expected ${status}, got ${response.status}`);
    console.log(`PASS ${init.method ?? 'GET'} ${path}: ${status}`);
  }
  const login = await fetch(origin + '/login', { headers });
  assert.equal(login.status, 200);
  const cookies = login.headers.getSetCookie().join(';');
  assert.match(cookies, /__Host-swiftmc_csrf=/);
  assert.match(cookies, /Secure/i);
  console.log('PASS login page and secure CSRF cookie');
  const payload = JSON.stringify({ id: 'evt_live_rejected', type: 'checkout.session.completed', livemode: true, data: { object: {} } });
  const timestamp = Math.floor(Date.now() / 1000);
  const signature = createHmac('sha256', 'whsec_local_validation').update(`${timestamp}.${payload}`).digest('hex');
  const liveEvent = await fetch(origin + '/api/webhooks/stripe', { method: 'POST', headers: { ...headers, 'stripe-signature': `t=${timestamp},v1=${signature}` }, body: payload });
  assert.equal(liveEvent.status, 400);
  assert.equal((await liveEvent.json()).error, 'TEST_EVENTS_ONLY');
  console.log('PASS correctly signed live Stripe event rejected');
} finally {
  child.kill('SIGTERM');
  await Promise.race([new Promise(resolve => child.once('exit', resolve)), delay(5000)]);
  if (child.exitCode === null) child.kill('SIGKILL');
}
