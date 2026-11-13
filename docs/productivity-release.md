# Productivity Layer database and release

The Core database needs `prisma/migrations/20261112000000_productivity_layer/migration.sql` before the integrated workspace can load. It adds seven tables, one enum, indexes, and ownership foreign keys. It does not drop or rewrite existing application tables. Generating Prisma clients does not apply this SQL.

## Local development on this Windows workspace

Docker Desktop could not start. Portable PostgreSQL 17 tools were obtained from the official EDB Windows archive and placed in the Git-ignored `.local-development/tools/pgsql` directory. This is a local alternative to Docker, with no Windows service installation. Only `127.0.0.1:5433` is exposed. Data survives application restarts in `.local-development/postgres-data`.

Run from the repository root:

```powershell
npm.cmd run db:portable:up
npm.cmd run dev
```

Use `http://localhost:3000/login` and **Continue as Test Student**. This is a real NextAuth session backed by a dedicated local Core User. The test login remains unavailable in production. To stop the local database without removing its data:

```powershell
npm.cmd run db:portable:down
```

`.env` and `.env.local` now use the isolated local databases. Other existing environment values are preserved. The original `.env.local` is privately retained at `.local-development/env.local.before-local`. It contains shared credentials: do not commit, upload, or paste it. Local tools, backups, logs, and database files are excluded by `.gitignore`; `.vercelignore` also excludes private local files from CLI deployment uploads.

On another machine, use the established Docker workflow in `docs/development-login.md`, or extract the official PostgreSQL Windows binary archive's `pgsql/bin`, `pgsql/lib`, and `pgsql/share` directories into `.local-development/tools/pgsql`. Do not run Docker and the portable database on port 5433 simultaneously. After creating a fresh cluster, run `npm run db:local:setup` with all four database URLs targeting localhost.

## Shared database release

Before migration, read-only inspection found the previous 17 Core migrations completed, all their checksums matching the repository, and only the Productivity migration pending. None of the seven Productivity tables existed. Runtime and migration URLs pointed at the same host, username, database, and schema.

The release process requires a private Core `public`-schema pg_dump archive (tables, application data, sequences and migration history), an archive integrity check, successful isolated migration/persistence testing, and rechecking that the pending migration set is unchanged. This backup covers the application schema affected by this release; it is not a backup of every Supabase-managed schema, external storage, or external service.

On 13 November 2026, the backup was created, its checksum and archive contents were checked, and it was restored into a separate local scratch database. The Productivity migration passed on that restored schema. It was then successfully applied to the configured shared Core database, and all seven new tables were verified. The private backup and its manifest are in `.local-development/backups` and `.local-development/backup-manifest.json`. No production test users or sample Productivity records were created.

The original shared session URL included runtime pooler parameters. Prisma's first release attempt failed before starting a migration. A subsequent read-only status check and migration succeeded using the same host/user/database on session port 5432, with `sslmode=require` and without `pgbouncer`, `connection_limit`, or `pool_timeout`. These adjustments were limited to the release process's environment; the preserved shared credentials were not overwritten. Future release secrets should use that migration-compatible session/direct URL. The application's pooled runtime URL is separate.

Apply the reviewed Core migration through the controlled release environment using the repository's installed Prisma 6 CLI:

```powershell
npm.cmd exec -- prisma migrate status --schema=prisma/schema.prisma
npm.cmd exec -- prisma migrate deploy --schema=prisma/schema.prisma
```

These commands must receive the intended release `DATABASE_URL` and `DIRECT_URL` from deployment secrets. Do not replace local development values with production credentials. The CLI does not automatically load `.env.local`. Deploy applies all pending migrations; stop if the pending set/history differs from what was reviewed. Do not reset a shared database or guess migration resolution.

Deploy application code to the existing Vercel project after the database migration. Keep `ENABLE_DEV_LOGIN=false` in Production, preserve the normal Google/password credentials, and verify `NEXTAUTH_URL` matches the live site. Preview deployments should use an isolated database. Do not run production migrations automatically from every Preview build.

After deploying, verify normal login, `context`/task/habit/schedule requests, create/reload persistence, isolation between student accounts, and logout protection. Official classes also require the separately configured E-Learning database. A successful Core migration alone does not prove the current live site runs the new code.

## Verification and deployment state

The complete `npm run build` passed, including both Prisma generations. All 29 isolated Productivity tests, 10 development-login tests, and the real local database persistence test passed. A separate HTTP check against the actual local app verified test-student login with its real database ID, protected access, task/habit/event creation, data retained after logout/login, and API/page rejection after logout. Clearly labeled verification records remain in the isolated local test-student account. Root lint passed with seven existing warnings outside this work.

The public live provider list returned password and Google authentication, with no development-login provider. Authenticated live Productivity behavior has not been verified. This workspace currently has no Git remote, Vercel project link, saved Vercel CLI authentication, or confirmed connected Vercel integration. Production application deployment remains pending that access; no Git push or new Vercel deployment was performed.
