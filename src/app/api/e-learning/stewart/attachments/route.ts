// POST   /api/e-learning/stewart/attachments   (multipart/form-data, field "file")
//   A student attaches one document to their Stewart conversation. The server validates it (type from the file's own
//   bytes, size), extracts its content, stores it for the session, and returns { token, name, kind, truncated,
//   expiresAt } — `token` is an opaque signed handle (never a storage URL) to send with each question.
// DELETE /api/e-learning/stewart/attachments   { token }
//   The student removed/replaced the attachment: the stored copy is deleted. Only the uploader's own token works.
//
// See services/e-learning/student/stewart/upload-attachment.ts.

import { NextResponse } from "next/server";
import { badRequest, ServiceError } from "@/lib/service-error";
import { STEWART_MAX_ATTACHMENT_BYTES, STEWART_MAX_ATTACHMENT_MB } from "@/lib/stewart/config";
import { deleteStewartAttachment, uploadStewartAttachment } from "@/services/e-learning/student/stewart/upload-attachment";
import { verifyAttachment } from "@/services/e-learning/student/stewart/attachment-token";
import { boundedStewartRequest, requireStewartStudent, stewartErrorResponse } from "../shared";

export const maxDuration = 60;

const tooLarge = () => new ServiceError(413, `That file is too large. The maximum is ${STEWART_MAX_ATTACHMENT_MB} MB.`);

export async function POST(req: Request) {
  try {
    const userId = await requireStewartStudent();

    // Refuse an oversized body from its declared length before reading any of it (multipart adds a little overhead).
    const declared = Number(req.headers.get("content-length") ?? 0);
    if (declared > STEWART_MAX_ATTACHMENT_BYTES + 64 * 1024) throw tooLarge();

    let form: FormData;
    try {
      form = await (await boundedStewartRequest(req, STEWART_MAX_ATTACHMENT_BYTES + 64 * 1024)).formData();
    } catch (error) {
      if (error instanceof ServiceError) throw error;
      throw badRequest("That upload couldn't be read. Please try again.");
    }
    const file = form.get("file");
    if (!(file instanceof File)) throw badRequest("Choose a document to attach.");
    if (file.size > STEWART_MAX_ATTACHMENT_BYTES) throw tooLarge();

    const attachment = await uploadStewartAttachment(userId, { name: file.name, bytes: new Uint8Array(await file.arrayBuffer()) });
    return NextResponse.json(attachment, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    return stewartErrorResponse("attachment upload", err);
  }
}

export async function DELETE(req: Request) {
  try {
    const userId = await requireStewartStudent();
    const body = (await req.json().catch(() => ({}))) as { token?: unknown };
    const claims = verifyAttachment(body.token, userId);
    await deleteStewartAttachment(claims.fileId);
    return NextResponse.json({ removed: true }, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    return stewartErrorResponse("attachment delete", err);
  }
}
