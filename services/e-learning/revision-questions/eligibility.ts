import type { Prisma } from "@/generated/prisma-elearning";
import { elearningDb } from "@/lib/db/elearning";
import { getCurrentAcademicContext } from "@/services/e-learning/shared/academic-calendar";
import { getRegisteredCourses } from "@/services/e-learning/student/registered-courses";
import { hash, scopeKey, teachingPassed, type Evaluation } from "./policy";
import type { RevisionPayload } from "./contract";
import { RevisionWebhookError } from "./errors";
export const bankQuestionInclude = { governance: true, concept: { include: { material: { include: { courseOffering: { select: { curriculumCourse: { select: { courseId: true } } } } } } } } } as const;
export const workspaceEnabled = () => process.env.REVISION_WORKSPACE_ENABLED === "true" || (process.env.AI_V2_ENABLED === "true" && process.env.REVISIONS_UI_ENABLED === "true");
export function sourceSnapshot(m: { id: string; courseOfferingId: string; storagePath: string; storageBucket: string; fileSize: number; mimeType: string; startWeek: number; endWeek: number }) {
  return { materialId: m.id, offeringId: m.courseOfferingId, storagePath: m.storagePath, storageBucket: m.storageBucket, fileSize: m.fileSize, mimeType: m.mimeType, startWeek: m.startWeek, endWeek: m.endWeek };
}
export const sourceFingerprint = (m: Parameters<typeof sourceSnapshot>[0]) => hash(sourceSnapshot(m));
export async function revisionCourses(studentId: string) {
  const ctx = await getCurrentAcademicContext();
  return ctx?.session && ctx.semester ? getRegisteredCourses(studentId, ctx, { includeLecturerNames: false }) : [];
}
export async function coveragePool(studentId: string, offeringId?: string) {
  const courses = await revisionCourses(studentId);
  if (offeringId && !courses.some(c => c.offeringId === offeringId)) throw new RevisionWebhookError(404, "COURSE_UNAVAILABLE", "Select one of your registered courses.");
  const offerings = courses.flatMap(c => c.offeringId && (!offeringId || c.offeringId === offeringId) ? [c.offeringId] : []);
  const events = await elearningDb.revisionTeachingEvent.findMany({ where: { studentId, concept: { active: true, material: { courseOfferingId: { in: offerings }, aiIngestStatus: "INGESTED" } } }, include: { concept: { include: { material: true } }, practiceAttempt: { select: { evaluation: true } } }, orderBy: { passedAt: "desc" }, take: 500 });
  const scopes = new Map<string, typeof events[number]>();
  for (const event of events) {
    if (!teachingPassed(event.practiceAttempt.evaluation as unknown as Evaluation)) continue;
    const context = event.context as Record<string, unknown>, material = event.concept.material;
    if (context._sourceFingerprint ? context._sourceFingerprint !== sourceFingerprint(material) : event.passedAt < material.updatedAt) continue;
    for (const type of ["mcq", "short_answer", "true_false"] as const) {
      const scope = scopeKey({ context } as unknown as RevisionPayload, { type } as RevisionPayload["questions"][number], event.concept.conceptKey);
      if (!scopes.has(scope)) scopes.set(scope, event);
    }
  }
  return { courses, scopes };
}
type BankQuestion = Prisma.RevisionQuestionGetPayload<{ include: typeof bankQuestionInclude }>;
export function eligibleFromPool(pool: Awaited<ReturnType<typeof coveragePool>>, question: BankQuestion | null) {
  const coverage = question ? pool.scopes.get(question.scopeKey) : undefined;
  const course = coverage ? pool.courses.find(c => c.offeringId === coverage.concept.material.courseOfferingId) : undefined;
  if (!question || !coverage || !course || question.concept.material.courseOffering.curriculumCourse.courseId !== course.id || !question.concept.active || question.concept.material.aiIngestStatus !== "INGESTED" || question.governance?.publicationStatus !== "PUBLISHED" || question.governance.sourceFingerprint !== sourceFingerprint(question.concept.material)) throw new RevisionWebhookError(404, "QUESTION_INELIGIBLE", "This question is no longer eligible for revision.");
  return { question, coverage, course };
}
export async function eligibleBankQuestion(studentId: string, questionId: string, offeringId?: string) {
  const [pool, question] = await Promise.all([coveragePool(studentId, offeringId), elearningDb.revisionQuestion.findUnique({ where: { id: questionId }, include: bankQuestionInclude })]);
  return eligibleFromPool(pool, question);
}
