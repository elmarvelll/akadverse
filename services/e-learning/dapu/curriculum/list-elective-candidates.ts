// services/e-learning/dapu/curriculum/list-elective-candidates.ts
//
// The courses "Select Elective Course" offers on the DAPU Course Structure page.

import { elearningDb } from "@/lib/db/elearning";

// University-created courses = operational Courses whose code is not a CCMAS course code
// (created through Add Course). These are what Select Elective Course offers.
export async function listElectiveCandidates() {
  const ccmasCodes = (await elearningDb.cCMASCourse.findMany({ distinct: ["code"], select: { code: true } })).map((c) => c.code);
  return elearningDb.course.findMany({
    where: { isActive: true, code: { notIn: ccmasCodes } },
    orderBy: { code: "asc" },
    select: { id: true, code: true, title: true, creditUnits: true, description: true },
  });
}
