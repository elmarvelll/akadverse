// services/e-learning/faculty/materials/list-materials.ts
//
// Documents of one offering in week order.

import { elearningDb } from "@/lib/db/elearning";

export async function listMaterials(courseOfferingId: string) {
  return elearningDb.courseMaterial.findMany({ where: { courseOfferingId }, orderBy: [{ startWeek: "asc" }, { createdAt: "asc" }] });
}
