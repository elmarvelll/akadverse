# Setup, step by step

This takes about 10 minutes the first time, most of it downloading. Run every command from the **repository root**
(the folder that contains `package.json`), not from inside `for_Developers/`.

If anything goes wrong, see [TROUBLESHOOTING.md](TROUBLESHOOTING.md).

## Quick start

```bash
git clone <repository-url> akadverse
cd akadverse
npm install
cp for_Developers/.env.example .env
# set NEXTAUTH_SECRET in .env (Step 5)
npm run setup:local
npm run dev
```

The steps below explain each line.

---

## Step 1: Install the requirements

| Tool | Version | Why | Get it |
|------|---------|-----|--------|
| Git | any recent | clone the code | <https://git-scm.com/downloads> |
| Node.js | **22 LTS or newer** (20.12 is the minimum) | runs the app; includes `npm` | <https://nodejs.org> |
| Docker Desktop | any recent | runs the local Postgres database | <https://www.docker.com/products/docker-desktop/> |

You do **not** need a Postgres installation, the Supabase CLI or Python.

Check them:

```bash
git --version
node -v        # v22.x.x or newer
npm -v
docker --version
```

**Open Docker Desktop and leave it running.** The database lives inside it.

## Step 2: Clone the repository

```bash
git clone <repository-url> akadverse
cd akadverse
```

## Step 3: Install dependencies

```bash
npm install
```

This also generates the two Prisma database clients automatically (you'll see `prisma generate` in the output).
It's normal to see npm warnings about audits or `allow-scripts`.

## Step 4: Create your `.env`

```bash
cp for_Developers/.env.example .env
```

(Windows PowerShell: `Copy-Item for_Developers/.env.example .env`)

> **Why `.env` and not `.env.local`?** Prisma (migrations and the seed) only reads `.env`. Next.js reads `.env` too,
> so one file serves everything. `.env` is git-ignored and must never be committed.

## Step 5: Fill in your development values

Only **one** value is required: `NEXTAUTH_SECRET`. Generate a random string:

```bash
openssl rand -base64 32
# or, on any OS:
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

Paste it into `.env`:

```env
NEXTAUTH_SECRET="paste-the-generated-value-here"
```

The database URLs are already correct for the local Docker database. Everything else (Google sign-in, Cloudinary,
Paystack, email, Supabase Storage) is **optional**. The app runs without them, and only the feature that needs them
won't work. [ENVIRONMENT.md](ENVIRONMENT.md) explains each one and where to get test credentials.

## Steps 6–8: Start the database, apply the schema, seed it

One command does all three:

```bash
npm run setup:local
```

It runs these (you can also run them separately):

| Step | Command | What it does |
|------|---------|--------------|
| 6. Start database | `npm run db:local:up` | Starts Postgres 16 in Docker on `localhost:5433` with both databases. **The first run downloads the Postgres image (a few minutes).** |
| 7. Apply schema | `npm run db:local:setup` | Core database: applies `prisma/migrations`. E-Learning database: `prisma db push` + `constraints.sql`. |
| 8. Seed | `npm run db:local:seed` | Loads reference data, the development accounts and demo data. See [seed/README.md](seed/README.md). |

You should finish with:

```text
✔ Development data ready. Log in with the accounts in for_Developers/TEST_CREDENTIALS.md
```

## Step 9: Start the app

```bash
npm run dev
```

Open <http://localhost:3000>. The first page load compiles, so give it a few seconds.

## Step 10: Log in

Open [TEST_CREDENTIALS.md](TEST_CREDENTIALS.md) and pick the account for what you want to test, for example:

- `student.demo@example.local` / `Student123!`: the student experience
- `admin.demo@example.local` / `Admin123!`: the Marketplace admin dashboard

Type the **whole email address** on the login page.

---

## Day-to-day

```bash
npm run db:local:up     # after restarting your computer (if the container isn't running)
npm run dev
```

After pulling changes that include new migrations or schema changes:

```bash
npm install             # if package.json changed
npm run db:local:setup
```

To throw everything away and start fresh:

```bash
npm run db:local:reset
npm run db:local:seed
```

To stop the database: `npm run db:local:down` (your data is kept).
