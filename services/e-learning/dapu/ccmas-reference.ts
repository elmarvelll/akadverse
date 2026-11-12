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
    orderBy: { name: "asc" },
    select: { id: true, name: true, code: true, discipline: { select: { document: { select: { version: true } } } } },
  });
}

export async function linkCcmasProgramme(programmeId: string, ccmasProgrammeId: string | null) {
  if (ccmasProgrammeId && !(await elearningDb.cCMASProgramme.findUnique({ where: { id: ccmasProgrammeId } }))) {
    throw badRequest("That CCMAS programme doesn't exist.");
  }
  if (!(await elearningDb.programme.findUnique({ where: { id: programmeId } }))) throw notFound("Programme not found.");
  return elearningDb.programme.update({ where: { id: programmeId }, data: { ccmasProgrammeId } });
}
