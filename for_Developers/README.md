# Developer Setup

Welcome to AkadVerse. Everything you need to run the app on your own computer is in this folder. **Start here.**

## Quick start

You need **Git**, **Node.js 22+** and **Docker Desktop** (running). Then, from a terminal:

```bash
git clone <repository-url> akadverse
cd akadverse
npm install
cp for_Developers/.env.example .env
# Open .env and set NEXTAUTH_SECRET (generate one with: openssl rand -base64 32)
npm run setup:local
npm run dev
```

Open <http://localhost:3000> and sign in as `student.demo@example.local` / `Student123!`.

That's all. No accounts or API keys are needed for this. Payments, image uploads, emails and course-material files need
optional test credentials (see [ENVIRONMENT.md](ENVIRONMENT.md)).

## The guides, in order

| # | File | What it's for |
|---|------|---------------|
| 1 | [SETUP.md](SETUP.md) | The same setup, step by step, with what each command does |
| 2 | [ENVIRONMENT.md](ENVIRONMENT.md) | Every environment variable: required or not, where to get it, and LOCAL vs PRODUCTION |
| 3 | [DATABASE.md](DATABASE.md) | The two databases, Docker, Prisma, migrations, seeding, resetting, and what never to run against production |
| 4 | [seed/README.md](seed/README.md) | What the development seed creates and how it works |
| 5 | [TEST_CREDENTIALS.md](TEST_CREDENTIALS.md) | **Which account to log in with to test each part of the app** |
| 6 | [TROUBLESHOOTING.md](TROUBLESHOOTING.md) | Fixes for common problems |

## Everyday commands

| Command | What it does |
|---------|--------------|
| `npm run dev` | Start the app at <http://localhost:3000> |
| `npm run setup:local` | Start the local database, create the schema, and seed it (first-time setup) |
| `npm run db:local:up` / `db:local:down` | Start / stop the local Postgres container (your data is kept) |
| `npm run db:local:setup` | Apply database migrations/schema (run after pulling new migrations) |
| `npm run db:local:seed` | Add or restore the development data and test accounts (safe to re-run) |
| `npm run db:local:reset` | **Wipe** your local databases and recreate the schema, then run `db:local:seed` |

Every `db:local:*` command checks that your database URLs point at `localhost`. They refuse to run against any
other server.

## Local ≠ staging ≠ production

```text
LOCAL DATABASE   (Docker on your machine: yours to break, reset and reseed)
      ≠
STAGING DATABASE (shared; never reset or seed it)
      ≠
PRODUCTION       (real users; never touch it from your machine)
```

Use **development/test** credentials only. Never copy production values into your `.env`, and never commit `.env`.

## What's in this folder

```text
for_Developers/
├── README.md              ← you are here
├── SETUP.md               step-by-step setup
├── ENVIRONMENT.md         every environment variable explained
├── DATABASE.md            databases, migrations, seeding, safety rules
├── TEST_CREDENTIALS.md    development logins, by role and by business
├── TROUBLESHOOTING.md     common problems and fixes
├── .env.example           the template you copy to .env
├── docker-compose.yml     the local Postgres container (both databases)
├── docker/                init script that creates the second database
├── scripts/               local-only database setup/reset + safety guard
└── seed/                  the development seed (accounts, E-Learning, Marketplace)
```

For how the app itself is built, see the system docs in [`docs/`](../docs): [`docs/elearning/`](../docs/elearning/README.md),
[`docs/marketplace/`](../docs/marketplace/README.md) and [`docs/admin/`](../docs/admin/README.md).
