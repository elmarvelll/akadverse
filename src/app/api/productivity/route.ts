import { NextResponse } from "next/server";
import { unstable_rethrow } from "next/navigation";
import { executeProductivity } from "@/services/productivity-layer/operations";
import { checkOrigin, command } from "@/services/productivity-layer/validation";
import { badRequest } from "@/lib/service-error";
import { publicProductivityError } from "@/services/productivity-layer/errors";
import { productivityAction } from "@/features/productivity/errors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  let action = "read the workspace request";
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
    const parsed = command(input);
    action = productivityAction(parsed.operation);
    const result = await executeProductivity(parsed, request.headers.get("x-productivity-user"));
    return NextResponse.json({ result }, { headers: { "Cache-Control": "private, no-store", Vary: "Cookie" } });
  } catch (error) {
    unstable_rethrow(error);
    const headers = { "Cache-Control": "private, no-store", Vary: "Cookie" };
    const { status, ...failure } = publicProductivityError(error);
    const referenceId = crypto.randomUUID();
    // Bounded metadata only: no raw exception, URLs, queries or personal content.
    if (status >= 500) console.error("Productivity request failed", { referenceId, action, code: failure.code });
    return NextResponse.json({ ...failure, referenceId }, { status, headers });
  }
}
