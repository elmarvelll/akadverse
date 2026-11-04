// src/app/e-learning/faculty/my-subjects/[offeringId]/page.tsx
//
// One subject for its lecturer: Overview · Weekly Course Content (what students see, grouped by week)
// · Upload Material. Authorization: the viewer must be assigned to THIS offering.

import Link from "next/link";
import { notFound } from "next/navigation";
import { requireElearningRole } from "@/services/e-learning/shared/auth";
import { requireMySubject } from "@/services/e-learning/faculty/my-subjects";
import { getOfferingDetail } from "@/services/e-learning/shared/offering-detail";
import { MATERIAL_LABELS, weekRangeLabel, type MaterialType } from "@/lib/course-materials/config";
import { ServiceError } from "@/lib/service-error";
import DocumentLink from "@/app/e-learning/_components/DocumentLink";
import { isAiIngestConfigured } from "@/services/e-learning/ai-ingest/client";
import { AI_INGEST_STALE_MS } from "@/services/e-learning/ai-ingest/ingest-material";
import UploadMaterial from "./UploadMaterial";
import DeleteMaterialButton from "./DeleteMaterialButton";
import AiIngestBadge, { type AiBadgeState } from "./AiIngestBadge";

function aiBadge(m: { aiIngestStatus: string | null; aiIngestUpdatedAt: Date | null; aiIngestError: string | null; aiChunkCount: number | null }, now: number): { state: AiBadgeState; detail: string | null } {
  switch (m.aiIngestStatus) {
    case "INGESTED":
      return { state: "ingested", detail: m.aiChunkCount != null ? `Indexed in ${m.aiChunkCount} chunks` : null };
    case "UNSUPPORTED_FORMAT":
      return { state: "unsupported", detail: "AI supports PDF, DOCX and PPTX lecture notes." };
    case "RETRY_PENDING":
      return { state: "retry", detail: null };
    case "FAILED":
      return { state: "failed", detail: "Administrator review required." };
    case "PENDING":
      return now - (m.aiIngestUpdatedAt?.getTime() ?? 0) > AI_INGEST_STALE_MS ? { state: "stuck", detail: "No reply from the AI service yet" } : { state: "pending", detail: null };
    default:
      return { state: "none", detail: null };
  }
}

export default async function SubjectPage({ params, searchParams }: { params: Promise<{ offeringId: string }>; searchParams: Promise<{ week?: string }> }) {
  const { offeringId } = await params;
  // ?week=N comes from a week's "Add document" link and only preselects the upload form's week.
  const requestedWeek = Number((await searchParams).week);
  const session = await requireElearningRole(["faculty"]);
  let role;
  try {
    role = await requireMySubject(session.user.id, offeringId);
  } catch (e) {
    if (e instanceof ServiceError) notFound(); // don't reveal whether an offering exists
    throw e;
  }
  const d = await getOfferingDetail(offeringId);
  const weeks = Array.from({ length: d.totalWeeks }, (_, i) => i + 1);
  const initialWeek = Number.isInteger(requestedWeek) && requestedWeek >= 1 && requestedWeek <= d.totalWeeks ? requestedWeek : 1;
  const documentsPerWeek = Object.fromEntries(weeks.map((w) => [w, d.materials.filter((m) => m.startWeek <= w && w <= m.endWeek).length]));
  // The AI badge appears only once the AI microservice is connected (services/e-learning/ai-ingest/client.ts).
  const aiEnabled = isAiIngestConfigured();
  // eslint-disable-next-line react-hooks/purity -- a server component renders once per request; "now" is that request's time
  const now = Date.now();

  return (
    <div className="space-y-8">
      <div>
        <Link href="/e-learning/faculty/my-subjects" className="text-sm text-blue-700 underline">← My Subjects</Link>
        <h1 className="mt-2 text-2xl font-bold text-gray-900">{d.course.code} — {d.course.title}</h1>
        <p className="text-sm text-gray-800 mt-1">{d.programme.name} · {d.level} Level · {d.sessionName} · {d.semesterName}</p>
      </div>

      <section className="rounded-2xl border border-gray-200 bg-white p-5 space-y-3">
        <h2 className="text-lg font-semibold text-gray-900">Overview</h2>
        <dl className="grid gap-3 text-sm sm:grid-cols-3">
          <div><dt className="text-gray-700">Credit units</dt><dd className="font-medium text-gray-900">{d.creditUnits}</dd></div>
          <div><dt className="text-gray-700">Your role</dt><dd className="font-medium text-gray-900">{role === "COORDINATOR" ? "Course Coordinator" : "Lecturer"}</dd></div>
          <div><dt className="text-gray-700">Department</dt><dd className="font-medium text-gray-900">{d.course.department ?? "—"}</dd></div>
        </dl>
        {d.course.description && <p className="text-sm text-gray-900">{d.course.description}</p>}
        <div>
          <p className="text-sm text-gray-700">Lecturers</p>
          <ul className="text-sm text-gray-900">
            {d.lecturers.map((l) => <li key={l.userId}>{l.name}{l.role === "COORDINATOR" ? " (Coordinator)" : ""}</li>)}
          </ul>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-gray-900">Weekly Course Content</h2>
        <div className="space-y-2">
          {weeks.map((w) => {
            const items = d.materials.filter((m) => m.startWeek <= w && w <= m.endWeek);
            return (
              <div key={w} className="rounded-xl border border-gray-200 bg-white p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-gray-900">
                    Week {w}
                    {items.length > 0 && <span className="ml-2 font-normal text-gray-700">{items.length} document{items.length === 1 ? "" : "s"}</span>}
                  </p>
                  <Link href={`?week=${w}#upload-material`} className="text-sm font-medium text-blue-700 underline">
                    {items.length === 0 ? "Add a document" : "Add another document"}
                  </Link>
                </div>
                {items.length === 0 ? (
                  <p className="text-sm text-gray-700 mt-1">Nothing uploaded for this week.</p>
                ) : (
                  <ul className="mt-2 space-y-2">
                    {items.map((m) => (
                      <li key={m.id} className="flex flex-wrap items-start gap-2 text-sm">
                        <div className="min-w-0 flex-1">
                          <DocumentLink id={m.id} title={`${MATERIAL_LABELS[m.type as MaterialType].singular}: ${m.title}`} mimeType={m.mimeType} fileSize={m.fileSize} detail={weekRangeLabel(m.startWeek, m.endWeek)} />
                          {aiEnabled && m.type === "NOTES" && <div className="mt-1"><AiIngestBadge offeringId={d.id} materialId={m.id} {...aiBadge(m, now)} /></div>}
                        </div>
                        <DeleteMaterialButton offeringId={d.id} materialId={m.id} />
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            );
          })}
        </div>
      </section>

      <section id="upload-material" className="scroll-mt-24 space-y-3">
        <h2 className="text-lg font-semibold text-gray-900">Upload Material</h2>
        <p className="text-sm text-gray-800">Each week can hold several documents. Uploading adds a new document — it never replaces one that is already there. To remove a document, use its Delete button above.</p>
        {/* Keyed by week so following another week's "Add document" link re-seeds the form's week. */}
        <UploadMaterial key={initialWeek} offeringId={d.id} totalWeeks={d.totalWeeks} initialWeek={initialWeek} documentsPerWeek={documentsPerWeek} />
      </section>
    </div>
  );
}
