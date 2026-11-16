# Stuwart naming migration

Verified 16 November 2026. The visible assistant name is **Stuwart**.

## Changed

- Study Zone headings, loading states, chat labels, prompts, accessible names, suggestions and error messages.
- Mobile Study Zone tab: explicit `Stuwart` label instead of capitalizing the legacy state key.
- Voice recording/privacy copy and Send button accessible names.
- Server-generated conversation/history labels and assistant-facing prompt prose.
- Relevant tests, browser harness labels and documentation prose.
- Canonical panel file/component: `src/app/e-learning/student/study-zone/_components/StuwartPanel.tsx`; imports updated in StudyWorkspace and test harnesses.
- New classroom assistant and its API use the new spelling.

Existing saved messages are not rewritten. A user-authored or previously generated message may still contain the old name.

## Intentional compatibility exceptions

| Existing identifier | Why it remains |
|---|---|
| `/api/e-learning/stewart/**` | Existing browser/provider clients keep their API contract. New classroom route uses `/stuwart`. |
| `services/e-learning/student/stewart`, `src/lib/stewart`, client `stewart.ts` | Stable module namespace used throughout persistence, attachments and revision integration. |
| `StewartAttachment`, `elearningDb.stewartAttachment` | Existing database model/table and generated client; no destructive rename or data migration. |
| `StewartContext`, `StewartMessage`, `StewartTurn`, `StewartRequestError`, `STEWART_*`, `askStewart`, `explainStewart` and related helper names | Internal typed contracts, constants and integrations; their visible text uses Stuwart. |
| Message role `stewart` | Existing history normalization and microservice-compatible turn type. |
| Mobile panel key/data attribute `stewart` | Existing CSS/state contract; visible label maps explicitly to Stuwart. |
| DOM IDs `stewart-input`, `stewart-hint`, `stewart-voice-status` | Existing label/description associations and automation. |
| Lower-case log namespaces, test/fixture/doc filenames | Stable operational and reference paths. |

No provider credentials, API endpoints, HMAC behavior, attachment/session ownership rules or stored conversation IDs were renamed. Lower-case legacy namespaces must not be treated as visible branding defects.

## Verification

A whole-word case-sensitive scan of `src` (excluding generated Prisma code) and `services` found no remaining `Stewart` prose. Compound identifiers intentionally remain as listed above. Focused learning renderer, conversation and speech tests pass. Old persisted content and private/deployed assets outside this working tree were not rewritten.
