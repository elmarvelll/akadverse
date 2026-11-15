/** Read-only E-Learning inventory. Contains personal data: output stays gitignored. */
import { mkdirSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { elearningDb as db } from "../../src/lib/db/elearning";
import { Prisma } from "../../src/generated/prisma-elearning";

const preserve = new Set(["AcademicSession", "Semester", "College", "Department", "Programme", "StudentProfile", "FacultyProfile", "HodProfile", "DapuProfile", "AcademicRule", "LevelAdvisorAssignment", "LevelAdvisorAssignmentChange"]);
const reference = new Set(["CCMASDocument", "CCMASImportBatch", "CCMASDiscipline", "CCMASProgramme", "CCMASCourse", "CCMASProgrammeCourse"]);
const review = new Set(["LearningResource", "Syllabus", "CourseMaterial", "AiIngestTask", "Course", "Curriculum", "CurriculumCourse", "CourseOffering", "AcademicTimeFrame"]);

async function main() {
  if (process.argv.includes("--execute")) throw new Error("Inventory is read-only. Reset execution is not implemented by this command.");
  const inventory = await db.$transaction(async tx => {
    await tx.$executeRawUnsafe("SET TRANSACTION READ ONLY");
    const available = new Set((await tx.$queryRawUnsafe<{tablename: string}[]>("SELECT tablename FROM pg_tables WHERE schemaname = 'public'")).map(t => t.tablename));
    const models = [];
    for (const model of Prisma.dmmf.datamodel.models) {
      const delegate = model.name[0].toLowerCase() + model.name.slice(1);
      const missing = !available.has(model.dbName ?? model.name);
      // Inventory metadata only; long teaching/chat text belongs in a verified backup.
      const excluded = new Set(["description", "learningOutcomes", "overview", "philosophy", "objectives", "content", "body", "metadata"]);
      const select = reference.has(model.name) ? { id: true } : Object.fromEntries(model.fields.filter(f => f.kind !== "object" && !excluded.has(f.name)).map(f => [f.name, true]));
      const rows = missing ? [] : await (tx as unknown as Record<string, { findMany(args: unknown): Promise<unknown[]> }>)[delegate].findMany({ select });
      console.log(`${model.name}: ${missing ? "MISSING TABLE" : rows.length}`);
      models.push({ missing, model: model.name, table: model.dbName ?? model.name,
        disposition: preserve.has(model.name) ? "preserve" : reference.has(model.name) ? "preserve-versioned-reference" : review.has(model.name) ? "review" : "reset-candidate",
        count: rows.length, rows,
        dependencies: model.fields.filter(f => f.kind === "object" && f.relationFromFields?.length).map(f => ({ target: f.type, fields: f.relationFromFields, onDelete: f.relationOnDelete ?? "schema-default" })),
      });
    }
    const policies = await tx.$queryRawUnsafe('SELECT schemaname, tablename, policyname, roles::text AS roles, cmd, qual, with_check FROM pg_policies');
    const rls = await tx.$queryRawUnsafe("SELECT n.nspname AS schema, c.relname AS table, c.relrowsecurity AS enabled, c.relforcerowsecurity AS forced FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE c.relkind='r' AND n.nspname IN ('public','storage')");
    const privileges = await tx.$queryRawUnsafe("SELECT grantee, table_schema, table_name, privilege_type FROM information_schema.role_table_grants WHERE table_schema IN ('public','storage')");
    return { createdAt: new Date().toISOString(), models, policies, rls, privileges };
  }, { timeout: 300_000, maxWait: 20_000, isolationLevel: "RepeatableRead" });
  const material = inventory.models.find(m => m.model === "CourseMaterial")!;
  const report = { ...inventory, storage: { status: "database-references-only; live bucket listing still required", materials: material.rows },
    blockers: ["Inventory approval required before reset", "Lecturer source-file retention/deletion decision required", "Verified database and object backup/restore required", "New source extraction and programme-level validation required", "Do not delete AiIngestTask cleanup jobs", "Core ELEARNING notifications require a separate scoped review; Core is not accessed here"] };
  mkdirSync(".elearning-reset", { recursive: true, mode: 0o700 });
  const raw = JSON.stringify(report, null, 2);
  const file = `.elearning-reset/inventory-${Date.now()}.json`;
  writeFileSync(file, raw, { mode: 0o600, flag: "wx" });
  console.table(inventory.models.map(({ model, count, disposition }) => ({ model, count, disposition })));
  console.log(`Private report: ${file}\nSHA256: ${createHash("sha256").update(raw).digest("hex")}`);
}
main().catch(e => { console.error(e instanceof Error ? e.name + ": inventory failed; inspect connectivity and schema availability" : "Inventory failed", (e as {code?: string}).code, (e as {meta?: {code?: string; message?: string}}).meta); process.exitCode = 1; }).finally(() => db.$disconnect());
