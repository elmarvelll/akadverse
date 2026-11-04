// scripts/ai-ingest-backfill.ts
//
// Sends every course material the AI microservice doesn't have yet (never sent) for ingestion. Run once
// after AI_SERVICE_URL / AI_SERVICE_API_KEY are first set — new uploads are sent automatically from then on.
//
//   npm run ai:ingest-backfill              # enqueue them
//   npm run ai:ingest-backfill -- --dry-run # just list what would be sent
//
// Uses the same code path as an upload (services/e-learning/ai-ingest/ingest-material.ts), one document at a time.

import { elearningDb } from "../src/lib/db/elearning";
import { isAiIngestConfigured } from "../services/e-learning/ai-ingest/client";
import { sendMaterialForIngestion } from "../services/e-learning/ai-ingest/ingest-material";

async function main() {
  // The AI_SERVICE_* settings are read when called, so loading them here is early enough (real env vars win).
  for (const file of [".env.local", ".env"]) {
    try { process.loadEnvFile(file); } catch { /* file not present */ }
  }
  const dryRun = process.argv.includes("--dry-run");
  if (!isAiIngestConfigured() && !dryRun) throw new Error("Set AI_SERVICE_URL and AI_SERVICE_API_KEY first.");

  // Preserve historical remote identities for callbacks and administrative reconciliation.
  // Never resubmit them: the old implementation did not durably record admission.
  const legacy = await elearningDb.courseMaterial.findMany({
    where: { aiIngestStatus: { in: ["PENDING", "FAILED", "INGESTED"] }, aiTask: null },
  });
  for (const m of legacy) {
    if (!dryRun) await elearningDb.aiIngestTask.upsert({ where: { documentId: m.id }, update: {}, create: {
      documentId: m.id, materialId: m.id, state: m.aiIngestStatus === "INGESTED" ? "DONE" : "ATTENTION",
      submittedAt: m.aiIngestUpdatedAt ?? m.createdAt,
      callbackAt: m.aiIngestStatus === "INGESTED" ? m.aiIngestUpdatedAt ?? m.createdAt : null,
      lastError: m.aiIngestStatus === "INGESTED" ? null : "Historical submission requires remote reconciliation.",
    } });
  }
  console.log(`${legacy.length} historical identity record(s)${dryRun ? " to preserve (dry run)" : " preserved"}.`);

  const materials = await elearningDb.courseMaterial.findMany({
    where: { type: "NOTES", aiIngestStatus: null },
    select: { id: true, title: true, aiIngestStatus: true },
    orderBy: { createdAt: "asc" },
  });
  console.log(`${materials.length} material(s) to send${dryRun ? " (dry run)" : ""}.`);

  const tally: Record<string, number> = {};
  for (const m of materials) {
    const result = dryRun ? "would send" : ((await sendMaterialForIngestion(m.id)) ?? "skipped");
    tally[result] = (tally[result] ?? 0) + 1;
    console.log(`  ${result.padEnd(10)} ${m.id}  ${m.title}`);
  }
  console.log("Done:", tally);
}

main()
  .catch((e) => { console.error(e instanceof Error ? e.message : e); process.exitCode = 1; })
  .finally(() => elearningDb.$disconnect());
