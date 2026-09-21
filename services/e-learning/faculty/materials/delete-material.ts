// services/e-learning/faculty/materials/delete-material.ts
//
// Lecturer deletes a document: the Storage object first (so a failure never orphans a file), then the database row.

import { elearningDb } from "@/lib/db/elearning";
import { notFound } from "@/lib/service-error";
import { removeObject } from "@/lib/storage/supabase-storage";
import { requireLecturer } from "@/services/e-learning/shared/course-materials/offering-access";

export async function deleteMaterial(facultyUserId: string, materialId: string) {
  const m = await elearningDb.courseMaterial.findUnique({ where: { id: materialId } });
  if (!m) throw notFound("That material doesn't exist.");
  await requireLecturer(facultyUserId, m.courseOfferingId);
  await removeObject(m.storageBucket, m.storagePath); // storage first: if it fails, the record stays and nothing is orphaned
  await elearningDb.courseMaterial.delete({ where: { id: m.id } });
}
