# Troubleshooting

Run commands from the **repository root**. Most problems are one of the first three below.

## Docker isn't running

**Symptoms:** `Cannot connect to the Docker daemon`, `docker: command not found`, or `npm run db:local:up` fails immediately.

**Fix:** open **Docker Desktop** and wait until it says it's running, then retry `npm run db:local:up`.
Check with `docker info`. If `docker` isn't found at all, install Docker Desktop and open a new terminal.

## "No .env file found" / missing environment variable

**Symptoms:** `✖ No .env file found at the repository root`, `Environment variable not found: DATABASE_URL`,
`X is not set in .env`.

**Fix:** `cp for_Developers/.env.example .env` from the repository root. The file must be named exactly `.env`
(not `.env.local` or `env`), in the same folder as `package.json`. If you copied the template before a new variable
was added, compare your `.env` with `for_Developers/.env.example` and copy the missing lines.

## Database connection error

**Symptoms:** `Can't reach database server at localhost:5433`, `P1001`, `ECONNREFUSED`.

**Fix:**
1. `npm run db:local:up`. Is the container running? `docker ps` should list `akadverse-local-postgres-1`.
2. Check the four database URLs in `.env` match `.env.example` exactly (port **5433**, password `akadverse_local_only`).
3. `P1000 Authentication failed`: your Docker volume was created with a different password. Wipe it (local only):
   `docker compose -f for_Developers/docker-compose.yml down -v`, then `npm run setup:local`.

## The database doesn't start / port already in use

**Symptoms:** `Bind for 127.0.0.1:5433 failed: port is already allocated`, or the container keeps restarting.

**Fix:** something else is using port 5433. Find it with `lsof -i :5433` (macOS/Linux) or
`netstat -ano | findstr 5433` (Windows) and stop it. Or change `5433` in **both** `for_Developers/docker-compose.yml`
and the four URLs in `.env`. For container errors, read `docker compose -f for_Developers/docker-compose.yml logs postgres`.

## Port 3000 already in use

**Symptoms:** `Port 3000 is in use`. Next.js starts on 3001 instead, and login then misbehaves.

**Fix:** stop whatever uses port 3000 (often another `npm run dev`). Or run on another port and keep NextAuth in
sync: set `NEXTAUTH_URL="http://localhost:3001"` in `.env` and run `npm run dev -- -p 3001`.

## Prisma migration failure

**Symptoms:** `npm run db:local:setup` fails, `P3009 migrate found failed migrations`, `P3018`, drift warnings.

**Fix:** your local database is out of step with the migrations (common after switching branches). It's local,
so start clean: `npm run db:local:reset` then `npm run db:local:seed`. If Prisma refuses the reset, or you want the
most thorough wipe: `docker compose -f for_Developers/docker-compose.yml down -v`, then `npm run setup:local`.

**Never** "fix" a migration problem by running commands against staging or production. See [DATABASE.md](DATABASE.md).

> Running these through an AI coding assistant? Prisma deliberately refuses `migrate reset` when it detects an AI
> agent, and asks for your explicit confirmation. Run the command yourself in a terminal, or use the `down -v` wipe above.

## Seed failure

**Symptoms:** `✖ Seed failed: …`.

| Message contains | Cause | Fix |
|------------------|-------|-----|
| `points at "…", which is not this machine` | A database URL in `.env` isn't local | Use the local URLs from `.env.example`. The guard is protecting a real database |
| `The table … does not exist`, `P2021` | Schema not created yet | `npm run db:local:setup`, then seed again |
| `invalid input value for enum "Role"` | Your Core DB is missing a migration | `npm run db:local:setup` (or reset) |
| `CCMAS programme … not found` | CCMAS import didn't run or failed | Look at the Step 1 output. Run `npm run db:ccmas:import` on its own to see the error |
| `Unique constraint failed` | Data you created by hand clashes with seed data | `npm run db:local:reset` then seed |

A line starting with `!` (e.g. "already has a HOD … was not attached") is a **warning**, not a failure. The seed
skipped something to avoid overwriting data you created yourself. A reset gives you the standard dataset.

## Missing dependencies / module not found

**Symptoms:** `Cannot find module '@/generated/prisma-elearning'`, `@prisma/client did not initialize yet`,
`tsx: command not found`.

**Fix:** run `npm install` (which also generates both Prisma clients). If it still fails:
`npx prisma generate && npm run db:elearning:generate`. Also check `node -v` is 22+ (20.12 minimum).

## Authentication error: can't log in

- **"That email and password don't match":** type the **full** email (`student.demo@example.local`) and the
  exact password from [TEST_CREDENTIALS.md](TEST_CREDENTIALS.md) (they're case-sensitive). Then re-run
  `npm run db:local:seed`, which resets every dev account's password.
- **Login seems to work but you bounce back to /login**, or you see `NO_SECRET` / `JWT` errors: `NEXTAUTH_SECRET` is
  empty or changed. Set it (see [SETUP.md](SETUP.md#step-5-fill-in-your-development-values)), restart `npm run dev`,
  and clear the site's cookies for `localhost:3000`.
- **Redirected to the wrong page / "You don't have access":** that's the role check working. Each role has its own
  area. Use the account for the area you're testing.

## Google OAuth configuration issue

**Symptoms:** "Continue with Google" errors, `redirect_uri_mismatch`, `client_id is required`.

**Fix:** set `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` from a **development** OAuth client, whose authorized redirect
URI is exactly `http://localhost:3000/api/auth/callback/google`. Restart `npm run dev` after editing `.env`. Google
sign-in only works for existing accounts or new `@stu.cu.edu.ng` students (by design). For everything else use the
seeded email + password accounts.

## Cloudinary configuration issue

**Symptoms:** image upload fails, `Must supply api_key`, `Invalid Signature`.

**Fix:** set all three `CLOUDINARY_*` values from the **same** Cloudinary account, then restart `npm run dev`.
Uploads are optional. The rest of the app works without them.

## Paystack test configuration issue

**Symptoms:** `Paystack secret key is not configured.`, the checkout popup doesn't open, empty bank list,
`Invalid key`.

**Fix:**
- Use **Test** mode keys: `NEXT_PUBLIC_PAYSTACK_KEY=pk_test_…` and `PAYSTACK_TEST_SECRET_KEY=sk_test_…`, from the
  same Paystack account. Locally the app never uses `PAYSTACK_SECRET_KEY` (live).
- `NEXT_PUBLIC_*` values are built into the browser code, so **restart `npm run dev`** after changing them.
- Paystack webhooks can't reach `localhost`. That's expected: the checkout page verifies the payment itself.
- Pay with Paystack's test cards: <https://paystack.com/docs/payments/test-payments/>

## Course materials won't upload/download (Supabase Storage)

**Fix:** set `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` from a **development** Supabase project, run
`npm run storage:setup` once, and restart `npm run dev`. Optional. Nothing else depends on it.

## I didn't get the sign-up OTP email

That's expected locally: with `RESEND_API_KEY` empty nothing is emailed. The code is printed in the `npm run dev`
terminal: `[dev] student sign-up OTP for …: 123456`.

## LiveKit connection failure

This codebase has no LiveKit/livestream integration, so there's nothing to connect. If you're adding one, document
its dev credentials in [ENVIRONMENT.md](ENVIRONMENT.md).

## Still stuck?

Collect the exact command, the full error output, `node -v`, `docker --version` and your OS, and ask the team.
**Remove any secrets from what you paste.**
