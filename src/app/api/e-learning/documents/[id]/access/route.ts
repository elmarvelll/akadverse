// GET /api/e-learning/documents/[id]/access
//
// The ONLY way to open a course document. The storage bucket is private: this handler authenticates the
// caller, checks they may see THIS document (assigned lecturer, the department's HOD, or a student with an
// APPROVED registration for the document's course in its session/semester), then returns a 60-second signed
// Supabase URL as JSON. The browser then fetches the file straight from Supabase — the file never passes
// through this server, and no secret or storage credential is ever returned.
//
// `?inline=1` returns a URL the browser displays instead of downloading (used by Study Zone's PDF viewer). Same checks.

import { NextResponse } from "next/server";
import { requireElearningSession } from "@/services/e-learning/shared/auth";
import { resolveDownload } from "@/services/e-learning/shared/course-materials/resolve-download";
import { ServiceError } from "@/lib/service-error";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const inline = new URL(req.url).searchParams.get("inline") === "1";
  try {
    const session = await requireElearningSession();
    const { url, fileName } = await resolveDownload({ id: session.user.id, role: session.user.role }, id, { inline });
    return NextResponse.json({ url, fileName }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    if (e instanceof ServiceError) return NextResponse.json({ error: e.message }, { status: e.status });
    console.error("[document access]", e);
    return NextResponse.json({ error: "Couldn't open that file." }, { status: 500 });
  }
}
