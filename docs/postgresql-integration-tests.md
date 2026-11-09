# Run isolated PostgreSQL integration tests

Use this guide to run the existing database integration suite locally, including
Stripe webhooks and registration/email verification. Run commands as a regular
user, with the project's npm dependencies installed.

## PostgreSQL binaries

`npm run test:db` needs `initdb`, `pg_ctl`, and `createdb`. The server executable,
PostgreSQL shared files, and runtime libraries must also be available. Set
`PG_BIN` when the binaries are outside `PATH`.

The validated environment is Ubuntu 25.10 amd64, Node.js 24.21.0, and PostgreSQL
17.10. Neither Docker/Podman nor PostgreSQL was initially installed. The following
rootless setup extracts Ubuntu repository packages without installing a service
or changing system configuration:

```sh
mkdir -p /tmp/opencode/postgresql
(
  cd /tmp/opencode/postgresql
  apt-get download postgresql-17 postgresql-client-17 libpq5
  for package in ./*.deb; do
    dpkg-deb -x "$package" /tmp/opencode/postgresql/root
  done
)
```

The package versions used for validation were `17.10-0ubuntu0.25.10.1` for all
three packages. `apt-get download` selects the repository's current candidate;
package availability and library paths depend on the distribution/architecture.
This extraction relies on the host's other runtime libraries. If a binary reports
a missing shared library, resolve that prerequisite before running the suite.

From the repository root, configure this shell and run:

```sh
export PG_BIN=/tmp/opencode/postgresql/root/usr/lib/postgresql/17/bin
export PG_LIB=/tmp/opencode/postgresql/root/usr/lib/x86_64-linux-gnu
export LD_LIBRARY_PATH="$PG_LIB"

"$PG_BIN/postgres" --version
"$PG_BIN/createdb" --version
npm run test:db
```

Both library settings matter: the runner supplies `PG_LIB` to its child processes
as `LD_LIBRARY_PATH`, while its prerequisite check inherits the shell's
`LD_LIBRARY_PATH`. These exports are local tooling settings, not application
credentials. The extracted binaries live under `/tmp` and may need to be
recreated after reboot or temporary-directory cleanup.

If PostgreSQL is already installed with working runtime libraries, set `PG_BIN`
to its versioned binary directory and use the same `npm run test:db` command.

## Isolation and lifecycle

`scripts/test-db.mjs` in its default local mode:

1. Creates a fresh private `/tmp/swiftmc-pg-test-*` directory and cluster.
2. Starts PostgreSQL with `listen_addresses=''`: no TCP listener. Connections use
   the Unix socket in that private directory. Local trust authentication is
   confined to this disposable cluster.
3. Creates role/database `swiftmc_test` and supplies matching `DATABASE_URL`,
   `DIRECT_DATABASE_URL`, and `TEST_DATABASE_URL` to test subprocesses. Supplied
   shell database URLs are ignored; no application `.env` file is loaded.
4. Applies the real `prisma/schema.prisma` migrations with `prisma migrate deploy`.
5. Runs all tests in `tests/integration`, `tests/payments`, and `tests/fulfillment`
   twice against the same database, serializing suite files to isolate the legacy
   global fulfillment queue processor.
6. Checks every application table is empty after each pass, detecting leaked
   fixtures and repeated-run collisions.
7. Stops the cluster and removes its temporary directory in the cleanup path.

Use this runner instead of invoking database test files directly: their helpers
reject missing or inconsistent isolated-target configuration. The repository's
`compose.yaml` describes a persistent development database and is not used here.
No production/shared database or remote mode is needed for this procedure.

## Verified results

The restoration run applied all **7 migrations** and completed:

| Suite | Pass 1 | Pass 2 |
| --- | ---: | ---: |
| Auth persistence/session/rollback | 7 | 7 |
| Order creation/authentication | 5 | 5 |
| Mercado Pago webhook reconciliation | 14 | 14 |
| Password mutation atomicity | 10 | 10 |
| H2 registration/email verification | 9 | 9 |
| Payment start | 6 | 6 |
| Stripe webhook reconciliation | 18 | 18 |
| **Total passed** | **69** | **69** |
| Failed / skipped / cancelled | 0 / 0 / 0 | 0 / 0 / 0 |

Both passes reported `Cleanup verified: all application tables empty`. The
server stopped and its temporary data directory was removed afterward.

Stripe coverage includes signature/raw-body rejection, persisted events,
duplicate delivery, successful and failed transitions, exact amounts and
currency mismatches, metadata-based refund mapping, and fulfillment creation
without duplication. H2 and password tests exercise real transaction rollback,
concurrent token consumption/mutations, session persistence, and Origin/CSRF
protections.

For the current expanded 88-test/two-pass results and eight migrations, see
`launch-validation.md`; the table above records the earlier restoration run.

These are real PostgreSQL tests with mocked outbound provider/email requests.
They verify database-backed behavior, not live Stripe delivery, production
Workers database connectivity, or Minecraft grant execution. The runner includes
the three database test directories listed above; browser journeys use their own
isolated runner.
