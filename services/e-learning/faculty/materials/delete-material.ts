// services/e-learning/faculty/materials/delete-material.ts
//
// Delete the exact Storage object first, then persist AI cleanup before removing
// the material row. The durable task survives via its nullable relation.

import { elearningDb } from "@/lib/db/elearning";
import { notFound } from "@/lib/service-error";
import { removeObject } from "@/lib/storage/supabase-storage";
import { requireLecturer } from "@/services/e-learning/shared/course-materials/offering-access";
import { removeMaterialFromAi } from "@/services/e-learning/ai-ingest/ingest-material";

export async function deleteMaterial(facultyUserId: string, materialId: string) {
  const m = await elearningDb.courseMaterial.findUnique({ where: { id: materialId } });
  if (!m) throw notFound("That material doesn't exist.");
  await requireLecturer(facultyUserId, m.courseOfferingId);
  await removeObject(m.storageBucket, m.storagePath); // storage first: if it fails, the record stays and nothing is orphaned
  await removeMaterialFromAi(m);
  await elearningDb.courseMaterial.deleteMany({ where: { id: m.id } });
  const cleanup = await elearningDb.aiIngestTask.findUnique({ where: { documentId: m.id } });
  return { cleanupPending: cleanup?.operation === "DELETE" && cleanup.state !== "DONE" };
}
