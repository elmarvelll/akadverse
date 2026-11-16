# Classroom Stuwart implementation

## Student workflow

In a live classroom, select **Stuwart** at the bottom right. A responsive panel slides in with the lecturer's current topic/week, a conversation, input, loading state and error recovery. Close or Escape returns focus to the launcher. The panel is non-modal: the classroom remains available outside it. Desktop width is capped at 26rem; mobile uses available viewport width and dynamic viewport height. Animations use the existing Framer Motion dependency and respect reduced motion at mount.

Close/reopen retains the draft and restores completed saved messages for the same student/class/lesson. Reload restores the latest 50 completed messages. A lecturer changing the lesson closes/resets the panel into a new lesson context; old records remain stored, but are not blended into the new conversation. The existing classroom poll, questions, LiveKit session and presenter controls remain independent of AI failure.

## Lecturer workflow and authoritative context

`LessonEditor.tsx` lets an assigned lecturer set a topic (1–200 characters), valid course week and optional material for that week. The server checks assignment, course ownership, material week range, live status and an optimistic version counter. A concurrent edit requires reload. Saving increments the version and creates a separate student conversation scope. No client-supplied course, student ID, document scope or provider session is trusted.

Without a configured lesson, the panel explains that the lecturer has not selected one and keeps Send disabled. It does not guess from the newest upload or course title.

## Service and API flow

1. `GET/POST /api/e-learning/classroom/[sessionId]/stuwart` require a student session and academic profile.
2. `requireLiveStudentClassroom` checks the classroom exists, is LIVE and the student's course registration grants access.
3. `studentLesson` loads the authoritative offering, topic/week and eligible material metadata. Private storage paths and lecturer-only records are not returned to the browser.
4. The server upserts an owned `ChatConversation` with `clientKey=classroom:<sessionId>:lesson:<version>` and a unique provider session UUID.
5. POST validates a 2,400-character question, UUID request ID, expected lesson version and a maximum 16,000-byte raw JSON body. Existing per-student chat rate limiting is shared with Study Zone.
6. Existing `reserveMessage` row locking, lease and idempotency machinery prevent concurrent/duplicate message completion. A completed retry returns the saved answer without another provider call.
7. Existing `requestExplanation` calls the same course/week `/explain` provider, with bounded server-loaded conversation history and an explicit lesson/limitations prompt.
8. Enrollment, live status and lesson version are checked again after the provider responds. A changed lesson cannot receive the old answer. Provider failure releases the message claim for retry.
9. Existing `completeMessage` persists both roles and metadata atomically. Only source IDs currently in the authorized course/week survive; source titles come from trusted material metadata.

Study Zone list/read/delete and attachment/message context paths cannot repurpose classroom conversations through their legacy endpoints. Client UUID creation keys cannot enter the server-assigned classroom namespace. Private responses use `Cache-Control: no-store`.

## Grounding limits

The provider contract accepts course offering and week, not a selected-document-only filter. Selecting a material provides its title as lesson context; retrieval may cover other authorized materials in that week. The UI says this honestly. The assistant has no access to live audio, video, shared screens, current slide position, handwriting or diagrams. Students must describe or quote such content. The prompt requires disclosure when evidence is insufficient and separates general explanation from retrieved evidence. These instructions do not establish empirical model accuracy: live provider answer quality still needs a lecturer-led acceptance check.

The shared response renderer retains Markdown/math handling and sanitization. No parallel model SDK, vector database, upload system or speech pipeline was introduced.

## Database and rollout

No new tables. Additive fields on `ClassroomSession`:

| Field | Purpose |
|---|---|
| `lessonTopic TEXT NULL` | Lecturer-selected topic |
| `lessonWeekNumber INTEGER NULL` | Current week, constrained to 1–366 when present |
| `lessonDocumentId TEXT NULL` | Optional material reference, validated in the service |
| `lessonVersion INTEGER NOT NULL DEFAULT 0` | Conversation isolation and optimistic edits |

Existing `ChatConversation` and `ChatMessage` store the assistant exchange. No old message or attachment data is rewritten.

Patch: [`../../prisma/elearning/patches/20261116_classroom_stuwart.sql`](../../prisma/elearning/patches/20261116_classroom_stuwart.sql) relative to repo root; the direct path is `prisma/elearning/patches/20261116_classroom_stuwart.sql`.

Initially applied against the localhost test database; subsequently applied and verified against the configured Supabase E-learning database on 16 November 2026. See [migration receipt](CLASSROOM_MIGRATION_RECEIPT.json). The E-learning client was regenerated. For another environment, apply that patch to its E-learning database before deploying the code, then regenerate its E-learning client/build. Use the established E-learning migration connection, not the Core Marketplace database. Example after securely selecting the target environment:

```sh
npx prisma db execute --schema prisma/elearning/schema.prisma --file prisma/elearning/patches/20261116_classroom_stuwart.sql
npx prisma generate --schema prisma/elearning/schema.prisma
```

No new secret is required; the existing concept-explainer service configuration is reused. The additive E-learning migration is complete on the configured Supabase target. No application deployment was performed. The earlier held Marketplace deployment remains held for its separate delivery-code compatibility issue.
