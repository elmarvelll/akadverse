import { unstable_rethrow } from "next/navigation";
import { ServiceError } from "@/lib/service-error";
import { publicProductivityError } from "../errors";
export const privateHeaders = { "Cache-Control": "private, no-store", Vary: "Cookie" };
export async function body(request: Request | Response, limit = 32768): Promise<Record<string, unknown>> {
  if (!request.headers.get("content-type")?.startsWith("application/json")) throw new ServiceError(400, "Send a JSON request.");
  const reader = request.body?.getReader(); if (!reader) throw new ServiceError(400, "A request body is required.");
  const chunks: Uint8Array[] = []; let size = 0;
  while (true) { const { done, value } = await reader.read(); if (done) break; size += value.length; if (size > limit) { await reader.cancel(); throw new ServiceError(413, "This assistant request is too large."); } chunks.push(value); }
  try { const value = JSON.parse(Buffer.concat(chunks).toString("utf8")); if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(); return value; }
  catch { throw new ServiceError(400, "Invalid assistant request."); }
}
export async function respond(fn: () => Promise<unknown>) {
  try { return Response.json({ result: await fn() }, { headers: privateHeaders }); }
  catch (error) {
    unstable_rethrow(error);
    const { status, ...failure } = publicProductivityError(error);
    const referenceId = crypto.randomUUID();
    if (status >= 500) console.error("Productivity assistant request failed", { referenceId, code: failure.code });
    return Response.json({ ...failure, referenceId }, { status, headers: privateHeaders });
  }
}
export function identifier(value: unknown, label = "Identifier") {
  if (typeof value !== "string" || !/^[a-zA-Z0-9:-]{8,200}$/.test(value)) throw new ServiceError(400, `${label} is invalid.`);
  return value;
}
