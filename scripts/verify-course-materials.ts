// End-to-end check of: HOD assigns lecturers -> lecturer uploads (Storage + DB) -> student My Learning access.
// Supabase Storage is replaced by a LOCAL MOCK of its REST API (sign / upload / info / delete / sign-download), so the
// real storage client code runs, but real Supabase is NOT exercised. Temp data is created and removed afterwards.
//
// Run: npx tsx --env-file=.env scripts/verify-course-materials.ts

import http from "node:http";
import { elearningDb as db } from "../src/lib/db/elearning";
import { prisma as core } from "../src/lib/prisma";
import { ServiceError } from "../src/lib/service-error";
import { assignLecturer, setCoordinator, listAssignableCourses } from "../services/e-learning/hod/course-offerings";
import { requestUpload, confirmUpload } from "../services/e-learning/faculty/materials/upload-material";
import { deleteMaterial } from "../services/e-learning/faculty/materials/delete-material";
import { resolveDownload } from "../services/e-learning/shared/course-materials/resolve-download";
import { getOfferingDetail } from "../services/e-learning/shared/offering-detail";
import { getRegisteredCourses } from "../services/e-learning/student/registered-courses";
import { getMySubjects } from "../services/e-learning/faculty/my-subjects";
import { CANONICAL_MIME, MAX_MATERIAL_BYTES, extensionOf } from "../src/lib/course-materials/config";
import { getObjectSize, removeObject } from "../src/lib/storage/supabase-storage";

let passed = 0, failed = 0;
const ok = (n: string, c: boolean, x = "") => { if (c) passed++; else failed++; console.log(`${c ? "PASS" : "FAIL"}  ${n}${x ? " — " + x : ""}`); };
async function rejects(n: string, status: number, fn: () => Promise<unknown>, msg?: RegExp) {
  try { await fn(); ok(n, false, "was accepted"); } catch (e) { ok(n, e instanceof ServiceError && e.status === status && (!msg || msg.test(e.message)), e instanceof ServiceError ? `${e.status} ${e.message}` : String(e)); }
}

// ---- mock Supabase Storage ----------------------------------------------------------------------------------------
const objects = new Map<string, Buffer>();
const tokens = new Set<string>();
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url!, "http://x");
  const p = decodeURIComponent(url.pathname).replace(/^\/storage\/v1/, "");
  const chunks: Buffer[] = [];
  for await (const c of req) chunks.push(c as Buffer);
  const body = Buffer.concat(chunks);
  const json = (code: number, o: unknown) => { res.writeHead(code, { "Content-Type": "application/json" }).end(JSON.stringify(o)); };
  const serviceCall = req.headers.authorization === "Bearer test-service-key";
  let m;
  if (req.method === "POST" && (m = p.match(/^\/object\/upload\/sign\/([^/]+)\/(.+)$/))) { if (!serviceCall) return json(401, {}); const t = `t${tokens.size}${Math.random()}`; tokens.add(t); return json(200, { url: `/object/upload/sign/${m[1]}/${m[2]}?token=${t}` }); }
  if (req.method === "PUT" && (m = p.match(/^\/object\/upload\/sign\/([^/]+)\/(.+)$/))) { if (!tokens.delete(url.searchParams.get("token") ?? "")) return json(401, { message: "bad token" }); objects.set(`${m[1]}/${m[2]}`, body); return json(200, { Key: `${m[1]}/${m[2]}` }); }
  if (req.method === "GET" && (m = p.match(/^\/object\/info\/([^/]+)\/(.+)$/))) { if (!serviceCall) return json(401, {}); const o = objects.get(`${m[1]}/${m[2]}`); return o ? json(200, { size: o.length }) : json(404, { message: "not found" }); }
  if (req.method === "DELETE" && (m = p.match(/^\/object\/([^/]+)$/))) { if (!serviceCall) return json(401, {}); for (const k of JSON.parse(body.toString()).prefixes) objects.delete(`${m[1]}/${k}`); return json(200, []); }
  if (req.method === "POST" && (m = p.match(/^\/object\/sign\/([^/]+)\/(.+)$/))) { if (!serviceCall) return json(401, {}); return json(objects.has(`${m[1]}/${m[2]}`) ? 200 : 404, { signedURL: `/object/sign/${m[1]}/${m[2]}?token=dl` }); }
  if (req.method === "GET" && (m = p.match(/^\/object\/sign\/([^/]+)\/(.+)$/))) { const o = objects.get(`${m[1]}/${m[2]}`); if (!o) return json(404, {}); res.writeHead(200).end(o); return; }
  json(404, { message: "no route" });
});

const REAL = process.env.VM_REAL === "1"; // VM_REAL=1: use the real Supabase bucket from .env instead of the local mock
let BUCKET = "course-materials";
// The browser step: PUT the file to the signed URL (exactly what UploadMaterial.tsx does).
const browserPut = (uploadUrl: string, bytes: number, mime = "application/pdf") => fetch(uploadUrl, { method: "PUT", headers: { "Content-Type": mime }, body: Buffer.alloc(bytes, 1) });
const exists = async (path: string) => (REAL ? (await getObjectSize(BUCKET, path)) !== null : objects.has(`${BUCKET}/${path}`));
const tag = `ZZM${Date.now() % 10000}`;

async function main() {
  if (!REAL) {
    await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
    const port = (server.address() as { port: number }).port;
    process.env.SUPABASE_URL = `http://127.0.0.1:${port}`;
    process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-key";
    process.env.SUPABASE_COURSE_MATERIALS_BUCKET = "course-materials";
  }
  BUCKET = process.env.SUPABASE_COURSE_MATERIALS_BUCKET ?? "Akadverdse documents";

  const u = await core.user.findUniqueOrThrow({ where: { email: "marvelousifezue31@stu.cu.edu.ng" } });
  const student = await db.studentProfile.findUniqueOrThrow({ where: { userId: u.id } });
  const session = await db.academicSession.findFirstOrThrow({ where: { isCurrent: true }, include: { semesters: true } });
  const sem = session.semesters.find((s) => !s.isCurrent)!;
  const ctx = { session, semester: sem };
  const prog = await db.programme.findUniqueOrThrow({ where: { id: student.programmeId! } });
  const hod = await db.hodProfile.findUniqueOrThrow({ where: { departmentId: student.departmentId } });
  const otherDept = await db.department.findFirstOrThrow({ where: { id: { not: student.departmentId } } });
  const linked = await db.cCMASProgrammeCourse.findFirstOrThrow({ where: { programmeId: prog.ccmasProgrammeId!, learningOutcomes: { isEmpty: false } } });
  const created = { fac: [] as string[], courses: [] as string[], regId: "" };
  const level = student.level;
  const names = ["VM", "VM draft"];

  try {
    // ---- fixtures -----------------------------------------------------------------------------------------------------
    for (const id of ["vm-lec-1", "vm-lec-2", "vm-lec-3"]) { await db.facultyProfile.create({ data: { userId: id, departmentId: student.departmentId } }); created.fac.push(id); }
    await db.facultyProfile.create({ data: { userId: "vm-lec-x", departmentId: otherDept.id } }); created.fac.push("vm-lec-x");
    const cA = await db.course.create({ data: { code: `${tag} 1`, title: "VM linked course", creditUnits: 3 } });
    const cB = await db.course.create({ data: { code: `${tag} 2`, title: "VM unlinked course", creditUnits: 2 } });
    const cC = await db.course.create({ data: { code: `${tag} 3`, title: "VM unpublished course", creditUnits: 2 } });
    created.courses.push(cA.id, cB.id, cC.id);
    const v = 9000 + (Date.now() % 900);
    const cur = await db.curriculum.create({ data: { programmeId: prog.id, academicSessionId: session.id, semesterId: sem.id, name: "VM", version: v, status: "PUBLISHED", createdByUserId: "vm" } });
    const curDraft = await db.curriculum.create({ data: { programmeId: prog.id, academicSessionId: session.id, semesterId: sem.id, name: "VM draft", version: v + 1000, status: "SAVED", createdByUserId: "vm" } });
    const ccA = await db.curriculumCourse.create({ data: { curriculumId: cur.id, courseId: cA.id, level, creditUnits: 3, ccmasProgrammeCourseId: linked.id } });
    const ccB = await db.curriculumCourse.create({ data: { curriculumId: cur.id, courseId: cB.id, level, creditUnits: 2 } });
    const ccC = await db.curriculumCourse.create({ data: { curriculumId: curDraft.id, courseId: cC.id, level, creditUnits: 2 } });
    const reg = await db.courseRegistration.create({ data: { studentUserId: student.userId, academicSessionId: session.id, semesterId: sem.id, status: "APPROVED", items: { create: [{ courseId: cA.id }, { courseId: cB.id }] } } });
    created.regId = reg.id;

    // ---- HOD assignment -----------------------------------------------------------------------------------------------
    const assignable = await listAssignableCourses(hod, { sessionId: session.id, semesterId: sem.id, programmeId: prog.id, level });
    const ids = JSON.stringify(assignable);
    ok("HOD list includes published courses of the filter", ids.includes(ccA.id) && ids.includes(ccB.id));
    ok("HOD list excludes unpublished (SAVED) courses", !ids.includes(ccC.id));
    await assignLecturer(hod, ccA.id, "vm-lec-1");
    await assignLecturer(hod, ccA.id, "vm-lec-2");
    await rejects("duplicate assignment rejected", 409, () => assignLecturer(hod, ccA.id, "vm-lec-1"));
    await rejects("lecturer from another department rejected", 400, () => assignLecturer(hod, ccA.id, "vm-lec-x"));
    await rejects("unpublished course can't be assigned", 409, () => assignLecturer(hod, ccC.id, "vm-lec-1"));
    await setCoordinator(hod, ccA.id, "vm-lec-1");
    await setCoordinator(hod, ccA.id, "vm-lec-2");
    const offA = await db.courseOffering.findUniqueOrThrow({ where: { curriculumCourseId: ccA.id }, include: { lecturers: true } });
    ok("two lecturers on one offering, exactly one coordinator (last chosen)", offA.lecturers.length === 2 && offA.lecturers.filter((l) => l.role === "COORDINATOR").length === 1 && offA.lecturers.find((l) => l.facultyUserId === "vm-lec-2")!.role === "COORDINATOR");
    await assignLecturer(hod, ccB.id, "vm-lec-1");
    const offB = await db.courseOffering.findUniqueOrThrow({ where: { curriculumCourseId: ccB.id } });

    // ---- faculty My Subjects ------------------------------------------------------------------------------------------
    const s1 = await getMySubjects("vm-lec-1", ctx as never);
    ok("lecturer 1 sees both subjects with role", s1.length === 2 && s1.find((s) => s.code.endsWith(" 1"))?.role === "LECTURER");
    ok("coordinator sees role COORDINATOR", (await getMySubjects("vm-lec-2", ctx as never))[0]?.role === "COORDINATOR");
    ok("unassigned faculty sees nothing", (await getMySubjects("vm-lec-3", ctx as never)).length === 0);

    // ---- uploads ------------------------------------------------------------------------------------------------------
    const meta = (o: Partial<Parameters<typeof requestUpload>[1]> = {}) => ({ courseOfferingId: offA.id, type: "NOTES", title: "Week notes", startWeek: 1, endWeek: 1, fileName: "notes.pdf", size: 1000, ...o });
    await rejects("unassigned lecturer can't upload", 403, () => requestUpload("vm-lec-3", meta()));
    await rejects("lecturer of another offering can't upload here", 403, () => requestUpload("vm-lec-2", meta({ courseOfferingId: offB.id })));
    await rejects("invalid type rejected", 400, () => requestUpload("vm-lec-1", meta({ type: "VIDEO" })));
    await rejects("week 0 rejected", 400, () => requestUpload("vm-lec-1", meta({ startWeek: 0 })));
    await rejects("end before start rejected", 400, () => requestUpload("vm-lec-1", meta({ startWeek: 5, endWeek: 3 })));
    await rejects("week beyond semester rejected", 400, () => requestUpload("vm-lec-1", meta({ endWeek: 999 })));
    await rejects("9 MB declared size rejected", 400, () => requestUpload("vm-lec-1", meta({ size: 9 * 1024 * 1024 })));
    await rejects("8 MB + 1 byte declared rejected", 400, () => requestUpload("vm-lec-1", meta({ size: MAX_MATERIAL_BYTES + 1 })));
    await rejects("disallowed extension rejected", 400, () => requestUpload("vm-lec-1", meta({ fileName: "run.exe" })));

    const upload = async (who: string, o: Partial<Parameters<typeof requestUpload>[1]>, bytes: number) => {
      const m = meta({ ...o, size: Math.min(bytes, MAX_MATERIAL_BYTES) });
      const t = await requestUpload(who, m);
      const put = await browserPut(t.uploadUrl, bytes, CANONICAL_MIME[extensionOf(m.fileName)]);
      return { t, put, m };
    };
    const single = await upload("vm-lec-1", { type: "NOTES", title: "Intro notes", startWeek: 3, endWeek: 3 }, 2000);
    ok("browser PUT to signed URL succeeds", single.put.ok);
    const rowSingle = await confirmUpload("vm-lec-1", { ...single.m, path: single.t.path });
    ok("single-week material saved (start=end=3), size from Storage", rowSingle.startWeek === 3 && rowSingle.endWeek === 3 && rowSingle.fileSize === 2000);
    ok("path/bucket/mime stored; no secret in row", rowSingle.storagePath === single.t.path && rowSingle.storageBucket === BUCKET && rowSingle.mimeType === "application/pdf" && !JSON.stringify(rowSingle).includes("service"));
    const range = await upload("vm-lec-2", { type: "ASSIGNMENT", title: "Assignment 1", startWeek: 5, endWeek: 7 }, 3000);
    const rowRange = await confirmUpload("vm-lec-2", { ...range.m, path: range.t.path });
    ok("week-range material is ONE row (5–7)", rowRange.startWeek === 5 && rowRange.endWeek === 7 && (await db.courseMaterial.count({ where: { courseOfferingId: offA.id } })) === 2);
    const quiz = await upload("vm-lec-1", { type: "QUIZ", title: "Quiz 1", startWeek: 7, endWeek: 7 }, 1500);
    const rowQuiz = await confirmUpload("vm-lec-1", { ...quiz.m, path: quiz.t.path });
    const exactly = await upload("vm-lec-1", { title: "Exactly 8MB", startWeek: 9, endWeek: 9 }, MAX_MATERIAL_BYTES);
    const rowMax = await confirmUpload("vm-lec-1", { ...exactly.m, path: exactly.t.path });
    ok("exactly 8 MB accepted", rowMax.fileSize === MAX_MATERIAL_BYTES);

    // Client lies about size (declares 1 KB, actually uploads 8 MB + 1): the server re-checks the REAL size and deletes it.
    // ---- the four allowed formats + rejections ------------------------------------------------------------------------
    for (const [ext, wk] of [["docx", 10], ["pptx", 11], ["zip", 12]] as const) {
      const f = await upload("vm-lec-1", { title: `A ${ext}`, fileName: `lecture.${ext}`, startWeek: wk, endWeek: wk }, 700);
      const row = await confirmUpload("vm-lec-1", { ...f.m, path: f.t.path });
      ok(`${ext.toUpperCase()} uploaded and stored with canonical MIME`, f.put.ok && row.mimeType === CANONICAL_MIME[ext] && await exists(f.t.path));
    }
    await rejects("legacy .doc rejected", 400, () => requestUpload("vm-lec-1", meta({ fileName: "old.doc" })));
    await rejects("legacy .ppt rejected", 400, () => requestUpload("vm-lec-1", meta({ fileName: "old.ppt" })));
    await rejects("file whose MIME doesn't match its extension rejected", 400, () => requestUpload("vm-lec-1", meta({ fileName: "x.pdf", mimeType: "image/png" })));
    const liar = await upload("vm-lec-1", { title: "Liar", startWeek: 2, endWeek: 2 }, MAX_MATERIAL_BYTES + 1);
    await rejects("oversize object (client lied) rejected on confirm", 400, () => confirmUpload("vm-lec-1", { ...liar.m, size: 1000, path: liar.t.path }), /too large|didn't arrive/);
    ok("oversize object was removed from Storage", !(await exists(liar.t.path)) && (await db.courseMaterial.count({ where: { storagePath: liar.t.path } })) === 0);
    const ghost = await requestUpload("vm-lec-1", meta());
    await rejects("confirm with nothing uploaded rejected", 400, () => confirmUpload("vm-lec-1", { ...meta(), path: ghost.path }));
    await rejects("path pointing at another offering's folder rejected", 403, () => confirmUpload("vm-lec-1", { ...meta(), path: single.t.path.replace(offA.id, offB.id) }));
    // DB failure -> storage cleanup (a pre-existing row with the same storagePath triggers the unique violation)
    const dupe = await upload("vm-lec-1", { title: "Dupe", startWeek: 4, endWeek: 4 }, 500);
    await db.courseMaterial.create({ data: { courseOfferingId: offA.id, uploadedByFacultyUserId: "vm-lec-1", title: "pre", type: "NOTES", startWeek: 4, endWeek: 4, fileName: "p.pdf", mimeType: "application/pdf", fileSize: 500, storageBucket: BUCKET, storagePath: dupe.t.path } });
    await rejects("DB failure on save -> error surfaced", 409, () => confirmUpload("vm-lec-1", { ...dupe.m, path: dupe.t.path }));
    ok("DB failure removed the uploaded object (no orphan)", !(await exists(dupe.t.path)));
    await db.courseMaterial.deleteMany({ where: { storagePath: dupe.t.path } });
    ok("Storage holds exactly the objects of saved materials", REAL || objects.size === (await db.courseMaterial.count({ where: { courseOfferingId: { in: [offA.id, offB.id] } } })), `objects=${objects.size}`);

    // ---- student My Learning ------------------------------------------------------------------------------------------
    const mine = await getRegisteredCourses(student.userId, ctx as never);
    const mineA = mine.find((c) => c.id === cA.id);
    ok("My Learning lists registered courses with offeringId and both lecturers", !!mineA && mineA.offeringId === offA.id && (mineA.lecturerName ?? "").split(",").length === 2);
    const d = await getOfferingDetail(offA.id);
    ok("overview: programme, session, semester, coordinator first", d.programme.code === prog.code && d.sessionName === session.name && d.semesterName === sem.name && d.lecturers[0].role === "COORDINATOR");
    ok("weeks derived from semester dates", d.totalWeeks >= 9, `${d.totalWeeks} weeks`);
    const week = (n: number) => d.materials.filter((m) => m.startWeek <= n && n <= m.endWeek).map((m) => m.title).sort();
    ok("multi-week material appears in weeks 5, 6, 7 from one row, not 4 or 8", [5, 6, 7].every((w) => week(w).includes("Assignment 1")) && !week(4).includes("Assignment 1") && !week(8).includes("Assignment 1"));
    ok("week 7 has Assignment + Quiz; week 3 has Notes", week(7).length === 2 && week(3).join() === "Intro notes");
    ok("CCMAS outcomes/contents come from the linked entry, verbatim", JSON.stringify(d.ccmas?.outcomes) === JSON.stringify(linked.learningOutcomes.map((s) => s.trim()).filter(Boolean)) && d.ccmas?.contents === (linked.description?.trim() || null));
    const dB = await getOfferingDetail(offB.id);
    ok("unlinked course has NO CCMAS block (nothing fabricated)", dB.ccmas === null);
    ok("materials don't leak across offerings", dB.materials.length === 0);

    // ---- download authorization ---------------------------------------------------------------------------------------
    const dl = await resolveDownload({ id: student.userId, role: "student" }, rowSingle.id);
    ok("registered student gets a signed URL that serves the file", (await fetch(dl.url)).status === 200 && dl.url.includes("download="));
    await rejects("student without registration denied", 403, () => resolveDownload({ id: "vm-stranger", role: "student" }, rowSingle.id));
    await db.studentProfile.create({ data: { userId: "vm-stu-2", departmentId: student.departmentId, programmeId: student.programmeId, level, admissionSessionId: session.id } });
    await db.courseRegistration.create({ data: { studentUserId: "vm-stu-2", academicSessionId: session.id, semesterId: sem.id, status: "PENDING_HOD", items: { create: [{ courseId: cA.id }] } } });
    await rejects("student with only a PENDING registration denied", 403, () => resolveDownload({ id: "vm-stu-2", role: "student" }, rowSingle.id));
    await rejects("lecturer not assigned to this offering denied", 403, () => resolveDownload({ id: "vm-lec-3", role: "faculty" }, rowSingle.id));
    ok("assigned lecturer allowed", !!(await resolveDownload({ id: "vm-lec-1", role: "faculty" }, rowSingle.id)).url);
    ok("HOD of the department allowed", !!(await resolveDownload({ id: hod.userId, role: "hod" }, rowSingle.id)).url);
    await rejects("other roles denied", 403, () => resolveDownload({ id: "x", role: "dapu" }, rowSingle.id));
    await rejects("unknown material 404", 404, () => resolveDownload({ id: student.userId, role: "student" }, "nope"));

    // ---- missing Storage config ---------------------------------------------------------------------------------------
    const savedUrl = process.env.SUPABASE_URL; delete process.env.SUPABASE_URL;
    await rejects("unconfigured Storage gives a clear 503", 503, () => requestUpload("vm-lec-1", meta()), /isn't set up/);
    process.env.SUPABASE_URL = savedUrl;

    // ---- delete -------------------------------------------------------------------------------------------------------
    await rejects("non-assigned lecturer can't delete", 403, () => deleteMaterial("vm-lec-3", rowQuiz.id));
    await deleteMaterial("vm-lec-1", rowQuiz.id);
    ok("delete removes DB row AND Storage object", !(await db.courseMaterial.findUnique({ where: { id: rowQuiz.id } })) && !(await exists(quiz.t.path)));
  } finally {
    const curIds = (await db.curriculum.findMany({ where: { name: { in: names } }, select: { id: true } })).map((c) => c.id);
    const oIds = (await db.courseOffering.findMany({ where: { curriculumCourse: { curriculumId: { in: curIds } } }, select: { id: true } })).map((o) => o.id);
    // Remove the test's Storage objects too (the app deletes them with the row; this is the test's own cleanup).
    for (const m of await db.courseMaterial.findMany({ where: { courseOfferingId: { in: oIds } }, select: { storagePath: true } })) await removeObject(BUCKET, m.storagePath).catch(() => {});
    await db.courseMaterial.deleteMany({ where: { courseOfferingId: { in: oIds } } });
    await db.courseOfferingLecturer.deleteMany({ where: { courseOfferingId: { in: oIds } } });
    await db.courseOffering.deleteMany({ where: { id: { in: oIds } } });
    await db.courseRegistration.deleteMany({ where: { OR: [{ id: created.regId || "none" }, { studentUserId: "vm-stu-2" }] } });
    await db.studentProfile.deleteMany({ where: { userId: "vm-stu-2" } });
    await db.curriculum.deleteMany({ where: { id: { in: curIds } } });
    await db.course.deleteMany({ where: { id: { in: created.courses } } });
    await db.facultyProfile.deleteMany({ where: { userId: { in: created.fac } } });
    if (!REAL) server.close();
  }
  console.log(`\n${passed} passed, ${failed} failed`);
  await db.$disconnect(); await core.$disconnect();
  process.exit(failed ? 1 : 0);
}
main().catch((e) => { console.error(e); if (!REAL) server.close(); process.exit(1); });
