import { NextResponse } from "next/server";
import { badRequest } from "@/lib/service-error";
import { requireProductivityUser } from "@/services/productivity-layer/auth";
import { publicProductivityError } from "@/services/productivity-layer/errors";
import { databaseDiagnostic } from "@/services/productivity-layer/diagnostics";
import { checkOrigin } from "@/services/productivity-layer/validation";
import { browseBuddy, buddyDetail, createBuddy, mutateBuddy } from "@/services/productivity-layer/buddy-system/service";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "private, no-store", Vary: "Cookie" };
async function handle(request: Request) {
  try {
    const user = await requireProductivityUser();
    if (request.method === "GET") {
      const params = new URL(request.url).searchParams, id = params.get("id");
      return NextResponse.json(id ? await buddyDetail(user.id, id) : await browseBuddy(user.id, params), { headers });
    }
    checkOrigin(request);
    const reader = request.body?.getReader(); if (!reader) throw badRequest("A request body is required.");
    const chunks: Uint8Array[] = []; let size = 0;
    while (true) { const { done, value } = await reader.read(); if (done) break; size += value.length; if (size > 16000) { await reader.cancel(); throw badRequest("Request is too large."); } chunks.push(value); }
    let input: unknown;
    try { input = JSON.parse(Buffer.concat(chunks).toString("utf8")); } catch { throw badRequest("Invalid JSON."); }
    const result = request.method === "POST" ? await createBuddy(user.id, input) : await mutateBuddy(user.id, input);
    return NextResponse.json(result, { headers, status: request.method === "POST" ? 201 : 200 });
  } catch (error) {
    const referenceId = crypto.randomUUID();
    const { status, ...failure } = publicProductivityError(error);
    if (status >= 500) console.error("Buddy operation failed", { referenceId, code: failure.code, ...databaseDiagnostic(error) });
    return NextResponse.json({ ...failure, referenceId }, { status, headers });
  }
}
export const GET = handle;
export const POST = handle;
export const PATCH = handle;
