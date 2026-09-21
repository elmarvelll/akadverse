// services/e-learning/level-adviser/registrations.ts
//
// Level Adviser review of course registrations. The adviser's scope is their Level Advisor
// ASSIGNMENT — Programme + Level in the current Academic Session (see hod/level-advisors.ts) — so
// they only ever see/act on students of that exact programme and level. Scope is resolved from the
// database every time; nothing the browser claims about a student/programme/level is trusted.
//
//   PENDING_LEVEL_ADVISOR --(approve / approve all)--> PENDING_HOD   (HOD is notified)
//   PENDING_LEVEL_ADVISOR --(reject)-->               REJECTED       (student is notified)
//
// The DAPU-controlled Course Registration period also governs the adviser: once it has ended (or
// before it starts) every adviser decision is refused, on the server. The next step is the HOD's
// (hod/registration-approvals.ts) — there is no DAPU step.

import { elearningDb } from "@/lib/db/elearning";
import { conflict, forbidden, notFound } from "@/lib/service-error";
import { resolveIdentities, fullName, notifyUsers } from "@/services/e-learning/shared/identity";
import { getTimeFrame } from "@/services/e-learning/shared/timeframes";
import type { CurrentAcademicContext } from "@/services/e-learning/shared/academic-calendar";
import type { FacultyProfile } from "@/generated/prisma-elearning";

// The adviser's current assignment (Programme + Level), only if it's for this session.
async function adviserScope(adviser: FacultyProfile, sessionId: string) {
  if (!adviser.levelAdvisorId) return null;
  const a = await elearningDb.levelAdvisorAssignment.findUnique({ where: { id: adviser.levelAdvisorId } });
  return a && a.academicSessionId === sessionId ? { programmeId: a.programmeId, level: a.level } : null;
}

async function assertPeriodActive(sessionId: string, semesterId: string) {
  const t = await getTimeFrame("COURSE_REGISTRATION", sessionId, semesterId);
  if (t.phase === "ACTIVE") return;
  throw forbidden(
    t.phase === "UPCOMING" ? "Course registration hasn't opened yet, so registrations can't be reviewed." : t.phase === "ENDED" ? "Course registration is closed, so registrations can no longer be approved or rejected." : "Course registration is not currently available."
  );
}

type Status = "PENDING_LEVEL_ADVISOR" | "PENDING_HOD" | "APPROVED" | "REJECTED";

async function scopedRegistrations(adviser: FacultyProfile, academicContext: CurrentAcademicContext | null, statuses: Status[]) {
  if (!academicContext?.session || !academicContext.semester) return [];
  const scope = await adviserScope(adviser, academicContext.session.id);
  if (!scope) return [];

  const studentsInScope = await elearningDb.studentProfile.findMany({
    where: { programmeId: scope.programmeId, level: scope.level },
    select: { userId: true, matricNumber: true },
  });
  if (studentsInScope.length === 0) return [];

  const registrations = await elearningDb.courseRegistration.findMany({
    where: {
      studentUserId: { in: studentsInScope.map((s) => s.userId) },
      academicSessionId: academicContext.session.id,
      semesterId: academicContext.semester.id,
      status: { in: statuses },
    },
    include: { items: { include: { course: true } } },
    orderBy: { submittedAt: "asc" },
  });
  const identities = await resolveIdentities(registrations.map((r) => r.studentUserId));
  const matric = new Map(studentsInScope.map((s) => [s.userId, s.matricNumber]));
  return registrations.map((r) => ({ ...r, studentName: fullName(identities.get(r.studentUserId)), matricNumber: matric.get(r.studentUserId) ?? null }));
}

// Every registration in scope, any status — the "Course Registrations" view.
export async function getRegistrationsInScope(adviser: FacultyProfile, academicContext: CurrentAcademicContext | null) {
  return scopedRegistrations(adviser, academicContext, ["PENDING_LEVEL_ADVISOR", "PENDING_HOD", "APPROVED", "REJECTED"]);
}

export async function getPendingApprovals(adviser: FacultyProfile, academicContext: CurrentAcademicContext | null) {
  return scopedRegistrations(adviser, academicContext, ["PENDING_LEVEL_ADVISOR"]);
}

// ---------------------------------------------------------------------------
// The review screen: for each pending registration, the student's context and a course-by-course
// comparison of the FULL applicable curriculum against what they submitted. CORE / ELECTIVE /
// OPTIONAL are respected: only an unselected CORE course counts as "missing required"; an
// unselected elective or optional course is simply "Not Selected".
// ---------------------------------------------------------------------------
export async function getReviewQueue(adviser: FacultyProfile, academicContext: CurrentAcademicContext | null) {
  if (!academicContext?.session || !academicContext.semester) return { state: "NO_CONTEXT" as const };
  const scope = await adviserScope(adviser, academicContext.session.id);
  if (!scope) return { state: "NO_SCOPE" as const };

  const [programme, period, curriculumRows, rule] = await Promise.all([
    elearningDb.programme.findUniqueOrThrow({ where: { id: scope.programmeId }, include: { department: true } }),
    getTimeFrame("COURSE_REGISTRATION", academicContext.session.id, academicContext.semester.id),
    elearningDb.curriculumCourse.findMany({
      where: { level: scope.level, curriculum: { programmeId: scope.programmeId, academicSessionId: academicContext.session.id, semesterId: academicContext.semester.id, status: "PUBLISHED" } },
      include: { course: true },
      orderBy: { course: { code: "asc" } },
    }),
    elearningDb.academicRule.findUnique({ where: { programmeId_level_semesterId: { programmeId: scope.programmeId, level: scope.level, semesterId: academicContext.semester.id } } }),
  ]);
  const curriculum = curriculumRows.map((r) => ({ courseId: r.courseId, code: r.course.code, title: r.course.title, creditUnits: r.creditUnits, courseType: r.courseType }));
  const requiredCore = curriculum.filter((c) => c.courseType === "CORE");

  const pending = await getPendingApprovals(adviser, academicContext);
  const profiles = await elearningDb.studentProfile.findMany({ where: { userId: { in: pending.map((p) => p.studentUserId) } }, select: { userId: true, level: true } });
  const levelOf = new Map(profiles.map((p) => [p.userId, p.level]));

  const registrations = pending.map((r) => {
    const submitted = new Set(r.items.map((i) => i.courseId));
    const inCurriculum = new Map(curriculum.map((c) => [c.courseId, c]));
    const rows = [
      ...curriculum.map((c) => ({ ...c, status: submitted.has(c.courseId) ? ("Submitted" as const) : ("Not Selected" as const) })),
      // Submitted but no longer in the published structure (it may have been changed): shown, never hidden.
      ...r.items.filter((i) => !inCurriculum.has(i.courseId)).map((i) => ({ courseId: i.courseId, code: i.course.code, title: i.course.title, creditUnits: i.course.creditUnits, courseType: null, status: "Submitted (not in current structure)" as const })),
    ];
    const submittedRows = rows.filter((x) => x.status !== "Not Selected");
    const notSelected = rows.filter((x) => x.status === "Not Selected");
    return {
      id: r.id,
      studentName: r.studentName,
      matricNumber: r.matricNumber,
      level: levelOf.get(r.studentUserId) ?? scope.level,
      submittedAt: r.submittedAt,
      rows,
      summary: {
        applicableCourses: curriculum.length,
        submittedCourses: submittedRows.length,
        notSelectedCourses: notSelected.length,
        requiredCoreCourses: requiredCore.length,
        missingCore: notSelected.filter((x) => x.courseType === "CORE").map((x) => x.code),
        curriculumUnits: curriculum.reduce((n, c) => n + c.creditUnits, 0),
        requiredCoreUnits: requiredCore.reduce((n, c) => n + c.creditUnits, 0),
        submittedUnits: submittedRows.reduce((n, x) => n + x.creditUnits, 0),
      },
    };
  });

  return {
    state: "READY" as const,
    context: { department: programme.department.name, programme: `${programme.name} (${programme.code})`, level: scope.level, session: academicContext.session.name ?? "", semester: academicContext.semester.name ?? "" },
    period: { phase: period.phase, startAt: period.startAt, endAt: period.endAt },
    rule: rule ? { min: rule.minCreditUnits, max: rule.maxCreditUnits } : null,
    registrations,
  };
}

// ---------------------------------------------------------------------------
// Decisions
// ---------------------------------------------------------------------------
async function inScope(adviser: FacultyProfile, registrationId: string) {
  const registration = await elearningDb.courseRegistration.findUnique({ where: { id: registrationId } });
  if (!registration) throw notFound("Registration not found.");
  if (registration.status !== "PENDING_LEVEL_ADVISOR") throw forbidden("This registration isn't awaiting Level Advisor review.");

  const scope = await adviserScope(adviser, registration.academicSessionId);
  const studentProfile = await elearningDb.studentProfile.findUnique({ where: { userId: registration.studentUserId } });
  if (!scope || !studentProfile || studentProfile.programmeId !== scope.programmeId || studentProfile.level !== scope.level) {
    throw forbidden("This student isn't in your Level Advisor scope.");
  }
  return { registration, studentProfile };
}

export async function approveRegistration(adviser: FacultyProfile, registrationId: string) {
  const { registration, studentProfile } = await inScope(adviser, registrationId);
  await assertPeriodActive(registration.academicSessionId, registration.semesterId);
  // Conditional update: a concurrent decision can't be applied twice.
  const { count } = await elearningDb.courseRegistration.updateMany({ where: { id: registrationId, status: "PENDING_LEVEL_ADVISOR" }, data: { status: "PENDING_HOD" } });
  if (count !== 1) throw conflict("This registration was just updated by someone else.");
  const hod = await elearningDb.hodProfile.findUnique({ where: { departmentId: studentProfile.departmentId } });
  if (hod) {
    await notifyUsers([hod.userId], {
      type: "REGISTRATION_PENDING_HOD",
      title: "Course registration awaiting HOD approval",
      message: `A ${studentProfile.level} Level registration was approved by the Level Advisor and needs your approval.`,
      link: "/e-learning/hod/approvals/course-registration",
    });
  }
  return registration;
}

// Approve every eligible registration in this adviser's scope, now. The set is computed on the server
// from the adviser's own assignment (never from ids the browser sends), and updated atomically.
export async function approveAll(adviser: FacultyProfile, academicContext: CurrentAcademicContext | null) {
  if (!academicContext?.session || !academicContext.semester) throw forbidden("Your academic session isn't set up yet.");
  const scope = await adviserScope(adviser, academicContext.session.id);
  if (!scope) throw forbidden("You have no Level Advisor assignment for the current session.");
  await assertPeriodActive(academicContext.session.id, academicContext.semester.id);

  const students = await elearningDb.studentProfile.findMany({ where: { programmeId: scope.programmeId, level: scope.level }, select: { userId: true, departmentId: true } });
  const pending = await elearningDb.courseRegistration.findMany({
    where: { studentUserId: { in: students.map((s) => s.userId) }, academicSessionId: academicContext.session.id, semesterId: academicContext.semester.id, status: "PENDING_LEVEL_ADVISOR" },
    select: { id: true },
  });
  if (pending.length === 0) return { approved: 0 };

  const { count } = await elearningDb.courseRegistration.updateMany({
    where: { id: { in: pending.map((p) => p.id) }, status: "PENDING_LEVEL_ADVISOR" },
    data: { status: "PENDING_HOD" },
  });
  if (count > 0) {
    const deptId = students[0]?.departmentId;
    const hod = deptId ? await elearningDb.hodProfile.findUnique({ where: { departmentId: deptId } }) : null;
    if (hod) {
      await notifyUsers([hod.userId], {
        type: "REGISTRATION_PENDING_HOD",
        title: "Course registrations awaiting HOD approval",
        message: `The Level Advisor approved ${count} ${scope.level} Level registration${count === 1 ? "" : "s"}; they need your approval.`,
        link: "/e-learning/hod/approvals/course-registration",
      });
    }
  }
  return { approved: count };
}

export async function rejectRegistration(adviser: FacultyProfile, registrationId: string, note: string | null) {
  const { registration } = await inScope(adviser, registrationId);
  await assertPeriodActive(registration.academicSessionId, registration.semesterId);
  const { count } = await elearningDb.courseRegistration.updateMany({ where: { id: registrationId, status: "PENDING_LEVEL_ADVISOR" }, data: { status: "REJECTED", decidedAt: new Date(), decisionNote: note } });
  if (count !== 1) throw conflict("This registration was just updated by someone else.");
  await notifyUsers([registration.studentUserId], {
    type: "REGISTRATION_REJECTED",
    title: "Course registration rejected",
    message: `Your course registration was rejected by your Level Advisor${note ? `: ${note}` : "."} You can register again while registration is open.`,
    link: "/e-learning/student/course-control/registration",
  });
  return registration;
}
