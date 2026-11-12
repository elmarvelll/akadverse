import { elearningDb } from "@/lib/db/elearning";
import { createHmac } from "node:crypto";
import { badRequest, notFound } from "@/lib/service-error";
import { getCurrentAcademicContext } from "@/services/e-learning/shared/academic-calendar";
import { getStudyWorkspace } from "@/services/e-learning/student/study-zone";

// Resolve registration on every request. Never accept an offering or service session ID from the browser.
export async function attachmentContext(userId: string, body: { courseId?: unknown; weekNumber?: unknown; documentId?: unknown; conversationId?: unknown }) {
  if (typeof body.courseId !== "string") throw badRequest("Select a course first.");
  const ctx = await getCurrentAcademicContext();
  const workspace = ctx?.session && ctx.semester ? await getStudyWorkspace(userId, ctx, body.courseId, { includeLecturerNames: false }) : null;
  if (!workspace?.offeringId) throw notFound("That course isn't available to you.");
  const week = workspace.weeks.find((w) => w.weekNumber === Number(body.weekNumber));
  if (!week) throw badRequest("Select an available academic week.");
  let conversation: { sessionId: string; documentId: string | null } | null = null;
  if (body.conversationId !== undefined) {
    if (typeof body.conversationId !== "string") throw badRequest("Select a valid conversation.");
    const owned = await elearningDb.chatConversation.findFirst({ where: { id: body.conversationId, userId } });
    if (!owned || owned.courseId !== workspace.course.id || owned.offeringId !== workspace.offeringId || owned.weekNumber !== week.weekNumber) throw notFound("That conversation isn't available in this study context.");
    const suppliedDocument = body.documentId == null || body.documentId === "" ? null : body.documentId;
    if (suppliedDocument !== owned.documentId) throw badRequest("This attachment belongs to a different document conversation.");
    conversation = owned;
  }
  const documentId = body.documentId == null || body.documentId === "" ? null : body.documentId;
  if (!conversation && documentId !== null && (typeof documentId !== "string" || !week.documents.some((d) => d.id === documentId))) throw notFound("That document isn't available to you.");
  const secret = process.env.NEXTAUTH_SECRET;
  if (!secret) throw new Error("NEXTAUTH_SECRET is required.");
  // Stable across follow-ups and page visits, scoped to this student, offering, week and document.
  const sessionId = conversation?.sessionId ?? createHmac("sha256", secret).update(JSON.stringify(["stewart-v2", userId, workspace.offeringId, week.weekNumber, documentId])).digest("hex");
  return { workspace, week, sessionId };
}
