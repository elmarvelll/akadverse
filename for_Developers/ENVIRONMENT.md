# Environment variables

Your settings live in **`.env` at the repository root**, copied from [`.env.example`](.env.example):

```bash
cp for_Developers/.env.example .env
```

`.env` is git-ignored. **Never commit it**, and never paste it into chats, issues or screenshots.

## The short version

- **Required:** `NEXTAUTH_SECRET` (generate it) plus the four database URLs (already filled in for local Docker).
- **Everything else is optional.** Leave it empty and the app still runs. Only that one feature stops working.

## Local vs staging vs production

| | LOCAL (your machine) | STAGING / PRODUCTION |
|---|---|---|
| Database | Docker Postgres on `localhost:5433` | Hosted Postgres (Supabase). **Never** use its URL locally |
| Paystack | **Test** keys (`pk_test_…`, `sk_test_…`) | Live keys, set only on the hosting platform |
| Google OAuth | A **development** OAuth client | The production client |
| Cloudinary / Supabase Storage / Resend | Your own free dev accounts, or dev credentials from the project owner | Production accounts |
| Who holds the values | You, in `.env` | The project owner, in the hosting platform (Vercel) |

If a value came from the production dashboard or the project's Vercel settings, **it doesn't belong in your `.env`.**

## Every variable

| Variable | Purpose | Required locally? | Where you get it | Dev/Test |
|----------|---------|-------------------|------------------|----------|
| `DATABASE_URL` | Core + Marketplace database (`prisma/schema.prisma`) | **Yes** | Pre-filled for local Docker | Local |
| `DIRECT_URL` | Direct connection for Prisma migrations (same as above locally) | **Yes** | Pre-filled | Local |
| `ELEARNING_DATABASE_URL` | E-Learning database (`prisma/elearning/schema.prisma`) | **Yes** | Pre-filled | Local |
| `ELEARNING_DIRECT_URL` | Direct connection for E-Learning `db push` | **Yes** | Pre-filled | Local |
| `NEXTAUTH_SECRET` | Signs login session tokens | **Yes** | Generate: `openssl rand -base64 32` | Local |
| `NEXTAUTH_URL` | The app's base URL for NextAuth | **Yes** | Pre-filled: `http://localhost:3000` | Local |
| `GOOGLE_CLIENT_ID` | "Continue with Google" | No | Google Cloud Console (dev OAuth client) | Development |
| `GOOGLE_CLIENT_SECRET` | "Continue with Google" | No | Same | Development |
| `CLOUDINARY_CLOUD_NAME` | Business/product image uploads | No | Cloudinary dashboard | Development |
| `CLOUDINARY_API_KEY` | Same | No | Same | Development |
| `CLOUDINARY_API_SECRET` | Same (server-only) | No | Same | Development |
| `NEXT_PUBLIC_PAYSTACK_KEY` | Opens the Paystack checkout popup (public key) | No | Paystack **Test** mode: `pk_test_…` | Test |
| `PAYSTACK_TEST_SECRET_KEY` | Payment verification, bank list, account lookup, payouts | No | Paystack **Test** mode: `sk_test_…` | Test |
| `PAYSTACK_SECRET_KEY` | **Live** secret key, used only when `NODE_ENV=production` | **No, leave unset** | Never set locally | Production only |
| `RESEND_API_KEY` | Sends emails (sign-up OTP, order/admin emails) | No | Resend dashboard (dev account) | Development |
| `MARKETPLACE_EMAIL_FROM` | "From" address on Marketplace emails | No | Built-in default when empty | Development |
| `ADMIN_EMAIL` | Receives admin notification emails | No | Your own address, if you want them | Development |
| `SUPABASE_URL` | Supabase Storage (E-Learning course-material files) | No | Supabase project → Settings → API | Development |
| `SUPABASE_SERVICE_ROLE_KEY` | Same (server-only secret) | No | Same | Development |
| `SUPABASE_COURSE_MATERIALS_BUCKET` | Storage bucket name | No | Code default is used when empty | Development |
| `CRON_SECRET` | Protects `/api/cron/*` routes | No | Any random string | Local |
| `DB_TIMING_DEBUG` | `1` logs Core query timings | No | n/a | Local |

### Variables you may see elsewhere but don't need

- `NEXT_PUBLIC_PAYSTACK_LIVE_KEY`, `DATABASE_PUBLIC_URL`: not read anywhere in the code.
- `VERCEL_*`, `TURBO_*`, `NX_DAEMON`: set automatically by Vercel on deployments. Never set them locally.
- `BASE_URL`, `PP_DIR`, `SHOTS_DIR`: only used when running the `scripts/verify-*.ts` browser checks (each script's header explains them).

---

## External services

Each service below is **optional** for local development.

### Google OAuth ("Continue with Google")

1. **What it does:** Google sign-in on `/login` and `/signup`. Email + password login works without it.
2. **Your own account?** Yes, a free Google Cloud project. Or ask the project owner for a *development* OAuth client.
3. **Test environment?** Use a separate OAuth client for development, never the production one.
4. **Setup:** Google Cloud Console → APIs & Services → Credentials → *Create OAuth client ID* → *Web application*.
   Add the authorized redirect URI `http://localhost:3000/api/auth/callback/google`.
5. **Where it goes:** `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` in `.env`.
6. **Safe locally?** Yes, if it's a development client.
7. **Note:** by design, Google only signs in *existing* accounts, or starts a new *student* sign-up for an
   `@stu.cu.edu.ng` address (`src/lib/auth.ts`). The seeded `@example.local` accounts use email + password.

### Cloudinary (image uploads)

1. **What it does:** stores business profile images and product photos uploaded from the Marketplace.
2. **Your own account?** Yes, the free tier is enough. Or use dev credentials from the project owner.
3. **Test environment?** No separate sandbox. Use a personal or dev account, never the production one.
4. **Setup:** <https://cloudinary.com> → Dashboard → copy *Cloud name*, *API Key*, *API Secret*.
5. **Where it goes:** `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`.
6. **Safe locally?** Yes, with a dev account.
7. **Without it:** everything works except uploading new images. Seeded products use stock Unsplash photos.

### Paystack (payments) — TEST MODE ONLY

1. **What it does:** checkout payments, bank list/account-name lookup on business onboarding, seller/deliverer payouts.
2. **Your own account?** Yes, a free Paystack account. Test mode needs no business verification.
3. **Test environment?** **Yes: Paystack Test mode.** Test keys start with `pk_test_` / `sk_test_`. Test cards:
   <https://paystack.com/docs/payments/test-payments/>
4. **Setup:** Paystack Dashboard → Settings → API Keys & Webhooks → **Test** keys.
5. **Where it goes:** `NEXT_PUBLIC_PAYSTACK_KEY` (pk_test) and `PAYSTACK_TEST_SECRET_KEY` (sk_test).
6. **Safe locally?** Test keys, yes. **Live keys: never.** Outside production the code *always* uses
   `PAYSTACK_TEST_SECRET_KEY` (`src/lib/external/paystack.ts`), so leave `PAYSTACK_SECRET_KEY` unset.
7. **Note:** Paystack's webhook (`/api/webhooks/paystack`) can't reach `localhost`. The checkout page verifies the
   payment itself after the popup closes, so local checkout still completes.

### Resend (email)

1. **What it does:** sign-up OTP emails, order and admin notification emails.
2. **Your own account?** Optional. A free Resend account can send to your own address.
3. **Test environment?** Leaving the key **empty** is the local "test mode": nothing is sent. The sign-up OTP
   is printed in the `npm run dev` terminal (`[dev] student sign-up OTP for …`), and other emails are logged as
   `[email] RESEND_API_KEY not set — would have sent …`.
4. **Where it goes:** `RESEND_API_KEY`, optionally `MARKETPLACE_EMAIL_FROM` and `ADMIN_EMAIL`.
5. **Safe locally?** Recommended: leave it empty. If you set it, set `ADMIN_EMAIL` to **your own** address so you
   never email real people.

### Supabase Storage (E-Learning course materials)

1. **What it does:** stores files lecturers upload to a course offering (PDFs etc.). **Only Storage.** The app's
   databases do not use Supabase locally.
2. **Your own account?** Yes, a free Supabase project. Or dev credentials from the project owner.
3. **Test environment?** Use a separate development project, never production's.
4. **Setup:** Supabase → your project → Settings → API → copy the *Project URL* and the *service_role* key. Then
   run `npm run storage:setup` once to create the private bucket.
5. **Where it goes:** `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` (optionally `SUPABASE_COURSE_MATERIALS_BUCKET`).
6. **Safe locally?** With a dev project, yes. The service-role key is a full-access secret: server-only, never
   in client code.
7. **Without it:** everything works except uploading or downloading course materials.

### What about LiveKit / AI services?

This codebase has **no** LiveKit, livestream or AI-service integration and reads no such environment variables, so
there's nothing to configure.
