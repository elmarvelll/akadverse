/** Explicit reviewed reset runner. Default is an offline dry run; never runs at startup. */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { createHash } from "node:crypto";
import { PrismaClient as CoreClient } from "@prisma/client";
import { elearningDb as db } from "../../src/lib/db/elearning";
import { removeMaterialFromAi } from "../../services/e-learning/ai-ingest/ingest-material";
import { requestDelete, requestDocumentStatus, requestAttachmentDelete, AiServiceError } from "../../services/e-learning/ai-ingest/client";
import { removeObject, getObjectSize } from "../../src/lib/storage/supabase-storage";

type Row = Record<string, unknown>;
type InventoryModel = { model: string; table: string; missing: boolean; rows: Row[] };
type Delegate = { findMany(args?: unknown): Promise<Row[]>; deleteMany(args: unknown): Promise<{ count: number }> };
const sha = (raw: string | Buffer) => createHash("sha256").update(raw).digest("hex");
const canonical = (rows: Row[]) => JSON.stringify(rows.map(row => Object.fromEntries(Object.entries(JSON.parse(JSON.stringify(row)) as Row).sort(([a], [b]) => a.localeCompare(b)))).sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b))));
const resetOrder = ["ChatMessage", "ChatConversation", "StewartAttachment", "ClassroomPollResponse", "ClassroomQuestionVote", "ClassroomQuestion", "ClassroomPoll", "ClassroomSession", "CourseRegistrationItem", "CourseRegistration", "StudentCourseRegistration", "Result", "CourseOfferingLecturer", "CourseOfferingDay", "CourseAssignment", "TimetableEntry"];
const delegate = (client: unknown, model: string) => (client as Record<string, Delegate>)[model[0].toLowerCase() + model.slice(1)];
const value = (flag: string) => process.argv[process.argv.indexOf(flag) + 1];

async function main() {
  if (process.argv.includes("--dry-run") && process.argv.includes("--execute")) throw new Error("Choose dry-run or execute; conflicting modes are refused.");
  if (!process.argv.includes("--plan")) throw new Error("Provide --plan PATH. Default mode is offline dry-run. Execution requires --execute, --approved-plan-sha, --backup, --core-inventory and either --maintenance-confirmed or explicitly authorized --online mode.");
  const planPath = value("--plan");
  const raw = readFileSync(planPath, "utf8");
  const plan = JSON.parse(raw);
  const planSha = sha(raw);
  if (!process.argv.includes("--execute")) {
    console.log(`OFFLINE DRY RUN. No database/Storage/AI changes.\nPlan SHA256: ${planSha}`);
    console.table(plan.resetOrder.map((row: { model: string; count: number; missingTable: boolean }) => ({ model: row.model, count: row.count, missingTable: row.missingTable })));
    console.log(`Source files: ${plan.materials.length}; archive curricula: ${plan.archiveCurricula.length}. DAPU allocates semesters; HOD approves before student registration.`);
    return;
  }
  if ((!process.argv.includes("--maintenance-confirmed") && !process.argv.includes("--online")) || !process.argv.includes("--approved-plan-sha") || value("--approved-plan-sha") !== planSha) throw new Error("Reviewed plan hash plus maintenance confirmation or explicitly authorized online mode are required.");
  if (!process.argv.includes("--backup") || !process.argv.includes("--core-inventory")) throw new Error("Verified backup and Core preservation inventory are required.");
  const manifest = JSON.parse(readFileSync(value("--backup"), "utf8"));
  if (!manifest.restoreVerified || sha(readFileSync(manifest.dumpPath)) !== manifest.dumpSha256) throw new Error("Backup restore verification or checksum failed.");
  const inventoryRaw = readFileSync(manifest.inventoryPath, "utf8");
  if (sha(inventoryRaw) !== plan.inventorySha256) throw new Error("Backup and reviewed reset plan belong to different inventories.");
  for (const object of manifest.objects) if (sha(readFileSync(object.file)) !== object.sha256) throw new Error("Source-file backup checksum failed.");
  const inventory = JSON.parse(inventoryRaw) as { models: InventoryModel[] };
  const models = new Map(inventory.models.map(m => [m.model, m]));
  if (canonical(plan.resetOrder.map((m: { model: string; records: Row[] }) => ({ model: m.model, records: m.records }))) !== canonical(resetOrder.map(model => ({ model, records: models.get(model)?.rows ?? [] })))) throw new Error("Plan deletion scope differs from the audited model whitelist.");
  if (canonical(plan.materials.map((m: {materialId: string}) => ({id: m.materialId}))) !== canonical(models.get("CourseMaterial")!.rows.map(m => ({id: m.id})))) throw new Error("Material plan differs from audited inventory.");
  if (canonical(plan.archiveCurricula.map((c: {id: string}) => ({id: c.id}))) !== canonical(models.get("Curriculum")!.rows.map(c => ({id: c.id})))) throw new Error("Curriculum archive plan differs from audited inventory.");
  const coreRaw = readFileSync(value("--core-inventory"), "utf8");
  if (!plan.coreInventory || sha(coreRaw) !== plan.coreInventory.sha256) throw new Error("Core inventory is not bound to the reviewed plan.");
  const coreSnapshot = JSON.parse(coreRaw);
  const core = new CoreClient();
  const journalPath = `${planPath}.execution.json`;
  const journal = existsSync(journalPath) ? JSON.parse(readFileSync(journalPath, "utf8")) : { planSha, files: {}, attachments: {}, databaseDone: false, coreDone: false };
  if (journal.planSha !== planSha) throw new Error("Execution journal belongs to a different plan.");
  const save = () => writeFileSync(journalPath, JSON.stringify({ ...journal, updatedAt: new Date().toISOString() }, null, 2), { mode: 0o600 });
  const checkIdentity = async () => {
    const users = await core.user.findMany({ select: { id: true, firstName: true, lastName: true, email: true, password: true, role: true, isAdmin: true }, orderBy: { id: "asc" } });
    const identities = users.map(({ id, role, ...identity }) => ({ id, role, fingerprint: sha(JSON.stringify({ id, role, ...identity })) }));
    if (canonical(identities) !== canonical(coreSnapshot.identities)) throw new Error("Core identity drift: stop and refresh the preservation inventory.");
  };
  const assertRows = async (client: unknown, model: string) => {
    const snapshot = models.get(model);
    if (!snapshot || snapshot.missing) return;
    const select = snapshot.rows[0] ? Object.fromEntries(Object.keys(snapshot.rows[0]).map(k => [k, true])) : { id: true };
    // Composite-key tables have no id. An empty snapshot still needs a real row-count check.
    const rows = await delegate(client, model).findMany(snapshot.rows.length ? { select } : undefined);
    if (canonical(rows) !== canonical(snapshot.rows)) throw new Error(`Inventory drift in ${model}; no further reset actions permitted.`);
  };
  try {
    await checkIdentity();
    const tables = new Set((await db.$queryRawUnsafe<{tablename: string}[]>("SELECT tablename FROM pg_tables WHERE schemaname='public'")).map(t => t.tablename));
    for (const model of models.values()) if (model.missing && tables.has(model.table)) throw new Error(`Schema drift: ${model.model} now exists; refresh the inventory.`);
    const target = await db.cCMASDocument.findUnique({ where: { name_version: { name: "NUC/CCMAS", version: "2023" } }, include: { batches: true, disciplines: { include: { programmes: true } } } });
    if (!target || target.sha256 !== plan.sourceSha256 || !target.batches.length) throw new Error("New reference import is not complete and verified.");
    const references = target.disciplines.flatMap(d => d.programmes);
    const [courseCount, placementCount] = await Promise.all([
      db.cCMASCourse.count({ where: { documentId: target.id } }),
      db.cCMASProgrammeCourse.count({ where: { programme: { discipline: { documentId: target.id } } } }),
    ]);
    if (!plan.referenceCounts || references.length !== plan.referenceCounts.programmes || courseCount !== plan.referenceCounts.courses || placementCount !== plan.referenceCounts.placements) throw new Error("Staged reference counts differ from the reviewed source.");
    const programmeSnapshot = models.get("Programme")!.rows;
    const remap = programmeSnapshot.map(p => {
      const matches = references.filter(r => r.code === p.code);
      if (matches.length !== 1 || !["EEE", "CPE", "ICE"].includes(String(p.code))) throw new Error("Programme remapping requires manual review.");
      return { id: String(p.id), ccmasProgrammeId: matches[0].id };
    });
    // Recover a crash after SQL commit but before the filesystem journal write.
    if (!journal.databaseDone && existsSync(journalPath) && plan.materials.every((m: {materialId: string}) => journal.files[m.materialId])) {
      const remaining: Row[][] = [];
      for (const model of resetOrder.filter(m => !models.get(m)?.missing)) remaining.push(await delegate(db, model).findMany());
      const archived = await db.curriculum.count({ where: { id: { in: plan.archiveCurricula.map((c: {id: string}) => c.id) }, status: "ARCHIVED" } });
      const linked = await db.programme.count({ where: { OR: remap } });
      if (remaining.every(rows => rows.length === 0) && archived === plan.archiveCurricula.length && linked === remap.length && await db.courseMaterial.count() === 0) { journal.databaseDone = true; save(); }
    }
    if (!journal.databaseDone) {
      for (const pending of models.get("AiIngestTask")!.rows.filter(t => t.operation === "DELETE" && t.state !== "DONE" && t.materialId === null)) {
        const task = await db.aiIngestTask.findUniqueOrThrow({where:{documentId:String(pending.documentId)}});
        if (task.cleanupUncertain || (task.leaseUntil && task.leaseUntil > new Date())) throw new Error("AI cleanup is busy or uncertain; retry after its lease ends.");
        await requestDelete(task.documentId);
        try { await requestDocumentStatus(task.documentId); throw new Error("AI document still exists"); }
        catch (error) { if (!(error instanceof AiServiceError && error.status === 404)) throw error; }
        await db.aiIngestTask.updateMany({where:{id:task.id,operation:"DELETE",claimToken:task.claimToken},data:{state:"DONE",lastError:null,leaseUntil:null,claimToken:null}});
      }
      for (const model of [...resetOrder, "CourseMaterial", "Curriculum", "Programme", "Department", "College", "StudentProfile", "FacultyProfile", "HodProfile", "DapuProfile", "AcademicRule", "LevelAdvisorAssignment", "LevelAdvisorAssignmentChange"]) await assertRows(db, model);
      for (const material of plan.materials) {
        if (journal.files[material.materialId]) continue;
        const row = await db.courseMaterial.findUniqueOrThrow({ where: { id: material.materialId } });
        const objectBackup = manifest.objects.find((o: { materialId: string; bucket: string; path: string }) => o.materialId === row.id && o.bucket === row.storageBucket && o.path === row.storagePath);
        if (!objectBackup || row.storageBucket !== material.bucket || row.storagePath !== material.path) throw new Error("Material scope or backup mismatch.");
        await removeMaterialFromAi(row);
        const cleanup = await db.aiIngestTask.findUnique({ where: { documentId: row.id } });
        if (cleanup) {
          if (cleanup.cleanupUncertain || (cleanup.leaseUntil && cleanup.leaseUntil > new Date())) throw new Error("AI worker cancellation/lease needs review before source deletion.");
          await requestDelete(row.id);
          try { await requestDocumentStatus(row.id); throw new Error("Deleted AI document still has a status record."); }
          catch (error) { if (!(error instanceof AiServiceError && error.status === 404)) throw error; }
          await db.aiIngestTask.update({ where: { id: cleanup.id }, data: { operation: "DELETE", state: "DONE", lastError: null, leaseUntil: null, claimToken: null } });
        }
        await removeObject(row.storageBucket, row.storagePath);
        if (await getObjectSize(row.storageBucket, row.storagePath) !== null) throw new Error("Storage object remains after deletion.");
        journal.files[row.id] = { deletedAt: new Date().toISOString(), aiVerified: Boolean(cleanup), storageVerified: true };
        save();
      }
      for (const attachment of models.get("StewartAttachment")!.rows) {
        if (!attachment.attachmentId || journal.attachments[String(attachment.id)]) continue;
        await requestAttachmentDelete(String(attachment.attachmentId));
        journal.attachments[String(attachment.id)] = true;
        save();
      }
      await db.$transaction(async tx => {
        await tx.$executeRawUnsafe("SET LOCAL lock_timeout = '10s'");
        const lockModels = [...new Set([...resetOrder, "CourseMaterial", "Curriculum", "Programme", "Department", "College", "StudentProfile", "FacultyProfile", "HodProfile", "DapuProfile", "AcademicRule", "LevelAdvisorAssignment", "LevelAdvisorAssignmentChange"])].filter(m => !models.get(m)?.missing);
        await tx.$executeRawUnsafe('LOCK TABLE ' + lockModels.map(m => 'public."' + models.get(m)!.table.replaceAll('"','""') + '"').sort().join(', ') + ' IN SHARE ROW EXCLUSIVE MODE');
        for (const model of [...resetOrder, "CourseMaterial", "Curriculum", "Programme", "Department", "StudentProfile", "FacultyProfile", "HodProfile", "DapuProfile"]) await assertRows(tx, model);
        for (const model of resetOrder) {
          if (models.get(model)?.missing) continue;
          // Complete-table equality was checked above; no unreviewed new rows can be silently included.
          await delegate(tx, model).deleteMany({});
        }
        await tx.courseMaterial.deleteMany({ where: { id: { in: plan.materials.map((m: { materialId: string }) => m.materialId) } } });
        await tx.curriculum.updateMany({ where: { id: { in: plan.archiveCurricula.map((c: { id: string }) => c.id) } }, data: { status: "ARCHIVED" } });
        for (const programme of remap) await tx.programme.update({ where: { id: programme.id }, data: { ccmasProgrammeId: programme.ccmasProgrammeId } });
      }, { isolationLevel: "Serializable", timeout: 300000 });
      journal.databaseDone = true;
      save();
    }
    if (!journal.coreDone) {
      await core.$transaction(async tx => {
        const existing = await tx.notification.findMany({ where: { scope: "ELEARNING" }, select: { id: true } });
        if (canonical(existing) !== canonical(coreSnapshot.notifications.map((n: { id: string }) => ({ id: n.id })))) throw new Error("E-Learning notification inventory drift; academic reset committed but scoped notification cleanup is pending.");
        await tx.notification.deleteMany({ where: { scope: "ELEARNING", id: { in: existing.map(n => n.id) } } });
      }, { isolationLevel: "Serializable", timeout: 60000 });
      journal.coreDone = true;
      save();
    }
    await checkIdentity();
    for (const model of resetOrder) if (!models.get(model)?.missing && (await delegate(db, model).findMany()).length) throw new Error(`Post-reset records remain in ${model}.`);
    journal.verifiedAt = new Date().toISOString();
    save();
    console.log("Reviewed reset completed; identity fingerprints preserved. DAPU must allocate and HOD must approve new curricula before students register.");
  } finally { await core.$disconnect(); }
}
main().catch(error => { console.error(error instanceof Error ? error.message.replace(/postgres(?:ql)?:\/\/\S+/g, "[redacted]") : "Reset failed; inspect private journal and retry the same approved plan."); process.exitCode = 1; }).finally(() => db.$disconnect());
