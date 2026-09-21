// services/e-learning/student/registration.ts
//
// Course registration.
//
//   Available -> Selected (FRONTEND STATE ONLY) -> "Register Courses" (ONE request)
//   -> PENDING_LEVEL_ADVISOR -> Level Advisor -> PENDING_HOD -> HOD -> APPROVED
//   (DAPU is NOT in this chain: it only controls the registration period.)
//
// Nothing about selecting or removing a course reaches the server or the database — the browser
// keeps `selectedCourses` in memory and sends the whole selection once, in registerCourses().
// Everything below is derived from the authenticated student's profile and the SERVER clock;
// no id, status or time from the browser is trusted:
//   * every course must be in the PUBLISHED curriculum for the student's programme + level +
//     session + semester (the same list the page shows),
//   * the Course Registration period (DAPU-controlled, startAt/endAt) must be ACTIVE,
//   * credit limits from the programme's AcademicRule are enforced,
//   * one registration per student per session+semester (unique in the database); a REJECTED one
//     may be registered again,
//   * viewing never writes.

import { elearningDb } from "@/lib/db/elearning";
import { badRequest, conflict, forbidden, notFound } from "@/lib/service-error";
import { getTimeFrame } from "@/services/e-learning/shared/timeframes";
import { notifyUsers } from "@/services/e-learning/shared/identity";
import type { CurrentAcademicContext } from "@/services/e-learning/shared/academic-calendar";
import type { StudentProfile } from "@/generated/prisma-elearning";

type Ctx = { session: { id: string; name?: string } | null; semester: { id: string; name?: string } | null };
type FullCtx = { session: { id: string }; semester: { id: string } };
const hasContext = (c: Ctx | null): c is FullCtx => !!c?.session && !!c.semester;

// Read-only: never creates a row.
export async function findRegistration(studentUserId: string, academicContext: Ctx | null) {
  if (!hasContext(academicContext)) return null;
  return elearningDb.courseRegistration.findUnique({
    where: { studentUserId_academicSessionId_semesterId: { studentUserId, academicSessionId: academicContext.session.id, semesterId: academicContext.semester.id } },
    include: { items: { include: { course: true }, orderBy: { course: { code: "asc" } } } },
  });
}

// Every registration this student has ever made, any session/semester, newest first. Approved ones are
// history that stays available after the period closes, the session changes, or the level changes.
export async function getRegistrationHistory(studentUserId: string) {
  return elearningDb.courseRegistration.findMany({
    where: { studentUserId },
    include: { academicSession: { select: { name: true } }, semester: { select: { name: true } }, items: { include: { course: true }, orderBy: { course: { code: "asc" } } } },
    orderBy: [{ academicSession: { name: "desc" } }, { semester: { sequence: "desc" } }],
  });
}

// The student's real course list: PUBLISHED curriculum for programme + level + session + semester.
async function curriculumCourses(profile: Pick<StudentProfile, "programmeId" | "level">, ctx: FullCtx) {
  if (!profile.programmeId) return [];
  const rows = await elearningDb.curriculumCourse.findMany({
    where: {
      level: profile.level,
      curriculum: { programmeId: profile.programmeId, academicSessionId: ctx.session.id, semesterId: ctx.semester.id, status: "PUBLISHED" },
    },
    include: { course: true },
    orderBy: { course: { code: "asc" } },
  });
  return rows.map((row) => ({ ...row.course, creditUnits: row.creditUnits, courseType: row.courseType }));
}

// Courses the student may still add (used by Add/Drop).
export async function getEligibleCourses(profile: { programmeId: string | null; level: number }, academicContext: Ctx, excludeCourseIds: string[]) {
  if (!hasContext(academicContext)) return [];
  const all = await curriculumCourses(profile, academicContext);
  const skip = new Set(excludeCourseIds);
  return all.filter((c) => !skip.has(c.id));
}

async function creditRule(profile: Pick<StudentProfile, "programmeId" | "level">, semesterId: string) {
  if (!profile.programmeId) return null;
  return elearningDb.academicRule.findUnique({ where: { programmeId_level_semesterId: { programmeId: profile.programmeId, level: profile.level, semesterId } } });
}

// Everything the registration page needs, in one server call. `state` drives what the UI may show.
// `courses` is the full applicable list; what is "selected" lives only in the browser.
export async function getRegistrationView(profile: StudentProfile, academicContext: CurrentAcademicContext | null) {
  if (!hasContext(academicContext) || !profile.programmeId) return { state: "NO_CONTEXT" as const };

  const [period, registration, courses, rule] = await Promise.all([
    getTimeFrame("COURSE_REGISTRATION", academicContext.session.id, academicContext.semester.id),
    findRegistration(profile.userId, academicContext),
    curriculumCourses(profile, academicContext),
    creditRule(profile, academicContext.semester.id),
  ]);
  const byId = new Map(courses.map((c) => [c.id, c]));
  const registered = (registration?.items ?? []).map((i) => ({
    courseId: i.courseId,
    code: i.course.code,
    title: i.course.title,
    creditUnits: byId.get(i.courseId)?.creditUnits ?? i.course.creditUnits,
    courseType: byId.get(i.courseId)?.courseType ?? null,
  }));
  return {
    state: courses.length === 0 && registered.length === 0 ? ("NO_CURRICULUM" as const) : ("READY" as const),
    period: { phase: period.phase, startAt: period.startAt, endAt: period.endAt },
    registration: registration ? { id: registration.id, status: registration.status, submittedAt: registration.submittedAt, decidedAt: registration.decidedAt, decisionNote: registration.decisionNote } : null,
    courses: courses.map((c) => ({ id: c.id, code: c.code, title: c.title, creditUnits: c.creditUnits, courseType: c.courseType })),
    registered,
    units: { min: rule?.minCreditUnits ?? null, max: rule?.maxCreditUnits ?? null },
  };
}

async function assertPeriodActive(type: "COURSE_REGISTRATION" | "CHANGE_OF_COURSE", ctx: FullCtx) {
  const t = await getTimeFrame(type, ctx.session.id, ctx.semester.id);
  if (t.phase === "ACTIVE") return;
  const what = type === "COURSE_REGISTRATION" ? "Course registration" : "The change-of-course window";
  throw forbidden(t.phase === "UPCOMING" ? `${what} hasn't opened yet.` : t.phase === "ENDED" ? `${what} is closed.` : `${what} is not currently available.`);
}

// "Register Courses": the ONE request that persists a registration. It takes the student's whole
// selection, validates it, and creates the registration + its items atomically as
// PENDING_LEVEL_ADVISOR, then notifies the Level Advisor.
export async function registerCourses(profile: StudentProfile, academicContext: CurrentAcademicContext | null, courseIds: string[]) {
  if (!hasContext(academicContext)) throw badRequest("Your academic information is not available yet.");
  if (!profile.programmeId) throw badRequest("Your programme isn't set on your academic profile.");
  await assertPeriodActive("COURSE_REGISTRATION", academicContext);

  const ids = [...new Set(courseIds.map(String))];
  if (ids.length === 0) throw badRequest("Select at least one course before registering.");

  const existing = await findRegistration(profile.userId, academicContext);
  if (existing && existing.status !== "REJECTED") throw forbidden("You have already registered for this semester.");

  // Every course must be in THIS student's published curriculum — an id from the browser proves nothing.
  const eligible = await curriculumCourses(profile, academicContext);
  const byId = new Map(eligible.map((c) => [c.id, c]));
  if (ids.some((id) => !byId.has(id))) throw forbidden("One or more selected courses aren't part of your published course structure.");

  const total = ids.reduce((n, id) => n + byId.get(id)!.creditUnits, 0);
  const rule = await creditRule(profile, academicContext.semester.id);
  if (rule && total > rule.maxCreditUnits) throw badRequest(`Credit limit exceeded: ${total} of a maximum ${rule.maxCreditUnits} units.`);
  if (rule && total < rule.minCreditUnits) throw badRequest(`You've selected ${total} units; the minimum is ${rule.minCreditUnits}.`);

  const advisor = await elearningDb.levelAdvisorAssignment.findUnique({
    where: { programmeId_level_academicSessionId: { programmeId: profile.programmeId, level: profile.level, academicSessionId: academicContext.session.id } },
  });
  if (!advisor) throw conflict("No Level Advisor has been assigned for your level yet, so your registration can't be reviewed. Please contact your HOD.");

  try {
    await elearningDb.$transaction(async (tx) => {
      if (existing) {
        // Registering again after a rejection: same record, new items, back to the start of the chain.
        const { count } = await tx.courseRegistration.updateMany({
          where: { id: existing.id, status: "REJECTED" },
          data: { status: "PENDING_LEVEL_ADVISOR", submittedAt: new Date(), decidedAt: null, decisionNote: null },
        });
        if (count !== 1) throw conflict("Your registration just changed — refresh and try again.");
        await tx.courseRegistrationItem.deleteMany({ where: { courseRegistrationId: existing.id } });
        await tx.courseRegistrationItem.createMany({ data: ids.map((courseId) => ({ courseRegistrationId: existing.id, courseId })) });
      } else {
        await tx.courseRegistration.create({
          data: {
            studentUserId: profile.userId,
            academicSessionId: academicContext.session.id,
            semesterId: academicContext.semester.id,
            status: "PENDING_LEVEL_ADVISOR",
            submittedAt: new Date(),
            items: { create: ids.map((courseId) => ({ courseId })) },
          },
        });
      }
    });
  } catch (e) {
    // The database is the last line of defence against a double submit (unique student+session+semester).
    if ((e as { code?: string }).code === "P2002") throw conflict("You have already registered for this semester.");
    throw e;
  }

  await notifyUsers([advisor.facultyUserId], {
    type: "REGISTRATION_SUBMITTED",
    title: "Course registration awaiting your review",
    message: `A ${profile.level} Level student registered ${ids.length} course${ids.length === 1 ? "" : "s"} (${total} units) and needs your review.`,
    link: "/e-learning/faculty/level-adviser/approvals",
  });
  return { courses: ids.length, units: total };
}

// ---------------------------------------------------------------------------
// Add/Drop (a separate feature): only for an already APPROVED registration, inside the DAPU
// change-of-course window. Not part of Register Courses.
// ---------------------------------------------------------------------------
export async function addCourse(profile: StudentProfile, academicContext: CurrentAcademicContext | null, courseId: string) {
  if (!hasContext(academicContext)) throw badRequest("No current academic session/semester is set.");
  const reg = await findRegistration(profile.userId, academicContext);
  if (!reg || reg.status !== "APPROVED") throw forbidden("Add/Drop is only available once your registration has been approved.");
  await assertPeriodActive("CHANGE_OF_COURSE", academicContext);
  const course = (await curriculumCourses(profile, academicContext)).find((c) => c.id === courseId);
  if (!course) throw forbidden("That course isn't part of your published course structure.");
  if (reg.items.some((i) => i.courseId === courseId)) throw conflict("That course is already on your registration.");
  await elearningDb.courseRegistrationItem.create({ data: { courseRegistrationId: reg.id, courseId } });
}

export async function removeCourse(studentUserId: string, academicContext: CurrentAcademicContext | null, itemId: string) {
  if (!hasContext(academicContext)) throw badRequest("No current academic session/semester is set.");
  const reg = await findRegistration(studentUserId, academicContext);
  if (!reg || reg.status !== "APPROVED") throw forbidden("Add/Drop is only available once your registration has been approved.");
  await assertPeriodActive("CHANGE_OF_COURSE", academicContext);
  // The item must belong to THIS student's registration — the id alone isn't trusted.
  if (!reg.items.some((i) => i.id === itemId)) throw notFound("That course isn't on your registration.");
  await elearningDb.courseRegistrationItem.delete({ where: { id: itemId } });
}
