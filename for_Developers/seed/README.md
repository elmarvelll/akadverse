# Development seed

```bash
npm run db:local:seed
```

Fills your **local** databases with the test accounts in [../TEST_CREDENTIALS.md](../TEST_CREDENTIALS.md) and enough
data to use every role's main screens straight away. It refuses to run unless every database URL in `.env` is
`localhost` (and never when `NODE_ENV=production`).

## What it runs

| Step | Source | Creates |
|------|--------|---------|
| 1 | `npm run db:ccmas:import` (existing) | NUC/CCMAS Engineering reference data, from the committed JSON |
| 2 | `npm run db:elearning:seed` (existing, `scripts/elearning-seed.ts`) | 4 colleges, 5 Engineering departments, programmes EEE/CPE/ICE, the current session (Alpha current, Omega next), a 15–24 unit rule for EEE 300 |
| 3 | [`users.ts`](users.ts) + [`accounts.ts`](accounts.ts) | 12 development accounts (Core `User`), bcrypt-hashed exactly like real sign-up |
| 3 | [`e-learning.ts`](e-learning.ts) | Student/Faculty/HOD/DAPU profiles; a **published** EEE 300-level course structure (9 real CCMAS courses) with offerings, lecturers and teaching days; a Level Adviser assignment; 3 course registrations (approved / awaiting adviser / awaiting HOD) |
| 4 | [`marketplace.ts`](marketplace.ts) | Plug (Dev) business (products, a variant product, delivery days), Campus Bites (Dev) school vendor (products, sides, per-timeframe capacity), an approved deliverer, the buyer's cart, 2 orders + order history, notifications |

Step 2's output mentions `marvelousifezue31@…` accounts. That's the existing seed looking for the project owner's
personal test accounts. Ignore those lines.

## Deliberately not seeded

- **Registration periods.** Only DAPU creates these (a rule stated in the existing seed). Open one as `dapu.demo`
  under Timeframes to test student course registration.
- **Course materials.** The files live in Supabase Storage, so a database row without a real file would be a broken link.
- **Results and timetables.** They're produced by the faculty/HOD/DAPU workflows. Test them by using those workflows.
- **Livestream data.** The app has no livestream models.
- **Skills Market.** The Skills Market pages show built-in sample data (`services/marketplace/skills-market/data.ts`)
  and don't read the `Skill` table yet.
- **Real money/bank data.** No bank accounts or account numbers. Payment references look like `DEV-SEED-ORDER-0001`.

## Re-running it

The seed is **idempotent**: run it as often as you like and you won't get duplicates.

- Seeded rows have stable ids ([`ids.ts`](ids.ts) derives a fixed UUID from a name like `business:plug`) or are
  upserted on a natural unique key (email, course code…), so a fresh database gets the same ids every time.
- Re-running **restores** seeded rows to their seeded state: account passwords, roles, stock, order status and so on.
  It doesn't delete rows you created yourself.
- The one table that grows is `CCMASImportBatch`: the CCMAS importer logs one audit row per import run, by design.
- If the seed finds something it needs already held by data you created (e.g. a different HOD for the department),
  it prints a `!` warning and skips that part instead of overwriting yours.

For the exact dataset from scratch: `npm run db:local:reset && npm run db:local:seed`.

## Changing it

- New/changed account: edit [`accounts.ts`](accounts.ts) **and** update [../TEST_CREDENTIALS.md](../TEST_CREDENTIALS.md).
- Keep it small and realistic, use only models/fields that exist in the Prisma schemas, and give every new row a
  stable id or a unique key so re-runs stay duplicate-free.
- Never add real people, real emails, real passwords or real payment details.
- Never use the platform admin's email local part (`src/lib/admin-identity.ts`). It silently grants admin.
