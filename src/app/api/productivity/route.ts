import { NextResponse } from "next/server";
import { executeProductivity } from "@/services/productivity-layer/operations";
import { checkOrigin, command } from "@/services/productivity-layer/validation";
import { badRequest, ServiceError } from "@/lib/service-error";
import { SlotConflictError } from "@/features/productivity/schedule/domain";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    checkOrigin(request);
    // Enforce the limit while reading; Content-Length alone is not trusted.
    const reader = request.body?.getReader();
    if (!reader) throw badRequest("A request body is required.");
    const chunks: Uint8Array[] = []; let length = 0;
    while (true) {
      const { value, done } = await reader.read(); if (done) break;
      length += value.length;
      if (length > 2 * 1024 * 1024) { await reader.cancel(); throw badRequest("The import or request exceeds 2 MB."); }
      chunks.push(value);
    }
    let input: unknown;
    try { input = JSON.parse(Buffer.concat(chunks).toString("utf8")); } catch { throw badRequest("Invalid JSON request."); }
    const result = await executeProductivity(command(input), request.headers.get("x-productivity-user"));
    return NextResponse.json({ result }, { headers: { "Cache-Control": "private, no-store", Vary: "Cookie" } });
  } catch (error) {
    const headers = { "Cache-Control": "private, no-store", Vary: "Cookie" };
    if (error instanceof SlotConflictError) return NextResponse.json({ error: error.message, code: "SLOT_CONFLICT", conflicts: error.conflicts }, { status: 409, headers });
    if (error instanceof ServiceError) return NextResponse.json({ error: error.message }, { status: error.status, headers });
    // Do not log database URLs, query parameters, snapshots or personal content.
    return NextResponse.json({ error: "Your workspace could not be saved or loaded. Please retry." }, { status: 500, headers });
  }
}
