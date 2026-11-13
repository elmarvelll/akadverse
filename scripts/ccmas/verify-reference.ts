/** Read-only verification of the staged edition against the exact extracted source. */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { createHash } from "node:crypto";
import { elearningDb as db } from "../../src/lib/db/elearning";
const path = process.argv[2] ?? "src/lib/resources/ccmas/Engineering-CCMAS-2023.json";
const source = JSON.parse(readFileSync(path, "utf8"));
const fields = ["semester", "statusLetter", "courseType", "creditUnits", "duration", "prerequisites", "description", "learningOutcomes", "sourcePage", "detailPage"];
async function main() {
  const document = await db.cCMASDocument.findUniqueOrThrow({ where: { name_version: { name: source.source.name, version: source.source.version } }, include: { batches: true, courses: true, disciplines: { include: { programmes: { include: { courses: { include: { course: true } } } } } } } });
  if (document.sha256 !== source.source.sha256 || !document.batches.some(b => b.jsonSha256 === createHash("sha256").update(readFileSync(path)).digest("hex"))) throw new Error("Source provenance/import receipt differs.");
  const programmes = document.disciplines.flatMap(d => d.programmes);
  const expected = source.disciplines.flatMap((d: {programmes: {name: string; code: string; courses: Record<string, unknown>[]}[]}) => d.programmes);
  if (programmes.length !== expected.length) throw new Error("Programme count differs.");
  let placements = 0;
  for (const programme of expected) {
    const actual = programmes.find(p => p.name === programme.name);
    if (!actual || actual.code !== programme.code || actual.courses.length !== programme.courses.length) throw new Error(`Programme mismatch: ${programme.name}`);
    for (const row of programme.courses) {
      const match = actual.courses.find(c => c.course.code === row.code && c.level === row.level);
      if (!match || match.titleAsListed !== row.title) throw new Error(`Placement mismatch: ${programme.name}/${row.code}`);
      for (const key of fields) if (JSON.stringify((match as unknown as Record<string, unknown>)[key]) !== JSON.stringify(row[key])) throw new Error(`Field mismatch: ${programme.name}/${row.code}/${key}`);
      for (const key of ["lectureHours", "practicalHours"] as const) if (match[key] !== (typeof row[key] === "number" ? row[key] : null)) throw new Error(`Hours mismatch: ${programme.name}/${row.code}`);
      placements++;
    }
  }
  const first = new Map<string, Record<string, unknown>>();
  for (const programme of expected) for (const row of programme.courses) if (!first.has(String(row.code))) first.set(String(row.code), row);
  if (document.courses.length !== first.size || document.courses.some(c => c.title !== first.get(c.code)?.title || c.creditUnits !== first.get(c.code)?.creditUnits)) throw new Error("Course identities differ from first-listed source values.");
  const report = { verifiedAt: new Date().toISOString(), documentId: document.id, sourceSha256: document.sha256, programmes: programmes.length, courses: document.courses.length, placements, sourceWarnings: source.warnings.length, policy: "Course tables take precedence; DAPU source-review warnings retained", scope: "Read-only stored-field comparison against extracted source JSON; source PDF SHA separately recorded" };
  mkdirSync(".elearning-reset", { recursive: true, mode: 0o700 });
  const output = `.elearning-reset/reference-verification-${Date.now()}.json`;
  writeFileSync(output, JSON.stringify(report, null, 2), { flag: "wx", mode: 0o600 });
  console.log(JSON.stringify(report));
  console.log(`Verification receipt: ${output}`);
}
main().catch(error => { console.error(error instanceof Error ? error.message : "Reference verification failed"); process.exitCode = 1; }).finally(() => db.$disconnect());
