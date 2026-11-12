// scripts/ccmas/import-ccmas.ts
//
// Step 2 of the CCMAS pipeline:  PDF -> JSON -> (validate + import) -> DB.
// Loads the JSON written by scripts/ccmas/extract_ccmas.py into the CCMAS*
// reference tables. Idempotent: re-running reports NEW / UPDATED / UNCHANGED
// per record and never duplicates. Older documents/versions are never
// deleted (spec §63). Reference data is never linked to, or written into,
// the operational Course/Curriculum tables (spec §58).
//
// Run:  npm run db:ccmas:import [-- path/to/file.json] [--dry-run]

import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { elearningDb as db } from "../../src/lib/db/elearning";

const DEFAULT_JSON = "src/lib/resources/ccmas/Engineering-CCMAS.json";

type Tally = { new: number; updated: number; unchanged: number };
const tally = (): Tally => ({ new: 0, updated: 0, unchanged: 0 });

interface JsonCourse {
  code: string;
  title: string;
  creditUnits: number;
  courseType: string;
  statusLetter: string;
  level: number;
  semester: string | null;
  lectureHours: number | string | null;
  practicalHours: number | string | null;
  duration: string | null;
  prerequisites: string | null;
  description: string | null;
  learningOutcomes: string[];
  sourcePage: number;
  detailPage: number | null;
}
interface JsonProgramme {
  name: string;
  degree: string | null;
  code: string | null;
  sourcePages: { start: number; end: number };
  overview: string | null;
  philosophy: string | null;
  objectives: string | null;
  minimumCreditUnits: number | null;
  courses: JsonCourse[];
}
interface CcmasJson {
  source: { name: string; title?: string; document: string; version: string | null; sha256?: string; pageCount?: number };
  disciplines: { name: string; programmes: JsonProgramme[] }[];
  warnings: string[];
}

// -- validation (spec §59) ---------------------------------------------------
function validate(doc: CcmasJson): string[] {
  const errors: string[] = [];
  if (!doc.source?.name || !doc.source?.version) errors.push("source.name and source.version are required");
  for (const d of doc.disciplines ?? []) {
    const seenProg = new Set<string>();
    for (const p of d.programmes) {
      if (!p.name) errors.push(`discipline "${d.name}": programme without a name`);
      if (seenProg.has(p.name)) errors.push(`duplicate programme "${p.name}"`);
      seenProg.add(p.name);
      const seen = new Set<string>();
      for (const c of p.courses) {
        const where = `${p.name} / ${c.code}`;
        if (!/^[A-Z]{3} \d{3}$/.test(c.code)) errors.push(`${where}: malformed course code`);
        if (!c.title?.trim()) errors.push(`${where}: empty title`);
        if (!Number.isInteger(c.creditUnits) || c.creditUnits < 0) errors.push(`${where}: invalid credit units`);
        if (![100, 200, 300, 400, 500, 600].includes(c.level)) errors.push(`${where}: unexpected level ${c.level}`);
        if (!c.sourcePage) errors.push(`${where}: missing source page`);
        const key = `${c.code}|${c.level}`;
        if (seen.has(key)) errors.push(`${where}: duplicate programme-course at level ${c.level}`);
        seen.add(key);
      }
    }
  }
  return errors;
}

const intOrNull = (v: number | string | null) => (typeof v === "number" ? v : null);
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

async function main() {
  const args = process.argv.slice(2).filter((a) => !a.startsWith("--"));
  const dryRun = process.argv.includes("--dry-run");
  const jsonPath = args[0] ?? DEFAULT_JSON;
  const raw = readFileSync(jsonPath, "utf8");
  const doc = JSON.parse(raw) as CcmasJson;

  const errors = validate(doc);
  if (errors.length) {
    console.error(`Validation failed (${errors.length}):\n - ${errors.slice(0, 30).join("\n - ")}`);
    process.exit(1);
  }
  console.log(`Validated ${jsonPath}: ${doc.disciplines.length} discipline(s), ${doc.warnings.length} extraction warning(s) kept in the JSON.`);
  if (dryRun) return;

  const jsonSha = createHash("sha256").update(raw).digest("hex");
  const T = { document: tally(), discipline: tally(), programme: tally(), course: tally(), programmeCourse: tally() };

  const version = doc.source.version!;
  const existingDoc = await db.cCMASDocument.findUnique({ where: { name_version: { name: doc.source.name, version } } });
  const docData = {
    title: doc.source.title ?? null,
    source: doc.source.name,
    fileReference: doc.source.document,
    sha256: doc.source.sha256 ?? null,
    pageCount: doc.source.pageCount ?? null,
  };
  const document = existingDoc
    ? await db.cCMASDocument.update({ where: { id: existingDoc.id }, data: docData })
    : await db.cCMASDocument.create({ data: { name: doc.source.name, version, ...docData } });
  if (existingDoc) T.document.unchanged++;
  else T.document.new++;

  // Preload what already exists for this document so a repeat run is cheap.
  const knownCourses = new Map((await db.cCMASCourse.findMany({ where: { documentId: document.id } })).map((c) => [c.code, c]));

  for (const d of doc.disciplines) {
    const existingDisc = await db.cCMASDiscipline.findUnique({ where: { documentId_name: { documentId: document.id, name: d.name } } });
    const disc = existingDisc ?? (await db.cCMASDiscipline.create({ data: { documentId: document.id, name: d.name } }));
    if (existingDisc) T.discipline.unchanged++;
    else T.discipline.new++;

    for (const p of d.programmes) {
      const pData = {
        code: p.code,
        degree: p.degree,
        overview: p.overview,
        philosophy: p.philosophy,
        objectives: p.objectives,
        minimumCreditUnits: p.minimumCreditUnits,
        sourcePageStart: p.sourcePages.start,
        sourcePageEnd: p.sourcePages.end,
      };
      const ex = await db.cCMASProgramme.findUnique({ where: { disciplineId_name: { disciplineId: disc.id, name: p.name } } });
      let prog;
      if (!ex) {
        prog = await db.cCMASProgramme.create({ data: { disciplineId: disc.id, name: p.name, ...pData } });
        T.programme.new++;
      } else if (Object.entries(pData).some(([k, v]) => !same((ex as Record<string, unknown>)[k], v))) {
        prog = await db.cCMASProgramme.update({ where: { id: ex.id }, data: pData });
        T.programme.updated++;
      } else {
        prog = ex;
        T.programme.unchanged++;
      }

      const existingPc = new Map(
        (await db.cCMASProgrammeCourse.findMany({ where: { programmeId: prog.id } })).map((r) => [`${r.courseId}|${r.level}`, r])
      );

      for (const c of p.courses) {
        // CCMASCourse = identity (first title/units seen for the code in this
        // document); programme-specific wording lives on the programme-course.
        let course = knownCourses.get(c.code);
        if (!course) {
          course = await db.cCMASCourse.create({
            data: { documentId: document.id, code: c.code, title: c.title, creditUnits: c.creditUnits },
          });
          knownCourses.set(c.code, course);
          T.course.new++;
        }

        const data = {
          semester: c.semester,
          statusLetter: c.statusLetter,
          courseType: c.courseType,
          titleAsListed: c.title,
          creditUnits: c.creditUnits,
          lectureHours: intOrNull(c.lectureHours),
          practicalHours: intOrNull(c.practicalHours),
          duration: c.duration,
          prerequisites: c.prerequisites,
          description: c.description,
          learningOutcomes: c.learningOutcomes,
          sourcePage: c.sourcePage,
          detailPage: c.detailPage,
        };
        const row = existingPc.get(`${course.id}|${c.level}`);
        if (!row) {
          await db.cCMASProgrammeCourse.create({ data: { programmeId: prog.id, courseId: course.id, level: c.level, ...data } });
          T.programmeCourse.new++;
        } else if (Object.entries(data).some(([k, v]) => !same((row as Record<string, unknown>)[k], v))) {
          await db.cCMASProgrammeCourse.update({ where: { id: row.id }, data });
          T.programmeCourse.updated++;
        } else {
          T.programmeCourse.unchanged++;
        }
      }
    }
  }

  await db.cCMASImportBatch.create({
    data: {
      documentId: document.id,
      jsonSha256: jsonSha,
      newCount: T.programme.new + T.course.new + T.programmeCourse.new,
      updatedCount: T.programme.updated + T.programmeCourse.updated,
      unchangedCount: T.programme.unchanged + T.programmeCourse.unchanged,
      warningCount: doc.warnings.length,
    },
  });
  console.table(T);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
