// services/e-learning/faculty/materials/delete-material.ts
//
// Persist AI cleanup before removing the Storage object and material row. The task
// survives via a nullable relation, so an AI outage never prevents original-file deletion.

import { elearningDb } from "@/lib/db/elearning";
import { notFound } from "@/lib/service-error";
import { removeObject } from "@/lib/storage/supabase-storage";
import { requireLecturer } from "@/services/e-learning/shared/course-materials/offering-access";
import { removeMaterialFromAi } from "@/services/e-learning/ai-ingest/ingest-material";

export async function deleteMaterial(facultyUserId: string, materialId: string) {
  const m = await elearningDb.courseMaterial.findUnique({ where: { id: materialId } });
  if (!m) throw notFound("That material doesn't exist.");
  await requireLecturer(facultyUserId, m.courseOfferingId);
  await removeMaterialFromAi(m);
  await removeObject(m.storageBucket, m.storagePath); // storage first: if it fails, the record stays and nothing is orphaned
  await elearningDb.courseMaterial.delete({ where: { id: m.id } });
}
