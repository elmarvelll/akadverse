// services/e-learning/dapu/ccmas-reference.ts
//
// Selector data + the explicit Programme -> CCMAS programme link for the DAPU
// Course Structure page. Reference only — nothing here writes to Course/
// Curriculum (spec §58); the link is a DAPU decision, never matched by name.

import { elearningDb } from "@/lib/db/elearning";
import { badRequest, notFound } from "@/lib/service-error";

export async function getAcademicTree() {
  return elearningDb.college.findMany({
    orderBy: { name: "asc" },
    select: {
      id: true, code: true, name: true,
      departments: {
        orderBy: { name: "asc" },
        select: { id: true, name: true, programmes: { orderBy: { name: "asc" }, select: { id: true, code: true, name: true, ccmasProgrammeId: true } } },
      },
    },
  });
}

export async function listCcmasProgrammes() {
  return elearningDb.cCMASProgramme.findMany({
    // A completed import batch is the reference's publication checkpoint.
    // Keep partially staged editions out of DAPU's linking options.
    where: { discipline: { document: { batches: { some: {} } } } },
    orderBy: { name: "asc" },
    select: { id: true, name: true, code: true, discipline: { select: { document: { select: { version: true } } } } },
  });
}

export async function linkCcmasProgramme(programmeId: string, ccmasProgrammeId: string | null) {
  if (ccmasProgrammeId && !(await elearningDb.cCMASProgramme.findFirst({ where: { id: ccmasProgrammeId, discipline: { document: { batches: { some: {} } } } } }))) {
    throw badRequest("That CCMAS programme doesn't exist or its import hasn't completed.");
  }
  if (!(await elearningDb.programme.findUnique({ where: { id: programmeId } }))) throw notFound("Programme not found.");
  return elearningDb.programme.update({ where: { id: programmeId }, data: { ccmasProgrammeId } });
}
