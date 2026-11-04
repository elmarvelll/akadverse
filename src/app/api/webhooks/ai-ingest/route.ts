// POST /api/webhooks/ai-ingest
//   Authorization: Bearer <AI_SERVICE_CALLBACK_SECRET>
//   { document_id, status: "ingested" | "failed", chunk_count?, error? }  ->  { ok: true }
//
// Called by the AI microservice when it finishes (or gives up on) ingesting a course material, so the lecturer's page
// can show "AI: ready" / "AI: failed". Machine-to-machine only: no user session (it lives under /api/webhooks, which
// src/proxy.ts lets through unauthenticated, like Paystack's webhook), authorized solely by the shared secret
// (compared in constant time). It can only set the AI status fields of an existing material — nothing else.
// Contract: docs/elearning/systems/ai-ingestion-contract.md.

import { createHash, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { parseIngestCallback, recordIngestCallback } from "@/services/e-learning/ai-ingest/ingest-material";

const noStore = { "Cache-Control": "no-store" };
const digest = (s: string) => createHash("sha256").update(s).digest();

function authorized(req: Request, secret: string): boolean {
  const header = req.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  // Hash both sides so the comparison is constant-time regardless of length.
  return token.length > 0 && timingSafeEqual(digest(token), digest(secret));
}

export async function POST(req: Request) {
  const secret = process.env.AI_SERVICE_CALLBACK_SECRET?.trim();
  if (!secret) return NextResponse.json({ error: "AI ingestion callbacks aren't configured." }, { status: 503, headers: noStore });
  if (!authorized(req, secret)) return NextResponse.json({ error: "Unauthorized." }, { status: 401, headers: noStore });

  const body = parseIngestCallback(await req.json().catch(() => null));
  if (!body) return NextResponse.json({ error: "Expected { document_id, status: \"ingested\" | \"failed\", chunk_count?, error? }." }, { status: 400, headers: noStore });

  try {
    const found = await recordIngestCallback(body);
    // A material deleted while it was being ingested is acknowledged (so the service doesn't retry) but changes nothing.
    return NextResponse.json({ ok: true, ...(found ? {} : { ignored: "unknown document_id" }) }, { headers: noStore });
  } catch {
    console.error("[ai-ingest callback] database update failed", { documentId: body.document_id });
    return NextResponse.json({ error: "Couldn't record the status. Please retry." }, { status: 500, headers: noStore });
  }
}
