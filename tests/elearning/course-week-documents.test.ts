// Multiple documents in one course week: upload, storage, retrieval, access control, deletion, and the Study Zone's
// week/document selection rules. Real local E-Learning database; Supabase Storage is an in-memory fake.
import "../helpers/env";
import { after, before, beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import { elearningDb } from "@/lib/db/elearning";
import { installFakeProviders, storage } from "../helpers/fake-providers";
import { courseScenario } from "../helpers/elearning-fixtures";
import { requestUpload, confirmUpload, type UploadMeta } from "@/services/e-learning/faculty/materials/upload-material";
import { deleteMaterial } from "@/services/e-learning/faculty/materials/delete-material";
import { resolveDownload } from "@/services/e-learning/shared/course-materials/resolve-download";
import { getStudyWorkspace, type StudyWeek } from "@/services/e-learning/student/study-zone";
import { documentOptionLabels, initialWeek, resolveSelection } from "@/app/e-learning/student/study-zone/_components/study-selection";
import { ServiceError } from "@/lib/service-error";

before(() => installFakeProviders());
beforeEach(() => storage.reset());
after(() => elearningDb.$disconnect());

type Scenario = Awaited<ReturnType<typeof courseScenario>>;
const status = (code: number) => (e: unknown) => e instanceof ServiceError && e.status === code;

// What UploadMaterial.tsx does: ask for a signed URL, PUT the file to it, confirm.
async function upload(s: Scenario, overrides: Partial<UploadMeta> & { bytes?: number; lecturer?: string } = {}) {
  const { bytes = 1200, lecturer = s.lecturerId, ...rest } = overrides;
  const meta: UploadMeta = { courseOfferingId: s.offering.id, type: "NOTES", title: "Main lecture note", startWeek: 2, endWeek: 2, fileName: "notes.pdf", size: bytes, mimeType: "application/pdf", ...rest };
  const signed = await requestUpload(lecturer, meta);
  const put = await fetch(signed.uploadUrl, { method: "PUT", headers: { "Content-Type": "application/pdf", "x-upsert": "false" }, body: new Uint8Array(bytes).fill(1) });
  assert.ok(put.ok, "browser PUT to the signed URL");
  return confirmUpload(lecturer, { ...meta, path: signed.path });
}
const week = async (s: Scenario, n: number, studentId = s.studentId) => (await getStudyWorkspace(studentId, s.ctx, s.course.id))!.weeks.find((w) => w.weekNumber === n)!;

describe("several documents in the same course week", () => {
  it("the database has no rule limiting a week to one document", async () => {
    const unique = await elearningDb.$queryRawUnsafe<{ indexdef: string }[]>(`SELECT indexdef FROM pg_indexes WHERE tablename = 'CourseMaterial' AND indexdef ILIKE '%UNIQUE%'`);
    const columns = unique.map((u) => u.indexdef.replace(/.*\((.*)\)/, "$1"));
    assert.deepEqual(columns.sort(), ['"storagePath"', "id"].sort(), "only the primary key and the storage path are unique — nothing per week");
  });

  it("four uploads to one week create four records and four files; nothing is overwritten", async () => {
    const s = await courseScenario();
    const first = await upload(s, { title: "Main lecture note" });
    const second = await upload(s, { title: "Supplementary reading", fileName: "reading.docx", mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" });
    const third = await upload(s, { title: "Worked examples", fileName: "notes.pdf" }); // same file name as the first
    const fourth = await upload(s, { title: "Main lecture note" }); // same title AND file name as the first

    const rows = await elearningDb.courseMaterial.findMany({ where: { courseOfferingId: s.offering.id }, orderBy: { createdAt: "asc" } });
    assert.equal(rows.length, 4);
    assert.deepEqual(rows.map((r) => r.id), [first.id, second.id, third.id, fourth.id]);
    assert.equal(new Set(rows.map((r) => r.storagePath)).size, 4, "identical file names still get distinct storage paths");
    assert.equal(storage.objects.size, 4, "four stored files");
    assert.ok(rows.every((r) => r.startWeek === 2 && r.endWeek === 2 && r.courseOfferingId === s.offering.id && r.uploadedByFacultyUserId === s.lecturerId));
    assert.deepEqual(rows.map((r) => [r.title, r.fileName, r.mimeType.includes("pdf") ? "pdf" : "docx"]), [
      ["Main lecture note", "notes.pdf", "pdf"],
      ["Supplementary reading", "reading.docx", "docx"],
      ["Worked examples", "notes.pdf", "pdf"],
      ["Main lecture note", "notes.pdf", "pdf"],
    ]);
    // The first document is byte-for-byte still there.
    assert.equal((await elearningDb.courseMaterial.findUniqueOrThrow({ where: { id: first.id } })).storagePath, first.storagePath);
    assert.ok(storage.objects.has(`course-materials/${first.storagePath}`));
  });

  it("the student sees every document of the week, each openable by its own id", async () => {
    const s = await courseScenario();
    const a = await upload(s, { title: "Main lecture note" });
    const b = await upload(s, { title: "Worked examples" });
    const quiz = await upload(s, { title: "Week quiz", type: "QUIZ" });
    await upload(s, { title: "Only week 5", startWeek: 5, endWeek: 5 });

    const w2 = await week(s, 2);
    assert.deepEqual(w2.documents.map((d) => d.id), [a.id, b.id, quiz.id], "notes first (upload order), then quizzes");
    assert.equal(w2.topic, "Main lecture note");
    assert.equal((await week(s, 5)).documents.length, 1, "a week with a single document keeps working");
    assert.equal((await week(s, 3)).documents.length, 0, "and so does an empty week");

    for (const doc of [a, b, quiz]) {
      const { url } = await resolveDownload({ id: s.studentId, role: "student" }, doc.id, { inline: true });
      assert.ok(url.includes(encodeURIComponent(doc.storagePath.split("/").pop()!)), "the signed URL is for that exact document's file");
    }
  });

  it("only assigned lecturers upload; only registered students read", async () => {
    const s = await courseScenario();
    await assert.rejects(upload(s, { lecturer: s.otherLecturerId }), status(403));
    const doc = await upload(s);
    const pending = await s.makeStudent("PENDING_HOD");
    const unregistered = await s.makeStudent(null);
    for (const studentId of [pending, unregistered]) {
      await assert.rejects(resolveDownload({ id: studentId, role: "student" }, doc.id), status(403));
      assert.equal(await getStudyWorkspace(studentId, s.ctx, s.course.id), null, "the workspace doesn't exist for them");
    }
    await assert.rejects(resolveDownload({ id: s.otherLecturerId, role: "faculty" }, doc.id), status(403));
    await assert.rejects(resolveDownload({ id: s.studentId, role: "student" }, "no-such-document"), status(404));
    assert.ok((await resolveDownload({ id: s.lecturerId, role: "faculty" }, doc.id)).url);
  });

  it("deleting one document leaves the week's other documents intact", async () => {
    const s = await courseScenario();
    const a = await upload(s, { title: "Main lecture note" });
    const b = await upload(s, { title: "Supplementary reading" });
    await assert.rejects(deleteMaterial(s.otherLecturerId, a.id), status(403));
    await deleteMaterial(s.lecturerId, a.id);
    assert.deepEqual((await week(s, 2)).documents.map((d) => d.id), [b.id]);
    assert.ok(!storage.objects.has(`course-materials/${a.storagePath}`), "its file is gone");
    assert.ok(storage.objects.has(`course-materials/${b.storagePath}`), "the other file is untouched");
    await assert.rejects(resolveDownload({ id: s.studentId, role: "student" }, a.id), status(404));
  });

  it("a failed upload leaves no orphan record or file", async () => {
    const s = await courseScenario();
    // 1) Storage refuses to issue an upload URL: nothing is created.
    storage.failNextSign = true;
    await assert.rejects(requestUpload(s.lecturerId, { courseOfferingId: s.offering.id, type: "NOTES", title: "X", startWeek: 2, endWeek: 2, fileName: "x.pdf", size: 100 }));
    // 2) The file never arrives: confirm is refused and no record is written.
    const meta: UploadMeta = { courseOfferingId: s.offering.id, type: "NOTES", title: "Never arrived", startWeek: 2, endWeek: 2, fileName: "x.pdf", size: 100 };
    const signed = await requestUpload(s.lecturerId, meta);
    await assert.rejects(confirmUpload(s.lecturerId, { ...meta, path: signed.path }), status(400));
    // 3) The record can't be saved (path already recorded): the just-uploaded file is removed.
    const saved = await upload(s, { title: "Saved" });
    await assert.rejects(confirmUpload(s.lecturerId, { ...meta, title: "Duplicate confirm", path: saved.storagePath }), status(409));
    // 4) A path outside this offering's folder is refused.
    await assert.rejects(confirmUpload(s.lecturerId, { ...meta, path: `somewhere/else/${saved.storagePath.split("/").pop()}` }), status(403));

    assert.equal(await elearningDb.courseMaterial.count({ where: { courseOfferingId: s.offering.id } }), 1);
    assert.equal(storage.objects.size, 0, "the duplicate-confirm cleanup removed the object it could not record");
  });
});

describe("study zone selection (week tabs + document dropdown)", () => {
  const doc = (id: string, title: string, fileName = `${id}.pdf`) => ({ id, title, description: null, kind: "pdf" as const, category: "Notes", fileName, fileSize: 10, rangeLabel: "Week" });
  const weeks: StudyWeek[] = [
    { weekNumber: 1, topic: null, documents: [] },
    { weekNumber: 2, topic: "Main", documents: [doc("a", "Main"), doc("b", "Reading"), doc("c", "Examples")] },
    { weekNumber: 3, topic: "Solo", documents: [doc("d", "Solo")] },
  ];

  it("opens the first week that has material, on its first document", () => {
    assert.equal(initialWeek(weeks), 2);
    const sel = resolveSelection(weeks, 2, {});
    assert.deepEqual([sel.week.weekNumber, sel.document?.id, sel.chosenIsGone], [2, "a", false]);
    assert.equal(initialWeek([{ weekNumber: 1, topic: null, documents: [] }]), 1);
  });

  it("switching document selects exactly that document, by id", () => {
    assert.equal(resolveSelection(weeks, 2, { 2: "c" }).document?.id, "c");
    assert.equal(resolveSelection(weeks, 2, { 2: "b" }).document?.id, "b");
  });

  it("switching week never carries a document across: each week resolves to one of its own documents", () => {
    const chosen = { 2: "c" };
    assert.equal(resolveSelection(weeks, 3, chosen).document?.id, "d", "week 3 shows its own first note");
    assert.equal(resolveSelection(weeks, 2, chosen).document?.id, "c", "coming back restores week 2's pick");
    assert.equal(resolveSelection(weeks, 1, chosen).document, null, "an empty week has no document");
    assert.equal(resolveSelection(weeks, 99, chosen).week.weekNumber, 1, "an unknown week falls back safely");
  });

  it("a chosen document that was removed falls back to the week's first note and is flagged", () => {
    const afterRemoval: StudyWeek[] = [weeks[0], { ...weeks[1], documents: [doc("a", "Main"), doc("b", "Reading")] }, { weekNumber: 3, topic: null, documents: [] }];
    const sel = resolveSelection(afterRemoval, 2, { 2: "c" });
    assert.deepEqual([sel.document?.id, sel.chosenIsGone], ["a", true]);
    const emptied = resolveSelection(afterRemoval, 3, { 3: "d" });
    assert.deepEqual([emptied.document, emptied.chosenIsGone], [null, true]);
  });

  it("dropdown labels stay distinguishable when titles repeat", () => {
    const labels = documentOptionLabels([doc("a", "Main", "v1.pdf"), doc("b", "Main", "v2.pdf"), doc("c", "Reading")]);
    assert.equal(labels.get("a"), "Notes: Main (v1.pdf)");
    assert.equal(labels.get("b"), "Notes: Main (v2.pdf)");
    assert.equal(labels.get("c"), "Notes: Reading");
  });
});
