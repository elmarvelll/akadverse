# Buddy System implementation handover

Implemented 17 November 2026. Entry point: `/studashboard/productivity-layer#buddy`.

## Executive summary

The Productivity Layer now includes Buddy System discovery, individual buddy requests, group creation, approval workflows, My Groups, application tracking, private contact sharing, and external group-chat access. It uses real PostgreSQL records and the existing student authentication, workspace navigation, buttons, status pills, and notification writer.

Implementation and focused local checks are complete. At the original handover the migration had only been applied to the disposable test database. During the subsequent loading-error fix, the Buddy migration was applied atomically to the database configured by the local app, and its discovery service was verified successfully. Other deployment environments still require the migration. No site was published.

## Existing implementation audit

The preimplementation search found only `services/productivity-layer/buddy-system/.gitkeep`: no Buddy models, APIs, screens, or existing one-to-one workflow. There was therefore no functioning Buddy feature to rebuild or preserve. The original one-to-one requirements were implemented alongside groups.

Working foundations reused:

- Student authorization: `requireProductivityUser`, including the student role check.
- Existing Productivity route, account-bound client lifetime, section selection, responsive sidebar, collapse/expand, section loading and hidden-section behavior.
- `ProdButton`, `StatusPill`, workspace colors and Lucide/custom icon conventions.
- `ServiceError`, origin/content-type validation, core Prisma client and PostgreSQL transactions.
- The shared notification writer, rather than another notification table or delivery system.

Missing before this work: discovery/search, creation, memberships, applications, approval, ownership management, private sharing, capacity enforcement and all Buddy UI. There was no Buddy-specific broken functionality or existing private-data leak to repair. The E-Learning return label and shared voice-input note were separate requested text changes.

The working tree already contained substantial unrelated changes. Those were preserved. In previously modified Sidebar and navigation-test files, only the relevant return-label text/assertion was changed by this work.

## UI and navigation

Buddy System is a workspace sidebar item with a community icon, the existing selected treatment, mobile dismissal, and collapsed rail behavior. No additional sidebar or unrelated application was created.

Main sections: Discover, Buddy Requests, Buddy Groups, My Groups, and My Requests & Applications. The last section is the application-tracking area requested in the brief. My Groups separates **Groups I Manage** and **Groups I've Joined**. Activity can filter all activity, created buddy requests, applied buddy requests, and submitted group applications.

The existing workspace uses section state and fragments rather than separate nested routes. Buddy follows that architecture:

- Home: `/studashboard/productivity-layer#buddy`.
- Details/creator management: `/studashboard/productivity-layer#buddy?listing=<id>`.
- Discovery, creation, My Groups and activity filters are internal views, like the other workspace sections. They do not introduce separate routes.

Search trims input, debounces for 300 ms, and searches title/description on the server with case-insensitive partial matching. Lists paginate at 24 entries, ordered by creation date and ID. Discovery returns only Open listings. Full and Closed groups remain in relevant personal views and retain authorized detail access.

Cards show type, title, description, creator, creation date, listing status, approved member count/capacity, pending count for owners, and the current student's application state. Actions reflect ownership, membership and lifecycle status. Details explain approval and external-chat membership, and creators can review applicants and approved members. Chat access is provided in the authorized detail view reached from joined-group cards.

Creation is an inline panel with explicit labels, length limits, required fields, field hints, frontend URL/capacity validation, submission locking, server error feedback and success feedback. It opens with Buddy Request selected from the requests section. There are loading, retry, empty, pending, declined, matched, full and closed states. Native controls, visible focus styles, live status/error regions and responsive grids support keyboard and small-screen use. A native confirmation precedes closing.

The E-Learning return link now says **Back to Home** in expanded and rail modes and returns to `/studashboard`, the platform home. The shared voice-input idle note now asks users to review their words before sending, without naming AssemblyAI; recording/error controls remain functional.

## Groups and membership behavior

Creation uses one nested Prisma write: the group and its creator's Accepted membership succeed together or fail together. Counts derive from Accepted applications/memberships, rather than a stored mutable count. The creator is member one. An unlimited group has a null capacity. A maximum of one creates a Full group immediately, as required by capacity semantics.

Applying checks existence, creator identity, existing membership/application, status and capacity. The unique listing/user key prevents duplicate membership records. All application, approval, decline and close operations first lock the listing row with `SELECT ... FOR UPDATE` in a Read Committed transaction. This provides one serialization point for competing approvals and close-versus-approve races.

Acceptance rechecks current capacity and status under the lock. Reaching capacity marks a group Full. Closed listings reject new applications and acceptance. Declining changes only application status; it adds no member and shares no private information. Creators may decline remaining pending applications after closing. Closing does not remove existing memberships or their invitation access.

## Individual buddy requests

Creation requires title, description and creator contact details. An applicant supplies their own contact details when expressing interest. Neither party's contact is disclosed to the other before acceptance. On acceptance, the creator sees the selected applicant's contact and the accepted buddy sees the creator's contact.

The same listing-row lock serializes acceptance. The request becomes Matched; remaining Pending applications become Declined in that transaction. Further applications and competing acceptance fail. Group memberships do not share this one-to-one limit.

## My Groups and application tracking

Managed groups query `kind = GROUP AND creatorId = currentStudent`, with no lifecycle restriction. Joined groups query Accepted membership, exclude creator-owned groups, and also include all lifecycle statuses. That exclusion prevents creator groups appearing twice.

Activity includes the student's created listings and applications. Separate filters distinguish created individual requests, applied individual requests and group requests submitted. The card labels distinguish listing status from application status. Owners review pending group applications through My Groups or their activity listing.

Successful mutations refresh the active data without reloading the page. Returning to a section, focusing the window or pressing Refresh fetches current state. Requests abort when the section hides or query changes, preventing stale fetch results from replacing newer data. There is no new Buddy websocket or continuous polling service.

## Backend and database

One endpoint, `/api/productivity/buddy`, provides:

| Method | Input | Operation |
| --- | --- | --- |
| GET | `view`, `search`, `page` | Discover and personal lists |
| GET | `id` | Authorized details and creator management data |
| POST | `kind`, `title`, `description`, `privateDetails`, optional `maxMembers` | Create group/request |
| PATCH | `id`, `action=apply`, optional `contactDetails` | Apply |
| PATCH | `id`, `action=accept/decline`, `applicationId` | Creator review |
| PATCH | `id`, `action=close` | Creator closure |

List views: `discover`, `groups`, `requests`, `manage`, `joined`, `activity`, `created-requests`, `applied-requests`, `group-applications`.

`BuddyListing` represents the shared logical record for BuddyGroup/BuddyRequest. `BuddyApplication` represents GroupMembership/BuddyInterest. The `kind` discriminator and service rules keep group and individual behavior distinct. This avoids four duplicate infrastructure implementations while retaining every required logical field.

New enums: BuddyKind (GROUP/REQUEST), BuddyStatus (OPEN/FULL/MATCHED/CLOSED), BuddyApplicationStatus (PENDING/ACCEPTED/DECLINED).

Migration: `prisma/migrations/20261117120000_buddy_system/migration.sql`. It creates both tables, enums, user/listing foreign keys with cascade cleanup, unique listing/user application constraint, capacity/type-status check constraints, and indexes for discovery, creator listings, student applications, and listing/status lookups. Title/description substring search uses the existing PostgreSQL contains mode; no external search service was added.

Server validation limits title to 160, description to 4,000, and private/contact fields to 2,000 characters. Bodies are limited to 16 KB while streaming. Capacity must be a positive integer within PostgreSQL Int range, or null. Valid invitation formats are HTTPS `chat.whatsapp.com/<token>` (including mode query variation), `t.me/+<token>`, `telegram.me/+<token>`, and `joinchat/<token>` variants. Arbitrary hosts, credentials, ports, fragments, public Telegram usernames and unsafe schemes are rejected. Legacy invalid invitations are returned as unavailable rather than clickable links.

## Security and notifications

Every endpoint method requires the existing authenticated student authorization. Mutations also use the existing same-origin and JSON content-type checks. Ownership is checked on the server; payload membership statuses and user IDs are never trusted.

Public/personal list projections never select private listing details or application contacts. Detail reads only fetch private listing details for the creator or an Accepted member/buddy. Other users receive no privateDetails property and no applicant roster. Applicants' contacts are fetched for creators only after acceptance. No email, password or unrelated profile fields are returned.

External invitations use a validated URL and `target="_blank" rel="noopener noreferrer"`. Application retries and unauthorized mutation attempts cannot bypass listing locks or unique keys.

New applications and explicit acceptance/decline use `createNotification` with a link back to the listing. These use the existing default notification scope and appear through the existing notification infrastructure. No Productivity-specific bell was added. Delivery is best effort after commit: a notification failure does not undo or misreport a committed membership change. Applicants can always inspect status in activity. Automatically declined competing buddy applications are reflected there without a separate fan-out notification.

## Files changed by this implementation

| Area | Files | Purpose |
| --- | --- | --- |
| Frontend | `src/features/productivity/buddy/BuddySystem.tsx` | Discovery, creation, personal views, details and management |
| Frontend | `src/features/productivity/buddy/buddy.module.css` | Scoped responsive styling and focus states |
| Shared validation/types | `src/features/productivity/buddy/domain.ts` | DTOs, invitation/capacity validation |
| Navigation | `src/features/productivity/workspace/{Workspace.tsx,WorkspaceSections.tsx,navigation.ts,Design.tsx}` | Section mounting, sidebar item, deep links and icon |
| Requested text | `src/app/e-learning/_components/Sidebar.tsx` | Back to Home labels |
| Requested text | `src/app/components/voice/VoiceInputControls.tsx` | Remove provider name from idle note |
| Backend | `services/productivity-layer/buddy-system/service.ts` | Query projections, privacy and transactional workflows |
| API | `src/app/api/productivity/buddy/route.ts` | Student auth, body limits, dispatch and private responses |
| Database | `prisma/schema.prisma`, new migration above | Models, relations, enums and constraints |
| Tests | `tests/productivity/buddy{.test.ts,-route.test.ts,.db.test.ts,.browser.tsx}` | Focused validation, controller, PostgreSQL and browser coverage |
| Test runner | `scripts/verify-buddy-system.cjs` | Headless Chromium fixture checks |
| Existing test | `tests/elearning/platform-navigation.test.tsx` | Updated Home label assertion |
| Documentation | This report and `manual-acceptance.md` | Handover and reproducible manual checks |

No feature files were deleted. The generated runtime Prisma schema/client was regenerated through `node scripts/generate-core-prisma.mjs`; generated files are ignored by the repository. No environment variables, package dependencies or deployment configuration were added.

## Verification

See the final results below. Browser fixtures verify real components against isolated in-memory HTTP responses; the PostgreSQL suite separately verifies actual persistence and concurrency. These are complementary checks, not a claim of a deployed end-to-end run.

| Command | Purpose | Final result |
| --- | --- | --- |
| `node scripts/generate-core-prisma.mjs` | Regenerate transaction-capable runtime Prisma client | Passed |
| `node --import tsx --experimental-test-module-mocks --test tests/productivity/buddy-route.test.ts tests/productivity/buddy.test.ts` | Student gating, origin/body validation, response privacy, invitation/capacity validation and direct links | 6 passed |
| `TEST_DATABASE_URL=postgresql://…@127.0.0.1:5433/akadverse_buddy_test node --import tsx --test --test-concurrency=1 tests/productivity/buddy.db.test.ts` | Real group creation, duplicates, ownership, privacy, approval/decline, capacity races, closure, unlimited groups and one-to-one matching | 6 passed; final filter assertions also checked |
| `node scripts/verify-buddy-system.cjs` | Real Chromium component workflow and desktop/tablet/mobile bounds | Passed, 11 checks |
| `node --import tsx --experimental-test-module-mocks --test tests/elearning/platform-navigation.test.tsx` | Existing portal navigation including updated return label | 4 passed |
| `npx eslint <changed Buddy, workspace, text, test and runner files>` | Focused lint | Passed, no warnings in final run |
| `npx tsc --noEmit --pretty false` | Repository TypeScript compatibility | Passed |
| `node node_modules/typescript/bin/tsc --project /tmp/akadverse-buddy-tsconfig.json --pretty false` | Changed code and dependencies, with project ambient declarations | Passed in final scoped check |
| `docker exec -i akadverse-local-postgres-1 psql -U akadverse -d akadverse_buddy_test -v ON_ERROR_STOP=1 < prisma/migrations/20261117120000_buddy_system/migration.sql` | Exact migration SQL, in disposable database after resetting only its Buddy tables/types | Passed |
| `git diff --check` | Whitespace validation | Passed |

Initial failures were corrected: schema-only DB isolation did not work with the runtime client's explicit public schema, so a separate local test database was used. One API fixture omitted the required JSON content type; it was corrected. An initial scoped TypeScript config omitted existing NextAuth ambient declarations; including `src/types/*.d.ts` corrected it. Initial browser startup timed out; the diagnostic retry with a 30-second allowance passed. A subsequent navigation race in the browser runner accessed the body before it existed; the readiness checks were made null-safe and the final run passed. The sandbox initially blocked the browser fixture server and local Docker/database access; those local checks subsequently ran with approved escalation. No tests remain blocked for those reasons.

No full repository test suite, production build, external invitation redemption, live provider test or deployed end-to-end test was run. The full TypeScript check ran once; unrelated tests were not repeated. Manual acceptance against real signed-in browser sessions is provided separately.

## Deployment readiness and open product decisions

Apply the new core migration using the repository's established migration deployment workflow (`prisma migrate deploy --schema prisma/schema.prisma` with the intended direct database URL), then regenerate the union client with `node scripts/generate-core-prisma.mjs` or the normal build. Do not db-push or migrate the generated union schema. Review any other pending core migrations before deploying in this already modified repository. No E-Learning migration is required for Buddy System.

No new environment settings or provider credentials are needed. Existing core PostgreSQL, NextAuth and notification infrastructure are required. The test database `akadverse_buddy_test` is local and disposable; tests clean up their fixture users and cascading records. A separate initial `buddy_system_test` schema was created during isolation setup and is unrelated to runtime use.

Group editing, leaving, member removal, deletion and reopening did not previously exist and have not been invented here. There is consequently no capacity-reopening path in this MVP. Declined applicants cannot submit another application; future reapplication policy needs an explicit product decision. Closing is permanent in this implementation and preserves existing member access. These behaviors are stated in the UI where appropriate.

The approval guarantees assume all application writes go through this service. The unique constraint protects duplicate memberships; listing-row serialization protects capacity and one-to-one matching. Direct administrative database writes must preserve those invariants. Invitations cannot be verified as live/non-expired without external platform integration, which is outside scope. Notification delivery after commit is best effort and is not a durable outbox. Very large creator rosters are loaded in the detail view; discovery and personal listing collections are paginated.


## Follow-up: Buddy loading error

The attached runtime log showed discovery returning HTTP 500 while ordinary workspace calls succeeded. A read-only check using Next.js development environment precedence confirmed `P2021`: both `public.BuddyListing` and `public.BuddyApplication` were absent from the app's configured database.

Applied only `20261117120000_buddy_system` in one PostgreSQL transaction after checking that neither table nor a conflicting migration record existed. Recorded the exact SQL checksum in the existing Prisma migration history in the same transaction. Unrelated migrations and existing application records were untouched. Both tables initially contained zero records; the actual `browseBuddy` service then completed successfully and returned an empty discovery page.

The Buddy endpoint now reuses the existing safe Productivity error mapper and bounded database diagnostics. Missing tables produce HTTP 503 / `DATABASE_SCHEMA_MISSING`, rather than an opaque generic 500. Responses and logs share a reference ID; raw database errors, credentials, queries and personal content are not returned or logged.

Focused verification: `node --import tsx --experimental-test-module-mocks --test tests/productivity/buddy-route.test.ts` passed all four cases, including the added missing-schema regression. `npx eslint src/app/api/productivity/buddy/route.ts tests/productivity/buddy-route.test.ts` and `git diff --check` passed. No broad test suites were run for this fix. If a previously running dev server retains a Prisma client generated before Buddy models existed, restart that dev server after refreshing.
