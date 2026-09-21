# System: Course Documents (Materials)

## Purpose

Lecturers upload course documents (Notes, Assignments, Quizzes) to the weeks of a course they teach; students who are registered for that course open them. Files live in **Supabase Storage**; PostgreSQL (the E-Learning database) holds the metadata and relationships.

## Data

- **`CourseOffering`** — one per `CurriculumCourse` (a course in one programme/level/session/semester), created when the HOD first assigns a lecturer. **`CourseOfferingLecturer`** — the assigned lecturers (`LECTURER` / `COORDINATOR`, exactly one coordinator per offering).
- **`CourseMaterial`** — belongs to a `CourseOffering` (never to the reusable `Course`, so nothing leaks between sessions/semesters). Fields: `title`, `description?`, `type` (`NOTES | ASSIGNMENT | QUIZ`), **`startWeek` / `endWeek`** (a single week has both equal; a range is still **one row**), `fileName`, `mimeType`, `fileSize`, `storageBucket`, `storagePath` (unique), `uploadedByFacultyUserId`.
- DB `CHECK`s (in `prisma/elearning/constraints.sql`): weeks valid (`startWeek ≥ 1`, `endWeek ≥ startWeek`) and `fileSize ≤ 8388608`.
- The number of weeks is **not fixed**: `shared/offering-detail.ts` derives it from the semester's own start/end dates (and never hides a week that already has content).

## Storage

- Bucket (env `SUPABASE_COURSE_MATERIALS_BUCKET`): **`Akadverdse documents`** — private, 8 MB per file, MIME allow-list PDF / ZIP / DOCX / PPTX (enforced by Storage itself as well as by the server).
- Object path: `{session}/{semester}/{offeringId}/{uuid}-{safe-file-name}`. The original name is kept in the database for display; the stored name is sanitised and unique.
- Env (server only, never `NEXT_PUBLIC_`): `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, optional `SUPABASE_COURSE_MATERIALS_BUCKET`. `npm run storage:setup` creates/updates the bucket. The client is `src/lib/storage/supabase-storage.ts`; shared rules (allowed types, 8 MB, week labels) are in `src/lib/course-materials/config.ts` — the 8 MB limit is defined once, there.

## Upload flow (lecturer)

`/e-learning/faculty/my-subjects/[offeringId]` → **Upload Material** (`UploadMaterial.tsx`):

1. `requestUpload` (`faculty/materials/upload-material.ts`) — authenticated faculty, assigned to *that* offering; type, title, week range within the semester, file name/extension/MIME and declared size (≤ 8 MB) validated → returns a one-time signed upload URL.
2. The browser `PUT`s the file straight to Supabase (it never passes through a serverless function, so Vercel's request-size limit doesn't apply).
3. `confirmUpload` — re-authorizes, checks the path is inside that offering's own folder, asks Storage for the object's **real** size and re-enforces 8 MB (an oversize or empty object is deleted), then creates the `CourseMaterial` row. If the row can't be saved the Storage object is removed, so no orphan is left.

Delete (`faculty/materials/delete-material.ts`): assigned lecturer only; the Storage object is deleted first, then the row. Server actions: `src/app/e-learning/faculty/my-subjects/[offeringId]/actions.ts` (they return errors rather than throw so the message reaches the browser).

## Access flow (open a document)

A document is one **clickable row** (`src/app/e-learning/_components/DocumentLink.tsx`, icon chosen from the MIME type; no separate Download button). Clicking calls **`GET /api/e-learning/documents/[id]/access`** (`src/app/api/e-learning/documents/[id]/access/route.ts`), which uses `shared/course-materials/resolve-download.ts#resolveDownload`:

| Caller | Allowed when |
|---|---|
| Faculty | assigned to that offering |
| HOD | the offering's programme is in the HOD's department |
| Student | the student's programme matches, and they hold an **`APPROVED`** `CourseRegistration` containing the course for the offering's session + semester |
| anyone else / not signed in | `403` / `401`; unknown document `404`; file gone from Storage `404` with a clear message |

On success the route returns `{ url }` — a **60-second signed Supabase URL** — and the browser fetches the file directly from Supabase. The service-role key and the storage path are never sent to the browser.

## Where things are

| Concern | File |
|---|---|
| Lecturer pages | `src/app/e-learning/faculty/my-subjects/` |
| Student course page + week slider | `src/app/e-learning/student/my-learning/[courseId]/page.tsx`, `WeekSlider.tsx` |
| Upload / delete / list | `services/e-learning/faculty/materials/` |
| Access authorization | `services/e-learning/shared/course-materials/` |
| Course page read model | `services/e-learning/shared/offering-detail.ts` |
| Verification script | `scripts/verify-course-materials.ts` (local mock Storage by default; `VM_REAL=1` uses the real bucket) |

## Known limits

- A document covers a **contiguous** week range (start..end). Non-adjacent weeks (e.g. 2 and 4 only) need two uploads or a join table.
- The access route and upload form have been exercised through the service functions and (for Storage) against the real bucket; a real-browser click-through is not automated.
