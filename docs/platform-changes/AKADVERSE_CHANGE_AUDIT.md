# AkadVerse change audit

Starting branch: productivity-layer-integration, HEAD bd0e650. Existing Marketplace rollout modifications, sensitive environment files and unpromoted deployment are preserved. No branch switch, reset, commit or push is part of this task.

## Impact and implementation plan

1. Productivity explanations live in AnalyticsView.CalculationInfo and AnalyticsPanel's About these figures disclosure. Remove those UI-only sections; retain calculations.ts, charts, totals, meaningful scope labels and incomplete-data errors.
2. Branding spans Study Zone client/components, server errors/prompts, voice privacy labels and documentation. Change interface prose to Stuwart. Preserve legacy `/stewart` routes, database StewartAttachment, lower-case conversation roles and HMAC namespace as compatibility contracts. Canonical new UI component is StuwartPanel; document all remaining identifier occurrences.
3. Main Menu / AI Studio are placeholder student/faculty pages/cards plus the shared admin domain entry. Remove cards/domain and disable their dedicated routes. No exclusive data models/jobs/providers were found; shared AI services stay.
4. Marketplace Skills is a single UI feature flag used by catalog/filter/My Trade/admin surfaces. Disable it, preserve real products/vendors/businesses and persisted Skills tables; remove the independent Best Services placeholder where it is also part of that unfinished Skills presentation.
5. Study Zone currently has a shared useFollowLatest hook, but the active composer/log integration uses unconditional log scrolling and no jump control. Wire the existing hook to the transcript textarea and log, retain older-message anchor restoration, and show a reusable compact accessible down-arrow when paused. Do not alter AssemblyAI session/audio/transport logic.
6. Classroom: StudentRoom/TeacherRoom share authorized session state polling, LiveKit and server actions. A session currently has no authoritative topic/week/material. Add nullable lesson topic/week/material and a version counter to ClassroomSession. Teacher updates are assignment-checked and validate offering/week/material ownership. Student context resolves registration and live status server-side on every request. Reuse requestExplanation and ChatConversation/ChatMessage claim/completion machinery, with deterministic classroom/lesson-scoped conversation keys and isolated AI sessions. No new chat/vector/document system.
7. Student Dashboard navigation uses shared nav-config.ts. Change only the student destination to /e-learning/student/dashboard; exact section active matching already excludes nested dashboard routes. Add aria-current consistently in rail/full links. Other role dashboards/home routes remain unchanged.

## Grounding and persistence boundaries

The existing provider accepts offering/week and session/history, not live audio/video or a selected-document filter. Lesson metadata is authoritative reference context; actual retrieval remains the authorized course/week. Render retrieved sources and communicate these limits. A new lesson version creates a separate conversation context; revisiting/closing/reopening a panel restores its existing conversation. Old Study Zone endpoints must not repurpose classroom conversations. No mass rewrite of old messages or database identifiers.

## Verification plan

Use focused navigation/branding/productivity/render tests, speech/protocol regressions, classroom context/security/provider/persistence tests, and Chromium interactions. Typecheck and lint relevant files. Stage and test additive SQL locally; document whether applied live. Do not perform live charges, send customer messages, or promote the earlier held Marketplace deployment as part of this unrelated task.

## Final implementation inventory

| Area | Main files |
|---|---|
| Student navigation | `src/app/e-learning/_components/nav-config.ts`, `Sidebar.tsx`; existing Shell/Header consume the same configuration |
| Productivity | `src/features/productivity/analytics/AnalyticsView.tsx`, `AnalyticsPanel.tsx`; formulas and Charts.tsx unchanged |
| Hub removal | `src/app/studashboard/page.tsx`, `src/app/facultydashboard/page.tsx`, admin `_components/domains.ts`; five retired Main Menu / AI Studio page modules |
| Marketplace cleanup | Marketplace `_components/marketplace-features.ts`, Marketplace home; existing flag consumers normalize hidden Skills searches to product/business behavior |
| Study Zone | `StuwartPanel.tsx`, `StudyWorkspace.tsx`, shared `scroll/JumpToLatest.tsx`, `scroll/useFollowLatest.ts`; voice transport unchanged |
| Lesson authority | `services/e-learning/classroom/lesson.ts`, `state.ts`, classroom `actions.ts`, `LessonEditor.tsx`, `TeacherRoom.tsx` |
| Classroom assistant | `services/e-learning/classroom/stuwart.ts`, classroom `[sessionId]/stuwart/route.ts`, `ClassroomStuwart.tsx`, `StudentRoom.tsx` |
| Conversation namespace | `services/e-learning/student/stewart/conversations.ts` |
| Persistence | Four additive ClassroomSession fields in E-learning schema; `prisma/elearning/patches/20261116_classroom_stuwart.sql` |
| Focused verification | New platform navigation/classroom service/route/dashboard tests, `tests/platform/` fixture, `scripts/verify-platform-changes.cjs`, updated analytics/Marketplace expectations, three `test:platform*` npm scripts |
| Naming | Visible copy throughout Study Zone/services/voice/test harnesses/docs; compatibility exceptions in naming report |

No Main Menu / AI Studio exclusive backend, provider, job or data table was found to delete. Their pages were placeholder UI. No financial model, payment flow, enrollment policy, provider credential or Core schema was removed. The working tree already contained substantial Marketplace rollout changes; these were preserved rather than treated as newly authored by this task.

## Final findings

- Dashboard's incorrect destination was a single student constant, shared by mobile and desktop; exact active matching already existed. The change preserves this behavior and exposes aria-current consistently.
- Classroom initially lacked authoritative current lesson metadata. It now requires an explicit lecturer selection instead of guessing context.
- The provider supports course/week retrieval, not live media or document-only retrieval. These limits are visible and documented.
- Stable old-name identifiers remain intentionally; visible branding is Stuwart. Old saved messages remain unmodified.
- Verification completed: 52 unit/route, 23 local database, 9 Chromium interaction checks; typecheck/lint/diff checks passed. Full suite intentionally not run.
- Migration applied locally and subsequently to the configured Supabase E-learning database; live provider/media acceptance and deployment remain release prerequisites. The earlier unrelated Marketplace promotion hold remains unchanged.
