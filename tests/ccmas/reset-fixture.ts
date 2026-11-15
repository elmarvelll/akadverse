import "../helpers/env";
import { PrismaClient } from "@prisma/client";
import { elearningDb as db } from "../../src/lib/db/elearning";
import { courseScenario } from "../helpers/elearning-fixtures";
import { randomUUID } from "node:crypto";
const core = new PrismaClient();
async function main() {
try {
  const f = await courseScenario();
  const placement = await db.curriculumCourse.findUniqueOrThrow({ where: { id: (await db.courseOffering.findUniqueOrThrow({ where: { id: f.offering.id } })).curriculumCourseId }, include: { curriculum: { include: { programme: true } } } });
  const programme = placement.curriculum.programme;
  await db.department.update({ where: { id: programme.departmentId }, data: { code: "EIENG", name: "Electrical and Information Engineering" } });
  await db.programme.update({ where: { id: programme.id }, data: { code: "CPE", name: "Computer Engineering" } });
  for (const code of ["EEE", "ICE"]) await db.programme.create({ data: { code, name: `Institutional ${code}`, departmentId: programme.departmentId } });
  for (const [id, role] of [[f.studentId, "student"], [f.lecturerId, "faculty"], [f.otherLecturerId, "faculty"], ["reset-hod", "hod"], ["reset-dapu", "dapu"]] as const) await core.user.create({ data: { id, role, firstName: role, lastName: "Reset fixture", email: `${id}@reset.invalid`, password: "local-fixture-hash-must-stay-unchanged" } });
  await db.hodProfile.create({ data: { userId: "reset-hod", departmentId: programme.departmentId } });
  await db.dapuProfile.create({ data: { userId: "reset-dapu" } });
  await core.notification.createMany({ data: [{ userId: f.studentId, scope: "ELEARNING", type: "TEST", title: "Old academic activity", message: "Reset fixture" }, { userId: f.studentId, scope: "MARKETPLACE", type: "TEST", title: "Unrelated activity", message: "Must survive" }] });
  const material = await db.courseMaterial.create({ data: { courseOfferingId: f.offering.id, uploadedByFacultyUserId: f.lecturerId, title: "Fixture notes", type: "NOTES", startWeek: 1, endWeek: 1, fileName: "fixture.pdf", mimeType: "application/pdf", fileSize: 8, storageBucket: "reset-fixture", storagePath: "fixture.pdf", aiIngestStatus: "INGESTED", aiChunkCount: 1 } });
  await db.aiIngestTask.create({ data: { documentId: material.id, materialId: material.id, state: "DONE", submittedAt: new Date(), callbackAt: new Date() } });
  await db.stewartAttachment.create({ data: { userId: f.studentId, sessionId: randomUUID(), uploadKey: "fixture", attachmentId: randomUUID(), filename: "fixture.pdf", mimeType: "application/pdf", sizeBytes: 8, status: "uploaded", expiresAt: new Date(Date.now() + 60000) } });
  await db.chatConversation.create({ data: { userId: f.studentId, clientKey: "fixture", title: "Prior learning activity", courseId: f.course.id, offeringId: f.offering.id, courseCode: f.course.code, weekNumber: 1, messages: { create: { requestId: "fixture", role: "USER", content: "Prior message" } } } });
} finally { await core.$disconnect(); await db.$disconnect(); }

}
main().catch(error => { console.error(error); process.exitCode = 1; });
