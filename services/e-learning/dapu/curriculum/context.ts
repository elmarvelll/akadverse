// services/e-learning/dapu/curriculum/context.ts
//
// Shared context for the Course Structure workflow (split across this folder):
//   context.ts (this file) · get-structure-view · list-elective-candidates · save-course-selection
//   load-curriculum · level-advisor-checklist · publish-structures · list-structures-for-review
//   and the HOD half in hod/curriculum-review.ts.
//
// Course Structure workflow — DAPU builds the operational curriculum for
// Programme + Level + Session + Semester, then submits it to the HOD:
//
//   (DAPU: Save Courses) --> SAVED --(DAPU: Publish to HOD)--> PENDING_HOD
//   PENDING_HOD --(HOD approves)--> PUBLISHED  (students can now register; no further DAPU step)
//   PENDING_HOD --(HOD returns)--> RETURNED --(DAPU edits + Save Courses)--> SAVED
// There is no draft state: nothing is stored until DAPU presses Save Courses.
//
// Courses reach a curriculum two ways, and that source is recorded on the
// CurriculumCourse: picked from the CCMAS reference (source CCMAS) or added by
// the university (source UNIVERSITY, incl. electives). CCMAS data is only ever
// read here — it never creates a curriculum by itself (spec §58). Every id from
// the client is re-validated against the database; nothing is trusted.

import { elearningDb } from "@/lib/db/elearning";
import { badRequest } from "@/lib/service-error";
import type { CurriculumCourseType, CurriculumStatus } from "@/generated/prisma-elearning";

export interface StructureContext {
  collegeId: string;
  departmentId: string;
  programmeId: string;
  level: number;
  academicSessionId: string;
  semesterId: string;
}

// The chain College -> Department -> Programme and Session -> Semester must be
// a real chain in the database, not just five independently valid ids.
export async function resolveContext(ctx: StructureContext) {
  if (!Number.isInteger(ctx.level) || ctx.level < 100 || ctx.level > 600 || ctx.level % 100 !== 0) {
    throw badRequest("Level must be 100, 200, 300, 400, 500 or 600.");
  }
  const [programme, semester] = await Promise.all([
    elearningDb.programme.findUnique({ where: { id: ctx.programmeId }, include: { department: true, ccmasProgramme: true } }),
    elearningDb.semester.findUnique({ where: { id: ctx.semesterId }, include: { academicSession: true } }),
  ]);
  if (!programme || programme.departmentId !== ctx.departmentId || programme.department.collegeId !== ctx.collegeId) {
    throw badRequest("The college, department and programme don't match.");
  }
  if (!semester || semester.academicSessionId !== ctx.academicSessionId) {
    throw badRequest("That semester doesn't belong to the selected academic session.");
  }
  return { programme, semester, session: semester.academicSession };
}

// The working curriculum for a context: the newest version that isn't archived.
// A structure can be changed before it reaches the HOD, after the HOD returns it, or after it was published.
// PUBLISHED is editable too, but a real change to it is a "reopen": the structure goes back to the HOD
// for re-approval and the affected students' registrations are cleared (see saveCourseSelection).
export const EDITABLE: CurriculumStatus[] = ["SAVED", "RETURNED", "PUBLISHED"];
export type Db = Pick<typeof elearningDb, "curriculum">;

export async function currentCurriculum(programmeId: string, academicSessionId: string, semesterId: string, db: Db = elearningDb) {
  return db.curriculum.findFirst({
    where: { programmeId, academicSessionId, semesterId, status: { not: "ARCHIVED" } },
    orderBy: { version: "desc" },
  });
}

// CCMAS status letter -> the existing course-type enum. Values not in the
// enum's vocabulary (e.g. "R" required) map to CORE; nothing else is guessed.
export function courseTypeFromLetter(letter: string): CurriculumCourseType {
  if (letter === "E") return "ELECTIVE";
  if (letter === "O") return "OPTIONAL";
  return "CORE";
}
