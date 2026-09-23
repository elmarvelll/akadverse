// services/e-learning/dapu/curriculum/get-structure-view.ts
//
// Read model for the DAPU Course Structure page: the programme's CCMAS course list at one level, what is
// already selected, and where else each course already sits (information only, never a block).

import { elearningDb } from "@/lib/db/elearning";
import { resolveContext, currentCurriculum, EDITABLE, type StructureContext } from "@/services/e-learning/dapu/curriculum/context";

export async function getStructureView(ctx: StructureContext) {
  const { programme, semester, session } = await resolveContext(ctx);
  const curriculum = await currentCurriculum(programme.id, session.id, semester.id);

  const ccmasRows = programme.ccmasProgrammeId
    ? await elearningDb.cCMASProgrammeCourse.findMany({
        where: { programmeId: programme.ccmasProgrammeId, level: ctx.level },
        include: { course: { select: { code: true } } },
        orderBy: { course: { code: "asc" } },
      })
    : [];

  const selected = curriculum
    ? await elearningDb.curriculumCourse.findMany({
        where: { curriculumId: curriculum.id },
        include: { course: true },
        orderBy: [{ level: "asc" }, { course: { code: "asc" } }],
      })
    : [];
  const selectedCodes = new Set(selected.map((s) => s.course.code));

  // "Already handled" is judged per programme + session + semester: the same
  // course elsewhere (another semester) is shown as information, never blocked.
  const codes = ccmasRows.map((r) => r.course.code);
  const elsewhere = codes.length
    ? await elearningDb.curriculumCourse.findMany({
        where: {
          course: { code: { in: codes } },
          curriculum: { programmeId: programme.id, status: { not: "ARCHIVED" }, ...(curriculum ? { id: { not: curriculum.id } } : {}) },
        },
        select: { course: { select: { code: true } }, curriculum: { select: { status: true, academicSession: { select: { name: true } }, semester: { select: { name: true } } } } },
      })
    : [];
  const elsewhereByCode = new Map<string, string[]>();
  for (const e of elsewhere) {
    const list = elsewhereByCode.get(e.course.code) ?? [];
    list.push(`${e.curriculum.academicSession.name} ${e.curriculum.semester.name} (${e.curriculum.status.replaceAll("_", " ").toLowerCase()})`);
    elsewhereByCode.set(e.course.code, list);
  }

  return {
    programme,
    semester,
    session,
    curriculum,
    editable: !curriculum || EDITABLE.includes(curriculum.status),
    selectedElectiveIds: selected.filter((x) => x.source === "UNIVERSITY" && x.level === ctx.level).map((x) => x.courseId),
    ccmasCourses: ccmasRows.map((r) => ({
      id: r.id, code: r.course.code, title: r.titleAsListed, creditUnits: r.creditUnits, level: r.level,
      statusLetter: r.statusLetter, courseType: r.courseType, lectureHours: r.lectureHours, practicalHours: r.practicalHours,
      duration: r.duration, prerequisites: r.prerequisites, description: r.description, sourcePage: r.sourcePage,
      alreadySelected: selectedCodes.has(r.course.code),
      elsewhere: elsewhereByCode.get(r.course.code) ?? [],
    })),
    selected: selected.map((s) => ({
      id: s.id, code: s.course.code, title: s.course.title, creditUnits: s.creditUnits, level: s.level,
      courseType: s.courseType, source: s.source,
    })),
  };
}
