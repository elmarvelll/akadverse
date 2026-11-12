// POST /api/e-learning/stewart/chat
//   { courseId, weekNumber, documentId?, messages: [{ role: "student" | "stewart", text }], attachments?: token[] } (legacy attachment?: token remains supported)
//   -> { reply, truncated }
//
// One turn of a Stewart conversation. Authorization, on every request:
//   - the caller is a signed-in student with an E-Learning profile;
//   - `courseId` is in THAT student's APPROVED registration for the current session/semester (the same check the
//     Study Zone page makes) — the course/week/document names given to the model come from this server-side lookup,
//     never from the request body;
//   - every attachment is a signed token this student was issued and that has not expired.
// Text-only chat (no attachment) works exactly the same way, without the document.
//
// See services/e-learning/student/stewart/chat.ts for how the document content reaches the model.

import { STEWART_MAX_ATTACHMENTS } from "@/lib/stewart/config";
import { NextResponse } from "next/server";
import { badRequest, notFound } from "@/lib/service-error";
import { getCurrentAcademicContext } from "@/services/e-learning/shared/academic-calendar";
import { getStudyWorkspace } from "@/services/e-learning/student/study-zone";
import { askStewart } from "@/services/e-learning/student/stewart/chat";
import { verifyAttachment } from "@/services/e-learning/student/stewart/attachment-token";
import { boundedStewartRequest, requireStewartStudent, stewartErrorResponse } from "../shared";

export const maxDuration = 60;

export async function POST(req: Request) {
  try {
    const userId = await requireStewartStudent();
    const limited = await boundedStewartRequest(req, 1024 * 1024);
    const body = (await limited.json().catch(() => null)) as { courseId?: unknown; weekNumber?: unknown; documentId?: unknown; messages?: unknown; attachment?: unknown; attachments?: unknown } | null;
    if (!body || typeof body.courseId !== "string") throw badRequest("That request couldn't be read. Please refresh and try again.");

    const ctx = await getCurrentAcademicContext();
    const workspace = ctx?.session && ctx.semester ? await getStudyWorkspace(userId, ctx, body.courseId) : null;
    if (!workspace) throw notFound("That course isn't available to you.");

    const week = workspace.weeks.find((w) => w.weekNumber === Number(body.weekNumber)) ?? null;
    const openDocument = typeof body.documentId === "string" ? (week?.documents.find((d) => d.id === body.documentId) ?? null) : null;
    const tokens = body.attachments ?? (body.attachment ? [body.attachment] : []);
    if (!Array.isArray(tokens) || tokens.length > STEWART_MAX_ATTACHMENTS) throw badRequest(`Attach at most ${STEWART_MAX_ATTACHMENTS} files.`);
    const attachment = tokens.map((token) => verifyAttachment(token, userId));

    const reply = await askStewart(
      userId,
      { courseCode: workspace.course.code, courseTitle: workspace.course.title, weekNumber: week?.weekNumber ?? 1, openDocumentTitle: openDocument?.title ?? null },
      body.messages,
      attachment
    );
    return NextResponse.json({ reply: reply.text, truncated: reply.truncated }, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    return stewartErrorResponse("chat", err);
  }
}
