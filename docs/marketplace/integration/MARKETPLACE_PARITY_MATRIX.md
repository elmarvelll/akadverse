# Marketplace parity matrix

> **Production follow-up:** The user subsequently approved the pricing migration. It was applied and verified on 2026-11-16; all seven migration checksums match. Three pricing tables and the ₦150 default now exist. Active delivery prices are still unconfigured. See [the approved migration report](PRODUCTION_PRICING_MIGRATION.md). Statements below about the initial pending migration or no production writes describe the pre-approval audit stage.

Reference: sibling Marketplace current main working tree, including its uncommitted improvements. Target: AkadVerse productivity-layer-integration. Status describes initial discrepancy; final resolution distinguishes implementation from verification.

| Feature | Initial class | Comparison | Required action | Resolution / evidence |
|---|---|---|---|---|
| Catalog search, categories, sorting/limits | EQUIVALENT | Same search-products, shared categories and database filters | Preserve queries and endpoint response shapes | Existing catalog services reused; storefront tests |
| Product details/images/variants | PARTIAL | Shared product models; older modal/cart interaction | Port whole-card keyboard control, Escape, error retry, single-submit guard | Integrated; rendered and browser checks |
| Product availability during delivery closure | OUTDATED | Product detail could fail when no delivery occurrence exists | Display unavailable delivery without hiding product | Integrated ServiceError handling |
| Business and Vendor carts | PARTIAL | Same server stock/ownership rules; flat Vendor side rendering | Group mains and sides by vendor without merging carts | Integrated group-vendor-cart |
| Cart persistence/quantity/removal | EQUIVALENT | Existing authenticated database cart and conditional stock checks | Reuse services and hooks | Preserved |
| Catalog loading/error/empty states | OUTDATED | Some failed requests looked like an empty catalog | Explicit loading/success/error model, skeletons and retry | Integrated useLoad/ProductGrid |
| Navbar/filter/dropdowns/mobile | PARTIAL | Mouse-first flyouts and limited mobile search | Touch/keyboard/outside-click behavior, mobile search, visible focus | Integrated while retaining main dashboard navbar |
| Skills/service placeholder | AKADVERSE-SPECIFIC | Standalone hides the existing placeholder by UI flag | Retain main Skills placeholder; no new Skills backend | Intentional flag=true in target |
| Business registration/profile/delivery weekdays | EQUIVALENT | Same approval defaults, owner checks, fields, maximum delivery-day validation | Preserve existing services; adapt routes only | Preserved |
| Business approval/rejection/block/verification/report | EQUIVALENT | Shared models, audit/outbox and order restrictions | Preserve history and owner access to business block details | Preserved and tested |
| Vendor application/profile/pause/products/sides | EQUIVALENT | Same Business.type discriminator and independent ownership guards | Preserve distinct Vendor flows | Preserved |
| Business seller dashboard/analytics/products | PARTIAL | Existing business operations; older loading and local-time display | Integrate skeletons/contrast and Lagos display | Integrated; no analytics formula changes |
| Vendor orders informational workflow | OUTDATED | Old UI exposed readiness/pickup actions | Use paid auto-accepted orders, refund/status/deliverer display only | Integrated; Business actions guarded against Vendor use |
| Business lead time/timezone | OUTDATED | Old calculation skipped four days in host timezone | Current reference uses inclusive two Lagos calendar days | Integrated; every weekday and midnight tests |
| Business central-slot allocation | MISSING | Fixed estimated window; no persisted capacity-aware central plan | Intersect seller days/active ranges/date exceptions; save real windows | Integrated central-scheduling and ScheduledDelivery |
| Business balanced overflow | MISSING | No stored regular/overflow classification | Balance regular room, then explicit overflow; cancellation refills regular room | Integrated; concurrent checkout/payment capacity tests |
| Business delivery prices | MISSING | No business/range pricing association | Admin active integer-kobo price for existing ranges; missing prices block checkout | Integrated BusinessDeliveryPrice; no price backfill |
| Business flat checkout service fee | OUTDATED | Old zero-rate subtotal fee | One configurable flat fee (default 15000 kobo), separate from child order subtotal | Integrated BusinessPricingSettings; existing seller commission untouched |
| Business delivery-range selector/reviewed quote | MISSING | No explicit selected range or review fingerprint | Server summary and selection, atomic quote recheck, 409 and explicit re-acknowledgement | Integrated API/UI |
| Immutable checkout financial breakdown | MISSING | Order.totalAmount only item subtotal | Save items/range/window/fees/totals; preserve old public amount meaning | Integrated CheckoutFinancialSnapshot; no speculative legacy backfill |
| Pricing administration/financial reads | MISSING | No editor or snapshot view | Business-only pricing route/editor and recent orders/payment/snapshot view | Integrated; admin authorization and audit tests |
| Stock reservation/concurrent checkout | EQUIVALENT | Conditional stock decrement in transaction; Vendor Serializable retry | Preserve and add roster lock around Business quote/book | Existing protection retained; race tests |
| Vendor dates/preparation capacity/date overrides | EQUIVALENT | Existing recurring/date schedule and stock checks | Keep independent of delivery staffing and Business lead time | Preserved and tested |
| Vendor two-hour cutoff | OUTDATED | Older 90-minute inclusive/same-day-only behavior | Strict > max(120, configured cutoff); handles cross-midnight dates | Integrated; exact boundary tests |
| Vendor operation roster capacity | MISSING | Only vendor prep capacity enforced | Additional occurrence delivery limit/closure; booking counts once across vendors | Integrated without Vendor overflow allocator |
| Paystack initialization/server verification | EQUIVALENT | Shared expected amount/currency/reference checks and publishable mode | Expected amount now includes saved Business quote; provider remains authoritative | Preserved and tested |
| Payment callback/webhook/reconciliation/retry | PARTIAL | Existing idempotency, expiry, NEEDS_REVIEW | Avoid duplicate events/email when other app already paid orders; recheck saved delivery capacity | Integrated; webhook/verify concurrency tests |
| Cancellation/rejection/refunds | EQUIVALENT | Existing item escrow and reservation release | Preserve item-only refund semantics and capacity release | Preserved; real Paystack reversals remain reference limitation |
| Seller payouts | EQUIVALENT | Existing payout attempts/status/transfer service | Keep item-subtotal commission basis | Preserved; fake transfer tests |
| Deliverer application/student-email OTP | PARTIAL | Existing approval and verification; payout account not required | Resolve bank/account server-side and capture verified account | Integrated payout-account flow |
| Deliverer payout-account management | MISSING | No account editor on delivery dashboard | Owner-only read/update, safe bank fields, skip unpayable payout attempts | Integrated; account resolution/authorization tests |
| Recurring roster settings/weekly grid | MISSING | Legacy Vendor date-only assignments | Recurring operation-specific slots, limits, staff and weekly template | Integrated; legacy records still resolved |
| Roster date exceptions/holidays | MISSING | No recurring-template exception system | Close/limit/replace staff for one date and restore template | Integrated; validation/impact tests |
| Roster change impact confirmation | MISSING | No preview/keep/replan policy | Require explicit over-capacity acknowledgement and keep/replan; freeze dispatched/manual plans | Integrated under locks and audit |
| Saved plans/manual planned personnel | MISSING | Actual dispatch only | Keep plan distinct from dispatch; approved personnel; audited overrides | Integrated; existing actual dispatch reused |
| Admin delivery overview and separated operations | MISSING | One coordinator screen, separate legacy Vendor roster | Overview metrics; Business schedule/overflow/assignment; Vendor schedule/operations | Integrated; legacy URLs retained |
| Business drop-off/pickup/buyer OTP/retry | EQUIVALENT | Existing seller acceptance/preparation/coordinator handoff and buyer code | Retain Business-only workflow and per-item lifecycle | Preserved; shared completion helper conditional |
| Vendor simplified delivery lifecycle | OUTDATED | Vendor readiness/pickup/per-item code steps | Paid booking -> assignment/processing -> student booking code; no readiness or check-in gate | Integrated; legacy business pathways retained |
| Student booking handover codes | MISSING | No per-booking code/cipher/mask | Issue after verified payment; student full code, staff mask, HMAC/AES-GCM | Integrated; crypto/ownership tests |
| Offline delivery-code entry | MISSING | No queue | Queue entry with submissionId; server verifies before delivered; online/interval retries | Integrated; queue plaintext exists temporarily on unlocked device |
| Wrong-code limits/replay/late receipt | MISSING | Only old per-item OTP behavior | Bound guesses, idempotent submissions, server receive-time deadline, late completion audit | Integrated; wrong/locked/replay/late tests |
| Admin delivery-code exception operations | MISSING | No code reissue/fallback/reassignment view | Actual code and required reason; audit; partial staff view | Integrated; no unverified completion bypass |
| Shift check-in/card handover/meeting point | MISSING | Legacy personnel roster only | Operational acknowledgement independent of delivery completion | Integrated existing personnel records |
| Overdue confirmations | MISSING | No end-of-delivery-day overdue record | Flag once, notify admin, resolve on late completion without erasing history | Integrated; server Lagos midnight tests |
| Pre-slot assignment/briefing | MISSING | Reference-only background job | Integrate idempotent job but default target ownership OFF | Integrated route; production scheduler switch pending operator decision |
| In-app notifications/SSE | PARTIAL | Shared writer/SSE/outbox and main module scopes | Deterministic transactional notices; mapped deep links; blocked stream returns 403 | Integrated, preserving other notification scopes |
| Email notifications/retries | PARTIAL | Shared templates/outbox; missing booking/briefing/account-block templates | Adapt internal URLs and keep notification timing/idempotency | Integrated; fake email assertions |
| Marketplace user block/unblock | MISSING | Business block only | Use shared AccountState; deny Marketplace API access immediately; preserve core login | Integrated; new boundary tests |
| Admin user roles and configured identity | AKADVERSE-SPECIFIC | Main has academic roles and configured admin identity | Retain role fields/UI and configured identity; live admin recheck | Preserved and tested |
| Standalone auth/session/throttle/marker | DIFFERENT | Standalone mkt.* sessions; main shared NextAuth | Keep independent applications; do not replace main login/proxy | Intentional integration boundary |
| Public Prisma migration ownership | AKADVERSE-SPECIFIC | Standalone whitelist projection assumes main schema remains public-only | Generate runtime union without editing public source or changing tables | Resolved; reference schema-sync check passes |
| Scheduler/deployment configuration | DIFFERENT | Shared jobs owned by main; reference briefing separately active | Preserve existing Vercel academic/AI jobs; avoid duplicate briefing | No scheduler silently enabled |
| Image uploads | OUTDATED | Client MIME accepted with limited server checks | Recognize JPEG/PNG/WebP/GIF from bytes, size cap, authenticated upload | Integrated; requires configured Cloudinary for live check |
| Wishlist/discount/tax/provider transfers | EQUIVALENT | No wishlist/discount/tax workflow; transfer event handling remains limited | Do not invent reference functionality | Documented absence/limitations |

## File coverage

`SOURCE_INVENTORY.json` preserves the discovery inventory and now includes final classification for every mapped file. The inventory covers 544 mapped files, not 544 independently executed workflows. Byte/token equality and tests are different evidence. New helper/cron/schema files are listed in the implementation report. No live payment/email/storage or physical-mobile acceptance is claimed.
