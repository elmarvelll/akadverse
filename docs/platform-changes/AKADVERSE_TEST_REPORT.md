# Focused verification report

16 November 2026. Full test suite deliberately not run, as requested.

## Passing checks

| Command/check | Result |
|---|---|
| `npm run test:platform` | 52 passed, 0 failed |
| `npm run test:platform:db` | 23 passed, 0 failed, localhost only |
| `npm run test:platform:browser` | 9 passed, 0 failed; [receipt](BROWSER_VERIFICATION.json) |
| `npx tsc --noEmit --pretty false` | Passed, no diagnostics |
| ESLint on changed classroom services/UI/API, conversation service, scroll controls, Study Zone, sidebar/navigation, analytics and hub/admin definitions | Passed, no errors or warnings |
| `git diff --check` | Passed |
| E-learning Prisma generate | Passed |
| Additive classroom SQL patch | Applied successfully to localhost test E-learning database |

Unit/route coverage includes student-only sidebar destination, exact active matching and nested/lookalike rejection, unchanged faculty/HOD destinations, five retired direct routes, Marketplace Skills suppression, task analytics values/legends/empty charts after explanation removal, Markdown/math/sanitization, 16 speech regressions, authentication-before-body-parsing, raw body limit and private cache headers.

Database coverage includes lecturer assignment, course week/material ownership, stale lesson updates, missing lesson, unregistered student/ended class, server-derived AI scope, owned persistent history, bounded follow-up history, per-student isolation, Study Zone namespace isolation, idempotent retry, provider failure recovery, in-flight lesson changes and authorized source/title filtering. Existing 16 Study Zone conversation cases pass. The real student dashboard page renders approved registration and academic summary records from local fixtures.

Browser checks use actual Shell/Sidebar, ClassroomStuwart, shared response renderer and scroll hook, compiled with Tailwind, plus in-memory API/academic fixtures. They do not use a real signed-in browser, provider or LiveKit session. Mobile viewport: 375×812; desktop: 1280×900.

## Corrections during verification

- Updated prior Marketplace and productivity assertions that deliberately expected the UI now being retired.
- Fixed new test harness CJS top-level await, CSS-module bundling, selector escaping and waiting for animated bounds.
- Corrected a dashboard assertion: the real page shows a registered-course count, not course code text.
- Moved classroom state reset to a lesson-keyed component and removed render-time ref writes to satisfy React rules.
- Made follow-scroll listeners rebind for conditional panel mounting, preserving manual scroll when the classroom panel is opened.
- Reduced-motion fixture must mount after preference emulation; the installed Framer Motion hook snapshots that preference at mount.

Final passing runs supersede these initial failures; no known failing targeted application test remains.

## Evidence and limits

Raw local logs: `/private/tmp/platform-focused-final.log`, `platform-db-final.log`, `platform-browser-final.log`, `platform-lint-final.log`, `platform-tsc-final.log`, `platform-diff-check.log`. A durable browser JSON receipt is copied alongside this report.

Not exercised: live Supabase availability, real Gemini/concept-explainer latency/answer quality, real microphone/provider billing, real multi-participant LiveKit audio/video, physical iOS keyboard/safe-area behavior, production deployment or full production build. Existing speech transport is unchanged. No claim of a successful live rollout is made. A live lesson with safe student/faculty accounts remains the appropriate pre-release acceptance check after applying the SQL patch.

## Subsequent migration execution

At `2026-11-16T17:39:33.309Z`, the classroom lesson patch committed on the configured Supabase E-learning database. Verified all four column types/nullability/defaults, the week constraint and a generated-client classroom query. Regenerated the E-learning client successfully. No data deleted; no application deployment. See [receipt](CLASSROOM_MIGRATION_RECEIPT.json).
