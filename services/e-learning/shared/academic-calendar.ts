// services/e-learning/shared/academic-calendar.ts
//
// The one place that resolves "what's the current academic session/
// semester" (AGENTS.md §31) — every dashboard/page that needs to show
// session-scoped data reads it from here instead of hard-coding a session
// string (AGENTS.md §12), and instead of each page repeating its own
// `isCurrent: true` query.

import { elearningDb } from "@/lib/db/elearning";

export interface CurrentAcademicContext {
  session: Awaited<ReturnType<typeof elearningDb.academicSession.findFirst>>;
  semester: Awaited<ReturnType<typeof elearningDb.semester.findFirst>>;
}

// Returns null (not a throw) when nothing's been configured yet — DAPU
// hasn't set a current session, or a fresh environment has no data at all.
// Callers render an empty/"not configured" state for that rather than
// treating it as an error.
export async function getCurrentAcademicContext(): Promise<CurrentAcademicContext | null> {
  const session = await elearningDb.academicSession.findFirst({ where: { isCurrent: true } });
  if (!session) return null;

  const semester = await elearningDb.semester.findFirst({
    where: { academicSessionId: session.id, isCurrent: true },
  });

  return { session, semester };
}
