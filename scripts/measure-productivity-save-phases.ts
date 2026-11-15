import "../tests/helpers/env";
import { signInAs } from "../tests/helpers/session";
import { PrismaClient } from "@prisma/client";
import { writeFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { localNow, type Dataset } from "../src/features/productivity/schedule/domain";
import { TaskService } from "../src/features/productivity/tasks/service";

Object.assign(process.env, { NODE_ENV: "development" });
const queries: number[] = [];
const db = new PrismaClient({ log: [{ level: "query", emit: "event" }] });
db.$on("query", event => queries.push(event.duration));
Object.assign(globalThis, { prisma: db, prismaDatabaseUrl: process.env.DATABASE_URL });

async function main() {
  const { makeUser } = await import("../tests/helpers/fixtures");
  const { executeProductivity } = await import("../services/productivity-layer/operations");
  const { withProductivityDiagnostics, diagnosticOperation } = await import("../services/productivity-layer/diagnostics");
  const user = await makeUser(); signInAs(user);
  const today = localNow("Africa/Lagos").date;
  const report: { label: string; fixture: object; operations: object[] } = { label: process.argv[2] || "before", fixture: { tasks: 640 }, operations: [] };
  let dataset = { version: 2 as const, tasks: [] as import("../src/features/productivity/tasks/domain").Task[] };
  const service = new TaskService({ load: async () => dataset, save: async value => { dataset = value; } }, { getCurrentStudent: async () => ({ id: user.id, name: "Local timing fixture", timezone: "Africa/Lagos", development: false }) });
  const originalInfo = console.info;
  let timing: unknown;
  console.info = (label, details) => { if (label === "Productivity timing") timing = details; else originalInfo(label, details); };
  const call = (operation: string, args: unknown[]) => withProductivityDiagnostics(async () => { diagnosticOperation(operation); return executeProductivity({ operation, args, requestId: randomUUID() }, user.id); });
  try {
    for (let index = 0; index < 640; index++) await service.createTask({ title: `Local task ${index}`, priority: "medium" });
    await db.productivityTask.createMany({ data: dataset.tasks.map(task => ({ id: task.id, ownerId: user.id, data: JSON.parse(JSON.stringify(task)), outcome: "unrecorded", createdAt: new Date(task.createdAt) })) });
    const schedule = await call("schedule.category", ["Local timing", "", undefined, false]) as Dataset;
    for (const [operation, args] of [
      ["tasks.create", [{ title: "Measured task", priority: "medium" }]],
      ["schedule.save", [{ title: "Measured event", description: "Local timing", priority: "medium", mustComplete: false, subScheduleId: schedule.schedules[0].id, slot: { date: today, start: "18:00", end: "19:00", timezone: "Africa/Lagos" } }]],
      ["habits.save", [{ name: "Measured habit", description: "", type: "task", frequency: "daily", weekdays: [], priority: "medium", time: "", startDate: today }]],
    ] as [string, unknown[]][]) {
      const at = queries.length, started = performance.now(); const result = await call(operation, args);
      const totalMs = Math.round(performance.now() - started), responseStarted = performance.now();
      const bytes = Buffer.byteLength(JSON.stringify({ result }));
      report.operations.push({ operation, totalMs, responsePreparationMs: Math.round(performance.now() - responseStarted), bytes, queryCount: queries.length - at, engineQueryMs: queries.slice(at).reduce((sum, value) => sum + value, 0), timing });
    }
    writeFileSync(`.local-development/productivity-save-phases-${report.label}.json`, JSON.stringify(report, null, 2));
    console.log(JSON.stringify(report, null, 2));
  } finally { console.info = originalInfo; await db.user.delete({ where: { id: user.id } }); await db.$disconnect(); }
}
main().catch(() => { console.error("Local save measurement failed; connection details and record contents omitted."); process.exitCode = 1; });
