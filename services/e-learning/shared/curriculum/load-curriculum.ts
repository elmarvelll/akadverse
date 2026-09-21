// services/e-learning/shared/curriculum/load-curriculum.ts
//
// Loads one curriculum with its programme/semester/session/courses and builds its display label.

import { elearningDb } from "@/lib/db/elearning";
import { notFound } from "@/lib/service-error";

export async function loadCurriculum(id: string) {
  const c = await elearningDb.curriculum.findUnique({
    where: { id },
    include: { programme: true, semester: true, academicSession: true, courses: true },
  });
  if (!c) throw notFound("Curriculum not found.");
  return c;
}

export const label = (c: Awaited<ReturnType<typeof loadCurriculum>>) => `${c.programme.name} — ${c.academicSession.name} ${c.semester.name}`;
