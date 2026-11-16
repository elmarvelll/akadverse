# Marketplace test report

> **Latest rollout status:** Operator-supplied delivery fees are configured (₦500/₦650/₦800), with 12 active prices and the ₦150 service fee. The Production-target build and eight HTTP checks passed. Final promotion is held for existing delivery-code key compatibility and scoped diagnostic authorization; see [ROLLOUT_STATUS.md](ROLLOUT_STATUS.md). Earlier pending-price statements below describe the prior audit/migration stage.

> **Production follow-up:** The user subsequently approved the pricing migration. It was applied and verified on 2026-11-16; all seven migration checksums match. Three pricing tables and the ₦150 default now exist. Active delivery prices are still unconfigured. See [the approved migration report](PRODUCTION_PRICING_MIGRATION.md). Statements below about the initial pending migration or no production writes describe the pre-approval audit stage.

Verified 2026-11-16. Only focused Marketplace and boundary regression checks ran; the full application test suite was not run.

## Results

| Check | Result | Scope |
|---|---|---|
| Final `npm run test:marketplace` | **230 passed, 0 failed**, 66 suites | Marketplace service, database, route and rendered UI tests |
| Focused boundary regressions | **57 passed, 0 failed** | Main auth/dev login/session flow, AssemblyAI speech, revision-webhook protocol, productivity-AI security |
| Chromium workflow | **10 passed** | Real production components with synthetic API/provider fixtures, including 375px mobile viewport |
| Runtime Prisma schema validation/generation | Passed | One runtime client across existing public and marketplace tables |
| Main public schema preservation | Passed | `git diff --exit-code -- prisma/schema.prisma` |
| Standalone shared schema check | Passed | Read-only `node ../Marketplace/scripts/sync-shared-schema.mjs --check` |
| TypeScript `npx tsc --noEmit` | Passed | Target source plus focused test code |
| Marketplace ESLint / final UI lint | Passed | Marketplace services/API/UI and new runtime/setup/browser scripts |
| Normal production build | Passed | `npm run build`, isolated copy, Turbopack, client generation, type validation and route output |
| Local-only setup rerun | Passed | Both histories up to date; no duplicate migrations |
| Browser-artifact guard | Passed | No tracked browser profiles |
| `git diff --check` | Passed | Whitespace/integration hygiene |

The build used an isolated snapshot without environment files, localhost database URLs, dummy authentication configuration, real dependency directories and its own `.next`. The source-repository dev server/output was preserved. The final one-line checkout notice visibility correction was made after that build snapshot and independently verified by the browser workflow, TypeScript and targeted lint. The subsequent shell-independent Node CLI launcher was verified through client generation and the idempotent local setup rerun. No build/type/lint checks were disabled.

`BROWSER_RESULTS.json` contains the ten named browser assertions. The browser command creates its own actual Tailwind stylesheet, headless Chrome profile and in-memory fixture server, then removes the temporary profile. It performs no account login, live payment, email or remote database operation.

## Database and provider isolation

Created a separate Docker-local `akadverse_marketplace_parity_test` database on loopback port 5433. Applied existing public migrations and all seven exact Marketplace migrations, using separate public/marketplace migration histories. Other local databases were not reset. Paystack verification/accounts/transfers and Resend are in-memory fakes. Test database helpers refuse non-loopback URLs. The new setup helper additionally requires a database name ending in `_test` and never loads deployment environment files.

The configured application database was inspected **read-only** for Marketplace table/migration metadata. See DATABASE_READINESS.md for applied checksums and the pending pricing migration. No real records were created, edited or deleted there.

## Workflows and edge cases exercised

- Business approval/rejection/block/verification, owner visibility, email/outbox behavior and mapped business/vendor dashboard links.
- Business pricing: integer amounts, missing/inactive/foreign/duplicate prices, multi-business totals, one service fee, stale review tokens, saved financial snapshot consistency and idempotent payment.
- Stock: conditional reservation, competing final units, expiry/release, rollback and late payment reacquisition.
- Payments: amount/currency/reference validation, forged or malformed webhook, duplicate webhook/verify races, timeout/HTTP/provider recovery, abandoned/cancelled/failed attempts, cart preservation and NEEDS_REVIEW outcomes.
- Vendor schedules/capacities: recurring dates/overrides, exact two-hour cutoff, cross-midnight cutoff, closed/full timeframes, serializable retries and one booking across multiple vendors.
- Central scheduling: two-calendar-day minimum for every weekday, Lagos midnight, seller weekdays, zero/closed ranges, least-occupied allocation, regular/overflow classification, cancellations, concurrent checkouts, sibling-order payment capacity and previews.
- Weekly/date rosters: approved personnel, limits, holidays, over-capacity acknowledgement, explicit keep/replan, manual/dispatched plan preservation and legacy date-roster records.
- Delivery: separate Business drop-off/pickup/buyer OTP and Vendor assignment/student-code workflows; paid/readiness/ownership checks, delivery retry/refund/payout transitions.
- Codes: HMAC/AES-GCM binding, masking, wrong guesses/lock, replayed submission IDs, owner-only student code view, staff partial view, admin fallback/reissue, server-time midnight deadline, late completion and overdue alerts.
- Deliverer payout accounts, bank resolution, skipping unpayable transfers, payout retry caps and dispute-window run scoping.
- Briefing/notification idempotency, unauthenticated cron rejection, existing cron ownership and target briefing default-off/explicit enablement.
- Main integration boundaries: Marketplace block denies current Marketplace access/SSE while retaining the core session; live admin revocation; faculty admin preservation; protected admin/self accounts; malformed checkout fields return 400 before payment work.
- Rendered admin/roster/deliverer/storefront UI states, keyboard controls, responsive roster day cards and accessible labels.
- Chromium: product failure/retry, modal cart failure/retry, confirmed add/close, tap/Escape filters, main navigation, range repricing without payment, stale-quote explicit acknowledgement, saved token/amount submission, server verify after popup callback and mobile width.

## Failures found and resolved

Initial 225-check integration run passed 221 and failed four: two expected standalone email origins/paths and two expected the standalone cron configuration. These test expectations were adapted to the target's real origin and scheduler ownership. A focused 57-check rerun passed, then the final 230-check Marketplace run passed together.

The browser harness initially needed public build-time constants, safe selector quoting and the actual main DashboardNavbar label. It then found a real reference UI issue: checkout's stale-price error suppressed the acknowledgement notice. The target now renders both messages; all ten browser assertions passed afterwards.

The first temporary build lacked the existing Python tool-definition JSON; adding that required source asset fixed its module resolution. The webpack build subsequently compiled/typechecked but failed during page-data collection at the unchanged E-Learning native client loader (`module.createRequire`). No E-Learning workaround was introduced. The normal Turbopack build initially rejected the snapshot's external node_modules symlink. Replacing temporary symlinks with real copied dependency/client directories allowed the normal `npm run build` to pass.

## Acceptance still required

Automated evidence is not proof of a deployed cross-application transaction. Not exercised: real Paystack charges/refunds/transfers, Resend inbox delivery, Cloudinary upload, production scheduler invocations, physical mobile/Safari/browser interruption behavior, existing production-code decryption, or complete academic/student/lecturer/admin workflows. Their core source and schemas were preserved and selected auth/speech/revision/AI boundaries were regression-tested; this does not claim comprehensive verification of every unrelated module.

Before rollout, obtain approval and apply the pending pricing migration, configure active business/range prices, align the deployed delivery-code key with the existing standalone effective key, and verify test-mode cross-app checkout/payment/code completion. Keep one scheduler owner. Existing real-refund/transfer-webhook gaps and plaintext offline queue storage are inherited reference limitations, not newly verified capabilities.
