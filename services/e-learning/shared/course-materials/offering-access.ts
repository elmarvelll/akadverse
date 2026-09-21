// services/e-learning/shared/course-materials/offering-access.ts
//
// Shared building blocks for course documents: the storage bucket name, storage-path slugging, loading an offering with
// its session/semester, and the check that a faculty member is assigned to THAT offering.

import { elearningDb } from "@/lib/db/elearning";
import { forbidden, notFound } from "@/lib/service-error";

export const BUCKET = () => process.env.SUPABASE_COURSE_MATERIALS_BUCKET ?? "Akadverdse documents";

export const slug = (s: string) => s.replace(/[^\w-]+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "") || "x";

// The offering plus what's needed to build its storage folder and week count.
export async function loadOffering(courseOfferingId: string) {
  const o = await elearningDb.courseOffering.findUnique({
    where: { id: courseOfferingId },
    include: { curriculumCourse: { include: { course: true, curriculum: { include: { academicSession: true, semester: true, programme: true } } } } },
  });
  if (!o) throw notFound("That course offering doesn't exist.");
  return o;
}

// The caller must be a lecturer or coordinator OF THIS offering.
export async function requireLecturer(facultyUserId: string, courseOfferingId: string) {
  const link = await elearningDb.courseOfferingLecturer.findUnique({ where: { courseOfferingId_facultyUserId: { courseOfferingId, facultyUserId } } });
  if (!link) throw forbidden("You're not assigned to this course.");
  return link;
}
