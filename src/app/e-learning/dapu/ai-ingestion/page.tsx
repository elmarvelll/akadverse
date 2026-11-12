import { requireElearningRole } from "@/services/e-learning/shared/auth";
import { elearningDb } from "@/lib/db/elearning";
import { retryTaskAction } from "./actions";
import { requestHealth } from "@/services/e-learning/ai-ingest/client";
export default async function AiIngestionPage() {
  await requireElearningRole(["dapu"]);
  const health = await requestHealth().catch(() => null);
  const [counts, tasks, eligible, unsupported] = await Promise.all([
    elearningDb.aiIngestTask.groupBy({ by: ["operation", "state"], _count: true }),
    elearningDb.aiIngestTask.findMany({ where: { state: { not: "DONE" } }, orderBy: { updatedAt: "desc" }, take: 100, include: { material: { select: { title: true } } } }),
    elearningDb.courseMaterial.count({ where: { type: "NOTES" } }),
    elearningDb.courseMaterial.count({ where: { aiIngestStatus: "UNSUPPORTED_FORMAT" } }),
  ]);
  return <div className="space-y-6">
    <h1 className="text-2xl font-bold">Lecture note AI processing</h1>
    <p>AI service: {health ? "reachable" : "unavailable"}. Ingestion: {String(health?.ingest_status ?? "unknown")}. Worker: {String(health?.worker_status ?? "unknown")}. Configured workers: {String(health?.worker_count ?? "unknown")}.</p>
    <p className="text-sm text-gray-600">Health reports configuration and reported state; it does not verify generation, quota, billing, or individual worker health.</p>
    <p>Lecture notes: {eligible}. Unsupported materials: {unsupported}.</p>
    <ul>{counts.map((c) => <li key={`${c.operation}-${c.state}`}>{c.operation === "DELETE" ? "Cleanup" : "Ingestion"} · {c.state}: {c._count}</li>)}</ul>
    <p className="text-sm text-gray-600">Queued tasks have no confirmed processing-start signal. Missing callbacks are reconciled through remote status checks. Missing remote records and uncertain cleanup require administrator review.</p>
    <div className="overflow-x-auto"><table className="w-full text-left text-sm">
      <caption className="text-left">Latest 100 outstanding tasks</caption>
      <thead><tr><th>Document</th><th>Status</th><th>Attempts</th><th>Last attempt</th><th>Next attempt</th><th>Last error</th><th>Action</th></tr></thead>
      <tbody>{tasks.map((t) => <tr key={t.id} className="border-t">
        <td className="p-2">{t.material?.title ?? "Deleted material"}<br /><span className="text-xs text-gray-500">{t.documentId}</span></td>
        <td>{t.operation} · {t.state}</td><td>{t.attempts}</td><td>{t.lastAttemptAt?.toISOString() ?? "—"}</td><td>{["READY", "RETRY"].includes(t.state) ? t.nextAttemptAt.toISOString() : "—"}</td><td>{t.lastError ?? "—"}</td>
        <td>{t.state === "ATTENTION" && (t.operation === "DELETE" || (!t.submittedAt && !t.callbackAt))
          ? <form action={retryTaskAction}><input type="hidden" name="taskId" value={t.id} /><button className="text-blue-700 underline">Retry after correction</button></form>
          : t.state === "ATTENTION" ? "Remote reconciliation required" : "—"}</td>
      </tr>)}</tbody>
    </table></div>
  </div>;
}
