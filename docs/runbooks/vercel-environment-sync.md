# Runbook: synchronize local environment variables to Vercel

Vercel itself holds the environment variables for the deployed AkadVerse app. This script copies variables from a **local env file on
your laptop** into a Vercel environment using the Vercel CLI, so you don't have to type them into the dashboard one by one. Nothing in the
application reads `.env.*` files at runtime, and no secret ever passes through Git.

```text
your Mac (.env.local)  ->  npm run sync:vercel-env  ->  Vercel CLI  ->  Vercel environment  ->  next deployment  ->  AkadVerse
```

## First-time setup

```bash
npm install -g vercel     # once, if `vercel --version` says "not found"
vercel login              # once per machine
vercel link               # once per checkout — choose the AkadVerse project yourself
```

The script refuses to run (and changes nothing) if the CLI is missing, you are logged out, or the folder is not linked. It never links a
project for you, so it cannot modify the wrong one.

## Sync Production

```bash
npm run sync:vercel-env
```

It reads `.env.local`, compares it with what is on Vercel Production, shows the plan, and asks for confirmation:

```text
Environment: production
Variables to add:      ✓ SOME_NEW_VARIABLE
Variables to update:   ↻ SOME_EXISTING_VARIABLE
Variables on Vercel but not in .env.local (preserved, never deleted): 4

About to synchronize 27 variables to Vercel Production.
7 will be added.  20 will be updated.  4 existing Vercel variables will be preserved.
Continue? [y/N]
```

## Preview and Development

```bash
./scripts/sync-vercel-env.sh preview
./scripts/sync-vercel-env.sh development
```

## Options

| Option | Effect |
|---|---|
| `npm run sync:vercel-env -- --dry-run` (or `DRY_RUN=1`) | Print the plan (names only) and change nothing. |
| `FORCE=1 ./scripts/sync-vercel-env.sh production` | Skip the confirmation prompt (automation). |
| `ENV_FILE=.env ./scripts/sync-vercel-env.sh` | Read a different local file (default `.env.local`). |
| `EXCLUDE=NAME1,NAME2 ...` | Never touch these variables. |
| `ALLOW_LOCALHOST=1 ...` | Allow values that point at `localhost` (refused by default for Production/Preview). |

## Which file is used?

The default is `.env.local`. In this repository the real variables currently live in **`.env`**, and `.env.local` only contains a
`VERCEL_OIDC_TOKEN` written by the Vercel CLI (which is never synced). Running the default therefore says *"Nothing to synchronize"* and
tells you to use `ENV_FILE=.env`. Either sync `.env` explicitly, or move the variables into `.env.local` if that is your convention.

## What it does — and does not do

- **Added:** variables in the local file that are not on Vercel.
- **Updated:** variables in the local file that already exist on Vercel are overwritten in place (`vercel env update`). Vercel cannot
  return sensitive values, so an unchanged value can't be detected: every variable present on both sides is re-written.
- **Preserved:** variables on Vercel that are not in the local file are **never deleted**.
- **Never synced:** reserved names (`VERCEL_*`, `NODE_ENV`, `CI`, `PORT`, `HOME`, `PATH`, `TURBO_*`, `NX_*`), empty values, and (for
  Production/Preview) values that point at localhost. They are listed in the plan so nothing is skipped silently.
- **Types:** everything is stored as *Sensitive* on Production/Preview, except `NEXT_PUBLIC_*` (public by design — they are inlined into the
  browser bundle). Development cannot use Sensitive variables.
- **Stops on the first failure** and reports what was applied and what was not; it is safe to run again.
- Warns (does not block) when a value looks like a Supabase **session-mode** pooler URL (port 5432): fine for migrations, but a runtime
  database URL on Vercel should use the transaction pooler (port 6543, `?pgbouncer=true&connection_limit=…`).

## Security

- `.env.local` stays on your machine. It is git-ignored (`.gitignore`), and the script **stops** if the file is tracked by Git or not
  ignored.
- The file is parsed with Node's built-in dotenv parser (`util.parseEnv`). It is never `source`d or executed, so unusual characters in a
  value can't run as shell code.
- Values are handed to the Vercel CLI on **stdin** (never on a command line, so not visible in `ps`) and **never printed or logged**. Only
  variable *names* appear in output; error messages have values redacted.
- The script does not deploy anything and does not touch the database.

## After syncing: redeploy

Environment variable changes apply to **new deployments only**. Existing deployments keep the values they were built with. Deploy again:

```bash
vercel --prod
```

or push the relevant branch/commit — this project also deploys from Git according to the Vercel project's settings.

## Files

`scripts/sync-vercel-env.sh` (safety checks, entry point) · `scripts/sync-vercel-env.mjs` (parse, plan, confirm, push) ·
`package.json` script `sync:vercel-env`.
