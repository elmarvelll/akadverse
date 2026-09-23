// services/e-learning/hod/registration-approvals.ts
//
// HOD — Course Registration approvals (AGENTS.md §23), scoped to the HOD's own department.
//
// PENDING_HOD -> APPROVED (or REJECTED). The HOD's approval is FINAL:
// Student -> Level Adviser -> HOD -> APPROVED (then history / My Learning). There is no DAPU step —
// DAPU only controls the registration period — and no HOD registration period: the HOD may review
// at any time, regardless of whether registration is still open.

import { elearningDb } from "@/lib/db/elearning";
import { forbidden, notFound } from "@/lib/service-error";
import { resolveIdentities, fullName, notifyUsers } from "@/services/e-learning/shared/identity";
import type { CurrentAcademicContext } from "@/services/e-learning/shared/academic-calendar";
import type { HodProfile } from "@/generated/prisma-elearning";

async function departmentStudentUserIds(departmentId: string) {
  const students = await elearningDb.studentProfile.findMany({ where: { departmentId }, select: { userId: true, matricNumber: true } });
  return students;
}

export async function getPendingRegistrationApprovals(hod: HodProfile, academicContext: CurrentAcademicContext | null) {
  if (!academicContext?.session || !academicContext.semester) return [];

  const students = await departmentStudentUserIds(hod.departmentId);
  const studentUserIds = students.map((s) => s.userId);
  if (studentUserIds.length === 0) return [];

  const registrations = await elearningDb.courseRegistration.findMany({
    where: {
      studentUserId: { in: studentUserIds },
      academicSessionId: academicContext.session.id,
      semesterId: academicContext.semester.id,
      status: "PENDING_HOD",
    },
    include: { items: { include: { course: true } } },
  });

  const identities = await resolveIdentities(registrations.map((r) => r.studentUserId));
  const matricByUserId = new Map(students.map((s) => [s.userId, s.matricNumber]));

  return registrations.map((r) => ({
    ...r,
    studentName: fullName(identities.get(r.studentUserId)),
    matricNumber: matricByUserId.get(r.studentUserId) ?? null,
  }));
}

async function assertRegistrationInScope(hod: HodProfile, registrationId: string) {
  const registration = await elearningDb.courseRegistration.findUnique({ where: { id: registrationId } });
  if (!registration) throw notFound("Registration not found.");
  if (registration.status !== "PENDING_HOD") throw forbidden("This registration isn't awaiting HOD approval.");

  const student = await elearningDb.studentProfile.findUnique({ where: { userId: registration.studentUserId } });
  if (!student || student.departmentId !== hod.departmentId) throw forbidden("This student isn't in your department.");
  return registration;
}

export async function approveRegistration(hod: HodProfile, registrationId: string) {
  const registration = await assertRegistrationInScope(hod, registrationId);
  const { count } = await elearningDb.courseRegistration.updateMany({ where: { id: registrationId, status: "PENDING_HOD" }, data: { status: "APPROVED", decidedAt: new Date() } });
  if (count !== 1) throw forbidden("This registration was just updated by someone else.");
  await notifyUsers([registration.studentUserId], {
    type: "REGISTRATION_APPROVED",
    title: "Course registration approved",
    message: "Your course registration has been approved. Your registered courses are now under My Courses.",
    link: "/e-learning/student/my-learning",
  });
}

export async function rejectRegistration(hod: HodProfile, registrationId: string, note: string | null) {
  const registration = await assertRegistrationInScope(hod, registrationId);
  const { count } = await elearningDb.courseRegistration.updateMany({ where: { id: registrationId, status: "PENDING_HOD" }, data: { status: "REJECTED", decidedAt: new Date(), decisionNote: note } });
  if (count !== 1) throw forbidden("This registration was just updated by someone else.");
  await notifyUsers([registration.studentUserId], {
    type: "REGISTRATION_REJECTED",
    title: "Course registration rejected",
    message: `Your course registration was rejected by the HOD${note ? `: ${note}` : "."}`,
    link: "/e-learning/student/course-control/registration-status",
  });
}
