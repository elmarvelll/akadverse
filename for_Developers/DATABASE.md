# Databases

## The big rule

```text
LOCAL DATABASE       Docker on your machine (localhost:5433)
                     ✅ yours: reset it, wipe it, reseed it as often as you like
        ≠
STAGING DATABASE     shared test environment
                     ❌ never reset, push to, or seed from your machine
        ≠
PRODUCTION DATABASE  real users and real data
                     ❌ never connect to it from local tooling
```

Every `npm run db:local:*` command refuses to run unless **all four** database URLs in `.env` point at `localhost`,
and refuses outright if `NODE_ENV=production` (see [`scripts/local-guard.mjs`](scripts/local-guard.mjs)). The
guard only protects those commands, though. Plain `npx prisma …` commands will run against whatever URL your
`.env` contains. So keep production URLs out of your `.env`, full stop.

## Two databases, two Prisma clients

AkadVerse uses **two separate PostgreSQL databases**, each with its own Prisma schema and generated client:

| | Core / Marketplace | E-Learning |
|---|---|---|
| Holds | users and login, Marketplace (businesses, products, orders, delivery, notifications…) | academic data: colleges, departments, programmes, sessions, course structures, offerings, registrations, results, CCMAS reference data |
| Schema | [`prisma/schema.prisma`](../prisma/schema.prisma) | [`prisma/elearning/schema.prisma`](../prisma/elearning/schema.prisma) |
| Env vars | `DATABASE_URL`, `DIRECT_URL` | `ELEARNING_DATABASE_URL`, `ELEARNING_DIRECT_URL` |
| Local DB name | `akadverse` | `akadverse_elearning` |
| Client import | `@prisma/client` via `src/lib/prisma.ts` | `@/generated/prisma-elearning` via `src/lib/db/elearning.ts` |
| Schema changes are deployed with | **migrations** in `prisma/migrations/` | **`prisma db push`** + `prisma/elearning/constraints.sql` (no migrations folder) |

There are no foreign keys between the two. E-Learning rows store the Core `User.id` as a plain `userId`
(see [`docs/elearning/architecture.md`](../docs/elearning/architecture.md)).

Both clients are generated automatically by `npm install` (the `postinstall` script). After changing a schema,
regenerate with `npx prisma generate` (Core) or `npm run db:elearning:generate` (E-Learning).

## How it runs locally

- **Docker:** [`docker-compose.yml`](docker-compose.yml) runs one `postgres:16` container, bound to
  `127.0.0.1:5433` (so it never clashes with a Postgres you already have on 5432). On its first start,
  [`docker/init-databases.sql`](docker/init-databases.sql) creates the second database. Data lives in the Docker
  volume `akadverse-local_akadverse-local-pg`, so it survives restarts.
- **Supabase:** not used for the database locally. (Production's Postgres is hosted on Supabase, which is why
  `DIRECT_URL` exists: it bypasses Supabase's connection pooler for migrations.) Supabase **Storage** is used for
  course-material files. See [ENVIRONMENT.md](ENVIRONMENT.md#supabase-storage-e-learning-course-materials).
- **The repository-root `docker-compose.yml`** (Postgres on 5432 + Valkey + Redpanda) belongs to the wider
  monorepo scaffold. The Next.js app doesn't use Valkey or Redpanda, and that compose file creates only one
  database. For running this app, use `for_Developers/docker-compose.yml`.

## Commands

| Command | What it does | Safe locally? |
|---------|--------------|---------------|
| `npm run db:local:up` | Start the container (waits until healthy) | ✅ |
| `npm run db:local:down` | Stop the container. **Data is kept** | ✅ |
| `npm run db:local:setup` | Core: `prisma migrate deploy`. E-Learning: `prisma db push` + `constraints.sql` | ✅ |
| `npm run db:local:seed` | Load reference + development data ([seed/README.md](seed/README.md)) | ✅ idempotent |
| `npm run db:local:reset` | **Deletes all data** in both local DBs, recreates the schema. Then run `db:local:seed` | ✅ local only |
| `docker compose -f for_Developers/docker-compose.yml down -v` | Delete the container **and its volume**: the most complete wipe. Follow with `npm run setup:local` | ✅ local only |
| `npx prisma studio` / `npm run db:elearning:studio` | Browse/edit the Core / E-Learning database in your browser | ✅ |

### Where migrations live and how they're applied

- Core migrations: `prisma/migrations/<timestamp>_<name>/migration.sql`. `npm run db:local:setup` applies any you
  don't have yet (`prisma migrate deploy`). It never creates new ones.
- Changing the **Core** schema: edit `prisma/schema.prisma`, then `npx prisma migrate dev --name <what-changed>`
  against your local database. Commit the generated migration folder along with the schema change.
- Changing the **E-Learning** schema: edit `prisma/elearning/schema.prisma`, then `npm run db:elearning:push` (and
  add any CHECK/partial-index constraints to `prisma/elearning/constraints.sql`).
- `prisma/migrations.mysql.bak/` is a historical backup from before the move to Postgres. It is not applied.

### How seed data is loaded

`npm run db:local:seed` runs, in order:

1. `npm run db:ccmas:import`: NUC/CCMAS course reference data, from the committed
   `src/lib/resources/ccmas/Engineering-CCMAS.json`.
2. `npm run db:elearning:seed`: the project's existing seed (colleges, departments, programmes, current session and semesters).
3. The development seed in [`seed/`](seed/): test accounts, E-Learning workflow data, Marketplace data.

The three default School Vendor delivery timeframes (5–6, 6–7, 7–8 PM) are not seeded. They come from a Core
**migration** (`20260903185500_seed_vendor_delivery_slots`), so every database has them.

## ⛔ Never run these against staging or production

| Command | Why |
|---------|-----|
| `npm run db:local:reset`, `prisma migrate reset` | Deletes **every row** |
| `prisma db push --force-reset`, `npm run db:elearning:push` with a non-local URL | Can drop tables/columns and their data |
| `prisma migrate dev` | Can reset the database when it detects drift |
| `npm run db:local:seed`, `npm run db:elearning:seed`, `npm run db:ccmas:import` | Writes fake users/businesses/orders into real data |
| `scripts/cleanup-*.ts` | Deletes accounts/data |

Production schema changes are the project owner's job, through the deployment process. If you ever find a
non-`localhost` URL in your `.env`, stop and replace it with the local values from `.env.example`.
