// src/app/api/e-learning/stewart/shared.ts
//
// Shared by Stewart's two routes: who may use Stewart, and turning service errors into JSON (the same
// `{ error }` shape the document-access route returns, so the browser handles both the same way).

import { NextResponse } from "next/server";
import { ServiceError } from "@/lib/service-error";
import { requireElearningRole, requireStudentProfile } from "@/services/e-learning/shared/auth";

// Stewart is part of the student Study Zone: a signed-in student with an E-Learning profile. Anyone else gets
// 401/403 before any upload is read or any model call is made.
export async function requireStewartStudent(): Promise<string> {
  const session = await requireElearningRole(["student"]);
  await requireStudentProfile(session);
  return session.user.id;
}

export function stewartErrorResponse(scope: string, err: unknown): NextResponse {
  if (err instanceof ServiceError) return NextResponse.json({ error: err.message }, { status: err.status, headers: { "Cache-Control": "no-store" } });
  console.error(`[stewart ${scope}]`, err);
  return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500, headers: { "Cache-Control": "no-store" } });
}

// Enforce limits even for chunked requests or a missing/misleading Content-Length.
export async function boundedStewartRequest(req: Request, maxBytes: number): Promise<Request> {
  if (Number(req.headers.get("content-length") ?? 0) > maxBytes) throw new ServiceError(413, "That request is too large.");
  const reader = req.body?.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  if (reader) {
    try {
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > maxBytes) { await reader.cancel(); throw new ServiceError(413, "That request is too large."); }
        chunks.push(value);
      }
    } finally { reader.releaseLock(); }
  }
  return new Request(req.url, { method: req.method, headers: req.headers, body: Buffer.concat(chunks) });
}
