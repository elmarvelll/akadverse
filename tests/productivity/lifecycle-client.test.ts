import { after, beforeEach, it, mock } from "node:test";
import assert from "node:assert/strict";
import { setProductivityAccount, prepareWorkspace, loadWorkspaceView, peekWorkspaceView, rpc, invalidateWorkspace } from "@/features/productivity/client";
import { localNow, addDays, type PersonalEvent, type Dataset } from "@/features/productivity/schedule/domain";
import { selectToday } from "@/features/productivity/today/selectors";
import type { WorkspaceInitial } from "@/features/productivity/workspace/data";
import type { Task, TaskViewStatus } from "@/features/productivity/tasks/domain";

const originalFetch = globalThis.fetch, originalWindow = globalThis.window;
beforeEach(() => { globalThis.window = new EventTarget() as unknown as Window & typeof globalThis; setProductivityAccount(""); setProductivityAccount("A"); });
after(() => { setProductivityAccount(""); globalThis.fetch = originalFetch; globalThis.window = originalWindow; });
function fixture(): WorkspaceInitial {
  const today = localNow("Africa/Lagos").date, at = new Date().toISOString();
  const statuses: TaskViewStatus[] = ["active", "pending", "completed", "missed"];
  const tasks: Task[] = statuses.map(status => ({ id: status, ownerId: "A", title: status, priority: "medium", source: { kind: "ordinary" }, status: status === "active" ? "pending" : status, dueDate: status === "pending" ? addDays(today, -1) : undefined, createdAt: at, updatedAt: at, history: [] }));
  return { snapshot: { student: { id: "A", name: "Test", timezone: "Africa/Lagos", development: false }, email: "a@example.test", serverTime: at, data: { tasks: { version: 2, tasks }, habits: { version: 1, habits: [] }, schedule: { version: 1, schedules: [], events: [] } }, occurrences: [], counts: { active: 1, pending: 1, completed: 1, missed: 1 }, hasMore: false }, taskPages: { active: { ids: ["active"], hasMore: false }, pending: { ids: ["pending"], hasMore: false }, completed: { ids: ["completed"], hasMore: false }, missed: { ids: ["missed"], hasMore: false } }, range: { start: today, end: today } };
}
it("prepares all sections and four task tabs through one shared batch without repeated reads", async () => {
  const calls: string[] = [];
  globalThis.fetch = async (_url, init) => { const body = JSON.parse(String(init?.body)); calls.push(body.operation); return Response.json({ result: fixture() }); };
  await Promise.all([prepareWorkspace(), loadWorkspaceView({ section: "today" }), loadWorkspaceView({ section: "tasks" })]);
  for (let repeat = 0; repeat < 2; repeat++) for (const section of ["today", "tasks", "schedule", "habits"] as const) assert.equal((await loadWorkspaceView({ section })).student.id, "A");
  for (const status of ["active", "pending", "completed", "missed"] as const) assert.equal((await loadWorkspaceView({ section: "tasks", status })).data.tasks.tasks[0].id, status);
  assert.deepEqual(calls, ["workspace.initial"]);
});
it("immediately updates Today from confirmed event saves, edits, moves and archives without another database read", async () => {
  globalThis.fetch = async () => Response.json({ result: fixture() }); await prepareWorkspace();
  const date = localNow("Africa/Lagos").date, at = new Date().toISOString();
  let event: PersonalEvent = { id: "saved-event", ownerId: "A", title: "Added in Schedule", description: "Saved", slot: { date, start: "16:00", end: "17:00", timezone: "Africa/Lagos" }, originalSlot: { date, start: "16:00", end: "17:00", timezone: "Africa/Lagos" }, source: { kind: "personal" }, priority: "medium", mustComplete: false, status: "pending", history: [], createdAt: at, updatedAt: at };
  const old = peekWorkspaceView({ section: "today" })!;
  globalThis.fetch = async (_url, init) => {
    const operation = JSON.parse(String(init?.body)).operation;
    assert.ok(operation.startsWith("schedule."), "showing Today must not require a fresh database read after a confirmed save");
    const result: Dataset = { version: 1, schedules: [], events: [event, { ...event, id: "foreign-event", ownerId: "B" }] };
    return Response.json({ result });
  };
  await rpc("schedule.save", [{}]);
  let today = await loadWorkspaceView({ section: "today" });
  assert.deepEqual(today.data.schedule.events.map(row => row.id), ["saved-event"]); assert.equal(old.data.schedule.events.length, 0);
  event = { ...event, title: "Edited event" }; await rpc("schedule.save", [{}, event.id]);
  today = await loadWorkspaceView({ section: "today" }); assert.equal(today.data.schedule.events[0].title, "Edited event");
  event = { ...event, slot: { ...event.slot, date: addDays(date, 1) } }; await rpc("schedule.save", [{}, event.id]);
  assert.equal((await loadWorkspaceView({ section: "today" })).data.schedule.events.length, 0);
  event = { ...event, slot: { ...event.slot, date }, archivedAt: at }; await rpc("schedule.archive", [event.id]);
  today = await loadWorkspaceView({ section: "today" });
  assert.equal(selectToday({ tasks: today.data.tasks.tasks, data: today.data.schedule, habits: [], occurrences: [], classes: [], student: today.student, instant: new Date() }).events.length, 0);
});
it("does not let an older Today response replace a confirmed saved event", async () => {
  globalThis.fetch = async () => Response.json({ result: fixture() }); await prepareWorkspace();
  let resolve!: (response: Response) => void, reads = 0;
  const date = localNow("Africa/Lagos").date;
  globalThis.fetch = async (_url, init) => {
    const operation = JSON.parse(String(init?.body)).operation;
    if (operation === "workspace.view") { reads++; return new Promise<Response>(done => { resolve = done; }); }
    return Response.json({ result: { version: 1, schedules: [], events: [{ id: "new", ownerId: "A", title: "Confirmed", slot: { date, start: "10:00", end: "11:00", timezone: "Africa/Lagos" }, originalSlot: { date }, createdAt: new Date().toISOString() }] } });
  };
  invalidateWorkspace(["today"]); const pending = loadWorkspaceView({ section: "today" });
  await Promise.resolve(); await Promise.resolve();
  await rpc("schedule.save", [{}]); resolve(Response.json({ result: fixture().snapshot }));
  assert.equal((await pending).data.schedule.events[0].id, "new"); assert.equal(reads, 1);
});
it("shows a new task in prepared views only after confirmation, without a second read", async () => {
  globalThis.fetch = async () => Response.json({ result: fixture() }); await prepareWorkspace();
  let resolve!: (response: Response) => void, calls = 0;
  globalThis.fetch = async () => { calls++; return new Promise<Response>(done => { resolve = done; }); };
  const before = peekWorkspaceView({ section: "today" })!;
  const pending = rpc<Task>("tasks.create", [{ title: "Confirmed task", priority: "medium" }]);
  assert.equal(peekWorkspaceView({ section: "today" })!.data.tasks.tasks.some(row => row.id === "confirmed"), false);
  const task: Task = { ...before.data.tasks.tasks[0], id: "confirmed", title: "Confirmed task", status: "pending", dueDate: undefined, source: { kind: "ordinary" } };
  resolve(Response.json({ result: task })); await pending;
  const today = await loadWorkspaceView({ section: "today" }), tasks = await loadWorkspaceView({ section: "tasks" });
  assert.ok(today.data.tasks.tasks.some(row => row.id === task.id)); assert.ok(tasks.data.tasks.tasks.some(row => row.id === task.id));
  assert.equal(tasks.counts!.active, before.counts!.active + 1); assert.equal(calls, 1);
});
it("merges a confirmed habit definition and today's durable projection without blocking on month generation", async () => {
  globalThis.fetch = async () => Response.json({ result: fixture() }); await prepareWorkspace();
  const at = new Date().toISOString(), date = localNow("Africa/Lagos").date;
  const settings = { name: "Confirmed habit", description: "", type: "task" as const, frequency: "daily" as const, weekdays: [], priority: "medium" as const, time: "", effectiveDate: date, at, archived: false };
  const task: Task = { id: "new-habit-task", ownerId: "A", title: settings.name, priority: "medium", status: "pending", dueDate: date, source: { kind: "habit", habitId: "new-habit", habitName: settings.name, occurrenceId: `new-habit:${date}`, scheduledDate: date }, createdAt: at, updatedAt: at, history: [] };
  let calls = 0;
  globalThis.fetch = async () => { calls++; return Response.json({ result: { id: "new-habit", ownerId: "A", timezone: "Africa/Lagos", createdDate: date, createdAt: at, revisions: [settings], savedOccurrences: [{ id: `new-habit:${date}`, habitId: "new-habit", date, settings, task }] } }); };
  await rpc("habits.save", [settings]);
  const habits = await loadWorkspaceView({ section: "habits" }), today = await loadWorkspaceView({ section: "today" });
  assert.ok(habits.data.habits.habits.some(row => row.id === "new-habit"));
  assert.equal(habits.occurrences.find(row => row.habitId === "new-habit")?.task?.id, task.id);
  assert.ok(today.data.tasks.tasks.some(row => row.id === task.id)); assert.equal(calls, 1);
});
it("reuses both pending and completed official ranges for the Today widget", async () => {
  await (async () => { globalThis.fetch = async () => Response.json({ result: fixture() }); await prepareWorkspace(); })();
  let calls = 0, resolve!: (response: Response) => void;
  globalThis.fetch = async () => { calls++; return new Promise<Response>(done => { resolve = done; }); };
  const date = localNow("Africa/Lagos").date;
  const week = rpc("official.range", [{ start: addDays(date, -3), end: addDays(date, 3) }]);
  const today = rpc("official.range", [{ start: date, end: date }]);
  assert.equal(calls, 1); resolve(Response.json({ result: { rows: [], failedDates: [], error: "" } }));
  await Promise.all([week, today]); await rpc("official.range", [{ start: date, end: date }]); assert.equal(calls, 1);
  invalidateWorkspace(["official"]);
  const retried = rpc("official.range", [{ start: date, end: date }]); assert.equal(calls, 2);
  resolve(Response.json({ result: { rows: [], failedDates: [], error: "" } })); await retried;
});
it("keeps prepared sections usable when task history preparation fails", async () => {
  let calls = 0;
  globalThis.fetch = async (_url, init) => {
    calls++; const operation = JSON.parse(String(init?.body)).operation, initial = fixture();
    if (operation === "workspace.initial") { delete initial.taskPages; initial.taskError = "Task history is temporarily unavailable."; return Response.json({ result: initial }); }
    return Response.json({ result: initial.snapshot });
  };
  await prepareWorkspace();
  for (const section of ["today", "schedule", "habits"] as const) assert.equal((await loadWorkspaceView({ section })).student.id, "A");
  assert.equal(calls, 1);
  await loadWorkspaceView({ section: "tasks" }); assert.equal(calls, 2);
});
it("invalidates connected views and prevents a stale read from overwriting a completed mutation", async () => {
  globalThis.fetch = async () => Response.json({ result: fixture() }); await prepareWorkspace();
  const calls: string[] = []; let resolve!: (response: Response) => void, reads = 0;
  globalThis.fetch = async (_url, init) => {
    const body = JSON.parse(String(init?.body)); calls.push(body.operation);
    if (body.operation === "tasks.complete") return Response.json({ result: { id: "habit", source: { kind: "habit" } } });
    if (++reads === 1) return new Promise<Response>(done => { resolve = done; });
    const snapshot = fixture().snapshot; snapshot.data.tasks.tasks[0].title = "Latest saved value";
    return Response.json({ result: snapshot });
  };
  invalidateWorkspace(["tasks"]);
  const pending = loadWorkspaceView({ section: "tasks" });
  await Promise.resolve(); await Promise.resolve();
  await rpc("tasks.complete", ["habit"]);
  resolve(Response.json({ result: fixture().snapshot }));
  const result = await pending; assert.equal(result.data.tasks.tasks[0].title, "Latest saved value");
  assert.equal(calls.filter(operation => operation === "workspace.view").length, 2);
  const before = calls.length; await loadWorkspaceView({ section: "schedule" }); assert.equal(calls.length, before);
  await loadWorkspaceView({ section: "today" }); await loadWorkspaceView({ section: "habits" }); assert.equal(calls.length, before + 2);
});
it("does not repeat a failed initial batch automatically and allows a section-local fallback", async () => {
  const calls: string[] = [];
  globalThis.fetch = async (_url, init) => { const operation = JSON.parse(String(init?.body)).operation; calls.push(operation); return operation === "workspace.initial" ? Response.json({ error: "Temporary failure", code: "DATABASE_TIMEOUT" }, { status: 503 }) : Response.json({ result: fixture().snapshot }); };
  await assert.rejects(prepareWorkspace()); await loadWorkspaceView({ section: "today" }); await loadWorkspaceView({ section: "today" });
  assert.deepEqual(calls, ["workspace.initial", "workspace.view"]);
});
it("replaces an initial snapshot that raced a mutation and immediately adopts timezone preferences", async () => {
  let resolve!: (response: Response) => void, batches = 0;
  globalThis.fetch = async (_url, init) => {
    const operation = JSON.parse(String(init?.body)).operation;
    if (operation === "workspace.initial") {
      if (++batches === 1) return new Promise<Response>(done => { resolve = done; });
      const value = fixture(); value.snapshot.data.tasks.tasks[0].title = "Saved during preparation"; return Response.json({ result: value });
    }
    return Response.json({ result: operation === "preferences.save" ? { id: "A", name: "Test", timezone: "America/New_York", development: false } : { id: "new", source: { kind: "ordinary" } } });
  };
  const pending = prepareWorkspace(); await rpc("tasks.create", [{ title: "New task" }]);
  resolve(Response.json({ result: fixture() }));
  assert.equal((await pending).snapshot.data.tasks.tasks[0].title, "Saved during preparation"); assert.equal(batches, 2);
  await rpc("preferences.save", ["America/New_York"]);
  assert.equal((await rpc<{ student: { timezone: string } }>("context")).student.timezone, "America/New_York");
});
it("rejects an initial response from an old account and uses new date keys at local midnight", async () => {
  let resolve!: (response: Response) => void;
  globalThis.fetch = async () => new Promise<Response>(done => { resolve = done; });
  const old = prepareWorkspace(); setProductivityAccount("B"); resolve(Response.json({ result: fixture() }));
  await assert.rejects(old); assert.equal(peekWorkspaceView({ section: "today" }), undefined);
  mock.timers.enable({ apis: ["Date"], now: new Date("2026-11-14T22:59:59Z") });
  try {
    setProductivityAccount(""); setProductivityAccount("A"); let calls = 0;
    globalThis.fetch = async (_url, init) => { calls++; const operation = JSON.parse(String(init?.body)).operation; return Response.json({ result: operation === "workspace.initial" ? fixture() : fixture().snapshot }); };
    await prepareWorkspace(); assert.ok(peekWorkspaceView({ section: "today" }));
    mock.timers.tick(2000); assert.equal(peekWorkspaceView({ section: "today" }), undefined);
    await loadWorkspaceView({ section: "today" }); assert.equal(calls, 2);
  } finally { mock.timers.reset(); }
});
it("does not extend freshness indefinitely when cached views are read repeatedly", async () => {
  mock.timers.enable({ apis: ["Date"], now: new Date("2026-11-14T12:00:00Z") });
  try {
    setProductivityAccount(""); setProductivityAccount("A"); let calls = 0;
    globalThis.fetch = async (_url, init) => { calls++; const operation = JSON.parse(String(init?.body)).operation; return Response.json({ result: operation === "workspace.initial" ? fixture() : fixture().snapshot }); };
    await prepareWorkspace(); mock.timers.tick(30000); await loadWorkspaceView({ section: "today" }); assert.equal(calls, 1);
    mock.timers.tick(31000); await loadWorkspaceView({ section: "today" }); assert.equal(calls, 2);
  } finally { mock.timers.reset(); }
});
