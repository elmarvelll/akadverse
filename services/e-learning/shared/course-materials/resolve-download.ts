// services/e-learning/shared/course-materials/resolve-download.ts
//
// Who may open a document. Returns a short-lived signed URL, only after authorization: an assigned lecturer, the
// department's HOD, or a student with an APPROVED registration for the offering's course in its session/semester.

import { elearningDb } from "@/lib/db/elearning";
import { forbidden, notFound } from "@/lib/service-error";
import { createSignedDownloadUrl } from "@/lib/storage/supabase-storage";
import { loadOffering, requireLecturer } from "@/services/e-learning/shared/course-materials/offering-access";

export async function resolveDownload(user: { id: string; role: string }, materialId: string) {
  const m = await elearningDb.courseMaterial.findUnique({ where: { id: materialId } });
  if (!m) throw notFound("That material doesn't exist.");
  const o = await loadOffering(m.courseOfferingId);

  if (user.role === "faculty") {
    await requireLecturer(user.id, o.id);
  } else if (user.role === "hod") {
    const hod = await elearningDb.hodProfile.findUnique({ where: { userId: user.id } });
    if (!hod || hod.departmentId !== o.curriculumCourse.curriculum.programme.departmentId) throw forbidden("This material isn't in your department.");
  } else if (user.role === "student") {
    await assertStudentRegistered(user.id, o);
  } else {
    throw forbidden("You don't have access to this material.");
  }
  const url = await createSignedDownloadUrl(m.storageBucket, m.storagePath, m.fileName, 60);
  return { url, fileName: m.fileName };
}

// The student must hold an APPROVED registration for this course in THIS offering's session + semester,
// and belong to the programme the offering is for. Guessing an offering/material id grants nothing.
export async function assertStudentRegistered(studentUserId: string, offering: Awaited<ReturnType<typeof loadOffering>>) {
  const { curriculum, courseId } = offering.curriculumCourse;
  const profile = await elearningDb.studentProfile.findUnique({ where: { userId: studentUserId } });
  if (!profile || profile.programmeId !== curriculum.programmeId) throw forbidden("This course isn't part of your programme.");
  const reg = await elearningDb.courseRegistration.findFirst({
    where: { studentUserId, status: "APPROVED", academicSessionId: curriculum.academicSessionId, semesterId: curriculum.semesterId, items: { some: { courseId } } },
    select: { id: true },
  });
  if (!reg) throw forbidden("You aren't registered for this course.");
}
