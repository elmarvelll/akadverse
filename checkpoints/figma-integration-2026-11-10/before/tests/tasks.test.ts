import { TaskService } from "../src/features/tasks/service.ts";
import test from "node:test";
import assert from "node:assert/strict";
import { isTaskOverdue, taskViewStatus, millisecondsToNextMinute, emptyTasks, type Task, type TaskInput } from "../src/features/tasks/domain.ts";
import { BrowserTaskRepository, TASK_STORAGE_KEY, parseTaskDataset } from "../src/features/tasks/storage.ts";
import { queryTasks, taskDaySummary, taskStatusCounts, taskHref, type TaskSort } from "../src/features/tasks/queries.ts";
import { HabitTaskGateway } from "../src/features/tasks/habits.ts";
import { workspaceLocation, SCHEDULE_HREF, TASKS_HREF } from "../src/features/workspace/navigation.ts";
import { developmentIdentity, sampleAcademics } from "../src/features/schedule/adapters.ts";
import { BrowserScheduleRepository, STORAGE_KEY } from "../src/features/schedule/storage.ts";
import { ScheduleService } from "../src/features/schedule/domain.ts";

const input = (overrides: Partial<TaskInput> = {}): TaskInput => ({ title: "Read chapter two", description: "", priority: "medium", ...overrides });
function fixture() {
  const values = new Map<string, string>();
  let failRead = false, failWrite = false;
  const storage = {
    getItem(key: string) { if (failRead) throw new Error("denied"); return values.get(key) ?? null; },
    setItem(key: string, value: string) { if (failWrite) throw new Error("quota"); values.set(key, value); },
  };
  const repo = () => new BrowserTaskRepository(() => storage);
  const service = (clock?: () => Date) => new TaskService(repo(), developmentIdentity, clock);
  return { values, storage, repo, service, failRead(value: boolean) { failRead = value; }, failWrite(value: boolean) { failWrite = value; } };
}
test("complete journey: create, reload, edit, filter, sort, exact details, complete, history, reload", async () => {
  const f = fixture();
  const created = await f.service().createTask(input({ dueDate: "2030-11-04" }));
  const service = f.service();
  assert.equal((await service.getTask(created.id)).title, "Read chapter two");
  const edited = await service.updateTask(created.id, input({ title: "Read and annotate", priority: "high", dueDate: "2030-11-05", dueTime: "18:00" }));
  const tasks = await service.listTasks();
  const visible = queryTasks(tasks, { timezone: "Africa/Lagos", filters: { dueDate: "2030-11-05", priority: "high" }, sort: "due-earliest" });
  assert.equal(visible[0].id, created.id);
  assert.equal((await service.getTask(visible[0].id)).title, edited.title);
  assert.equal((await service.getTask(created.id)).history[1].snapshot.title, "Read chapter two");
  const completed = await service.completeTask(created.id);
  assert.equal(queryTasks(await service.listTasks(), { timezone: "Africa/Lagos" }).length, 0);
  assert.equal((await service.getHistory())[0].id, created.id);
  assert.equal((await f.service().getHistory())[0].completedAt, completed.completedAt);
  assert.equal(completed.dueTime, "18:00");
  assert.deepEqual(completed.history.map(entry => entry.kind), ["created", "edited", "completed"]);
});
test("repeated and concurrent completion preserve the first timestamp and one completion audit", async () => {
  const s = fixture().service(), task = await s.createTask(input());
  const [first, second] = await Promise.all([s.completeTask(task.id), s.completeTask(task.id)]);
  const again = await s.completeTask(task.id);
  assert.equal(first.completedAt, second.completedAt);
  assert.equal(again.completedAt, first.completedAt);
  assert.equal(again.history.filter(entry => entry.kind === "completed").length, 1);
  await assert.rejects(s.updateTask(task.id, input()), /unfinished/);
});
test("deleting ordinary tasks hides them without completing or erasing audit records", async () => {
  const s = fixture().service(), created = await s.createTask(input());
  const deleted = await s.deleteTask(created.id);
  assert.equal(deleted.status, "pending");
  assert.equal(deleted.completedAt, undefined);
  assert.ok((await s.getTask(created.id)).deletedAt);
  assert.equal(queryTasks(await s.listTasks(), { timezone: "Africa/Lagos" }).length, 0);
  assert.equal((await s.getHistory()).length, 0);
  assert.equal((await s.deleteTask(created.id)).history.filter(entry => entry.kind === "deleted").length, 1);
  await assert.rejects(s.completeTask(created.id), /Deleted/);
  const complete = await s.createTask(input());
  await s.completeTask(complete.id);
  const removedComplete = await s.deleteTask(complete.id);
  assert.deepEqual(removedComplete.history.map(entry => entry.kind), ["created", "completed", "deleted"]);
});
test("titles, priorities and deadlines validate; absent dates never invent a time", async () => {
  const s = fixture().service();
  const undated = await s.createTask(input());
  assert.equal(undated.dueDate, undefined); assert.equal(undated.dueTime, undefined);
  const dateOnly = await s.createTask(input({ dueDate: "2030-11-04" }));
  assert.equal(dateOnly.dueTime, undefined);
  for (const invalid of [input({ title: " " }), input({ priority: "urgent" as TaskInput["priority"] }), input({ dueTime: "18:00" }), input({ dueDate: "2030-02-30" }), input({ dueDate: "2030-01-01", dueTime: "24:00" })]) await assert.rejects(s.createTask(invalid));
});
test("creation-date, intended-date and priority filters combine using student local dates", async () => {
  const s = fixture().service();
  const a = await s.createTask(input({ priority: "high", dueDate: "2030-11-05" }));
  const b = await s.createTask(input({ priority: "low", dueDate: "2030-11-05" }));
  const c = await s.createTask(input({ priority: "high" }));
  const tasks = [a, b, c].map(task => ({ ...task, createdAt: "2030-11-04T23:30:00Z" }));
  const before = structuredClone(tasks);
  assert.deepEqual(queryTasks(tasks, { timezone: "Africa/Lagos", filters: { createdDate: "2030-11-05", dueDate: "2030-11-05", priority: "high" } }).map(task => task.id), [a.id]);
  assert.equal(queryTasks(tasks, { timezone: "Africa/Lagos", filters: { createdDate: "2030-11-04" } }).length, 0);
  assert.equal(queryTasks(tasks, { timezone: "Africa/Lagos", filters: { dueDate: "2030-11-05" } }).length, 2);
  assert.deepEqual(tasks, before);
});
test("all sort modes are deterministic, nonmutating, and leave undated tasks after dated tasks", async () => {
  const s = fixture().service();
  const tasks = [await s.createTask(input({ priority: "low" })), await s.createTask(input({ priority: "high", dueDate: "2030-11-04" })), await s.createTask(input({ priority: "medium", dueDate: "2030-11-05" }))];
  const before = structuredClone(tasks);
  for (const sort of ["newest", "oldest", "due-earliest", "due-latest", "priority-high", "priority-low"] satisfies TaskSort[]) {
    assert.deepEqual(queryTasks(tasks, { timezone: "Africa/Lagos", sort }), queryTasks([...tasks].reverse(), { timezone: "Africa/Lagos", sort }));
    assert.deepEqual(tasks, before);
  }
  assert.deepEqual(queryTasks(tasks, { timezone: "Africa/Lagos", sort: "due-earliest" }).map(task => task.id), [tasks[1].id, tasks[2].id, tasks[0].id]);
  assert.deepEqual(queryTasks(tasks, { timezone: "Africa/Lagos", sort: "due-latest" }).map(task => task.id), [tasks[2].id, tasks[1].id, tasks[0].id]);
  assert.equal(queryTasks(tasks, { timezone: "Africa/Lagos", sort: "priority-high" })[0].priority, "high");
  assert.equal(queryTasks(tasks, { timezone: "Africa/Lagos", sort: "priority-low" })[0].priority, "low");
});
test("date-only deadlines become overdue after the local day ends; time passing never records an outcome", async () => {
  const s = fixture().service();
  const task = await s.createTask(input({ dueDate: "2030-11-04" }));
  assert.equal(isTaskOverdue(task, "Africa/Lagos", new Date("2030-11-04T22:59:00Z")), false);
  assert.equal(isTaskOverdue(task, "Africa/Lagos", new Date("2030-11-04T23:00:00Z")), true);
  const timed = { ...task, dueTime: "18:00" };
  assert.equal(isTaskOverdue(timed, "Africa/Lagos", new Date("2030-11-04T17:00:00Z")), false);
  assert.equal(isTaskOverdue(timed, "Africa/Lagos", new Date("2030-11-04T17:01:00Z")), true);
  assert.equal((await s.getTask(task.id)).status, "pending");
  assert.equal((await s.getTask(task.id)).dueDate, "2030-11-04");
});

const occurrence = (occurrenceId: string, date: string) => ({ ...input({ title: "Read for twenty minutes", priority: "high" }), habitId: "reading", habitName: "Reading", occurrenceId, scheduledDate: date });
test("habit tasks share exactly one outcome with tracker cells, day totals and read-only summaries", async () => {
  const f = fixture(), s = f.service(() => new Date("2030-11-04T10:00:00Z")), tracker = new HabitTaskGateway(s);
  const dates = ["2030-11-04", "2030-11-06", "2030-11-08"];
  const monday = await tracker.receive(occurrence("monday", dates[0]), dates);
  await tracker.receive(occurrence("wednesday", dates[1]), dates);
  assert.equal((await tracker.receive(occurrence("monday", dates[0]), dates)).id, monday.id);
  assert.equal((await s.listTasks()).length, 2);
  await s.completeTask(monday.id);
  assert.equal((await new HabitTaskGateway(f.service()).getOccurrence("reading", "monday")).status, "completed");
  assert.equal((await tracker.getOccurrence("reading", "wednesday")).status, "pending");
  assert.deepEqual(await tracker.totals(dates[0]), { scheduled: 1, completed: 1, missed: 0, pending: 0 });
  assert.deepEqual(await tracker.totals(dates[1]), { scheduled: 1, completed: 0, missed: 0, pending: 1 });
  assert.equal(taskDaySummary(await s.listTasks(), dates[0]).completed, 1);
  await tracker.completeOccurrence("reading", "monday");
  assert.equal((await s.getTask(monday.id)).history.filter(entry => entry.kind === "completed").length, 1);
  await assert.rejects(s.updateTask(monday.id, input()), /read-only/);
  await assert.rejects(s.deleteTask(monday.id), /cannot be deleted/);
  await assert.rejects(tracker.receive(occurrence("tuesday", "2030-11-05"), dates), /actual schedule/);
  await assert.rejects(tracker.receive(occurrence("monday", dates[1]), dates), /another date/);
});
test("habit missed and unrecorded outcomes stay distinct; late completion keeps missed history", async () => {
  const s = fixture().service(), tracker = new HabitTaskGateway(s);
  const task = await tracker.receive(occurrence("monday", "2020-11-04"), ["2020-11-04"]);
  assert.equal((await tracker.getOccurrence("reading", "monday")).status, "pending");
  await tracker.recordMiss("reading", "monday");
  assert.equal((await s.getTask(task.id)).status, "missed");
  await s.completeTask(task.id);
  assert.deepEqual((await s.getTask(task.id)).history.map(entry => entry.kind), ["created", "missed", "completed"]);
});
test("exact task links resolve the requested task without completing it", async () => {
  const s = fixture().service();
  await s.createTask(input({ title: "Another task" }));
  const target = await s.createTask(input({ title: "The task Today should open", dueDate: "2030-11-04" }));
  const summary = taskDaySummary(await s.listTasks(), "2030-11-04");
  assert.equal(summary.items[0].href, taskHref(target.id));
  const routedId = workspaceLocation(new URL(summary.items[0].href, "http://localhost:3000").hash).taskId!;
  assert.equal((await s.getTask(routedId)).title, target.title);
  assert.equal((await s.getTask(routedId)).status, "pending");
  await assert.rejects(s.getTask("missing"), /not found/);
});
test("workspace sections and exact task links stay on the root route", () => {
  for (const href of [SCHEDULE_HREF, TASKS_HREF, taskHref("task / + ? # & é")]) {
    assert.equal(new URL(href, "http://localhost:3000").pathname, "/");
  }
  assert.deepEqual(workspaceLocation(""), { section: "schedule" });
  assert.deepEqual(workspaceLocation("#schedule"), { section: "schedule" });
  assert.deepEqual(workspaceLocation("#tasks"), { section: "tasks" });
  assert.equal(workspaceLocation(new URL(taskHref("task / + ? # & é"), "http://localhost:3000").hash).taskId, "task / + ? # & é");
  assert.deepEqual(workspaceLocation("#tasks?task="), { section: "tasks", taskId: undefined });
});
test("identity separates task records and occurrence keys", async () => {
  const f = fixture(), alice = f.service();
  const task = await alice.createTask(input());
  const bob = new TaskService(f.repo(), { async getCurrentStudent() { return { ...(await developmentIdentity.getCurrentStudent()), id: "bob" }; } });
  assert.equal((await bob.listTasks()).length, 0);
  await assert.rejects(bob.completeTask(task.id), /not found/);
  const own = await bob.createTask(input());
  assert.equal((await alice.listTasks()).length, 1);
  assert.notEqual(own.ownerId, task.ownerId);
});
test("invalid or unavailable storage is never replaced silently", async () => {
  const f = fixture();
  assert.deepEqual(await f.repo().load(), emptyTasks());
  for (const raw of ["{", '{"version":3,"tasks":[]}', '{"version":1,"tasks":[{}]}']) {
    f.values.set(TASK_STORAGE_KEY, raw);
    const repo = f.repo();
    await assert.rejects(repo.load());
    await assert.rejects(repo.save(emptyTasks()), /Load task data/);
    assert.equal(f.values.get(TASK_STORAGE_KEY), raw);
  }
  f.failRead(true);
  await assert.rejects(f.service().listTasks(), /unavailable/);
});
test("malformed sources, duplicate occurrences and inconsistent completion audits are rejected", async () => {
  const f = fixture(), s = f.service();
  await new HabitTaskGateway(s).receive(occurrence("monday", "2030-11-04"), ["2030-11-04"]);
  const original = parseTaskDataset(f.values.get(TASK_STORAGE_KEY)!);
  const malformed: ((tasks: Task[]) => void)[] = [
    tasks => { tasks[0].dueDate = "2030-11-05"; },
    tasks => { tasks[0].status = "completed"; },
    tasks => { tasks[0].history[0].at = "bad"; },
    tasks => { tasks.push({ ...structuredClone(tasks[0]), id: "another-id" }); },
    tasks => { tasks[0].source = { kind: "ordinary" }; tasks[0].status = "missed"; },
    tasks => { tasks[0].dueTime = "28:00"; },
  ];
  for (const mutate of malformed) { const copy = structuredClone(original); mutate(copy.tasks); assert.throws(() => parseTaskDataset(JSON.stringify(copy))); }
});
test("failed writes keep saved records unchanged and can be retried", async () => {
  const f = fixture(), s = f.service(), task = await s.createTask(input());
  const before = f.values.get(TASK_STORAGE_KEY);
  f.failWrite(true);
  await assert.rejects(s.updateTask(task.id, input({ title: "Keep this draft" })), /Saving tasks failed/);
  assert.equal(f.values.get(TASK_STORAGE_KEY), before);
  await assert.rejects(s.completeTask(task.id), /Saving tasks failed/);
  assert.equal((await s.getTask(task.id)).status, "pending");
  f.failWrite(false);
  assert.equal((await s.updateTask(task.id, input({ title: "Keep this draft" }))).title, "Keep this draft");
  assert.equal((await s.completeTask(task.id)).status, "completed");
});
test("task persistence never changes existing schedule records, including subsequent schedule writes", async () => {
  const f = fixture(), scheduleRepo = new BrowserScheduleRepository(() => f.storage);
  const schedule = new ScheduleService(scheduleRepo, developmentIdentity, sampleAcademics);
  const categories = await schedule.saveSubSchedule("Exercise", "Training");
  await schedule.saveEvent({ title: "Exercise", description: "Train", priority: "medium", mustComplete: false, subScheduleId: categories.schedules[0].id, slot: { date: "2030-11-04", start: "18:00", end: "19:00", timezone: "Africa/Lagos" } });
  const original = f.values.get(STORAGE_KEY);
  const tasks = f.service(), task = await tasks.createTask(input());
  await tasks.completeTask(task.id);
  assert.equal(f.values.get(STORAGE_KEY), original);
  const taskBytes = f.values.get(TASK_STORAGE_KEY);
  await schedule.saveSubSchedule("Feeding", "Meals");
  assert.equal(f.values.get(TASK_STORAGE_KEY), taskBytes);
  assert.equal((await schedule.load()).events.length, 1);
});
test("a stale task repository cannot overwrite a newer write", async () => {
  const f = fixture(), a = f.repo(), b = f.repo();
  await a.load(); await b.load(); await a.save(emptyTasks());
  await assert.rejects(b.save(emptyTasks()), /another tab/);
});

test("missed outcome moves the same ordinary task into Missed and keeps deadline and timestamp after reload", async () => {
  const f = fixture(), s = f.service();
  const task = await s.createTask(input({ dueDate: "2020-01-01", dueTime: "18:00" }));
  assert.equal(task.status, "pending");
  assert.equal(queryTasks(await s.listTasks(), { timezone: "Africa/Lagos", status: "pending" })[0].id, task.id);
  const [first, second] = await Promise.all([s.markTaskMissed(task.id), s.markTaskMissed(task.id)]);
  assert.equal(first.missedAt, second.missedAt);
  assert.ok(first.missedAt);
  assert.equal(first.completedAt, undefined);
  const reloaded = await f.service().getTask(task.id);
  assert.equal(reloaded.missedAt, first.missedAt);
  assert.equal(reloaded.dueDate, "2020-01-01");
  assert.equal(reloaded.dueTime, "18:00");
  assert.equal((await s.listTasks()).length, 1);
  assert.equal(queryTasks(await s.listTasks(), { timezone: "Africa/Lagos" }).length, 0);
  assert.equal(queryTasks(await s.listTasks(), { timezone: "Africa/Lagos", status: "missed" })[0].id, task.id);
  assert.equal((await s.markTaskMissed(task.id)).history.filter(entry => entry.kind === "missed").length, 1);
  await assert.rejects(s.completeTask(task.id), /already has a recorded outcome/);
  await assert.rejects(s.updateTask(task.id, input()), /unfinished/);
  assert.ok((await s.deleteTask(task.id)).deletedAt);
});

test("conflicting outcome submissions are blocked while saving and completed outcomes are final", async () => {
  const s = fixture().service(), task = await s.createTask(input());
  const completing = s.completeTask(task.id);
  await assert.rejects(s.markTaskMissed(task.id), /already saving/);
  const completed = await completing;
  await assert.rejects(s.markTaskMissed(task.id), /already has a recorded outcome/);
  assert.equal((await s.getTask(task.id)).completedAt, completed.completedAt);
  assert.equal((await s.getTask(task.id)).history.length, 2);
});

test("failed missed-outcome persistence leaves a task pending and allows a clean retry", async () => {
  const f = fixture(), s = f.service(), task = await s.createTask(input({ dueDate: "2020-01-01" }));
  const before = f.values.get(TASK_STORAGE_KEY);
  f.failWrite(true);
  await assert.rejects(s.markTaskMissed(task.id), /Saving tasks failed/);
  assert.equal(f.values.get(TASK_STORAGE_KEY), before);
  assert.equal((await s.getTask(task.id)).status, "pending");
  assert.equal((await s.getTask(task.id)).missedAt, undefined);
  f.failWrite(false);
  assert.equal((await s.markTaskMissed(task.id)).status, "missed");
  assert.equal((await s.getTask(task.id)).history.filter(entry => entry.kind === "missed").length, 1);
});

test("status tabs use independent exact filters, stable counts and nonmutating sorting", async () => {
  const instant = new Date("2031-01-01T12:00:00Z");
  const s = fixture().service(() => instant);
  const pending = await s.createTask(input({ priority: "high", dueDate: "2030-11-04" }));
  const completed = await s.createTask(input({ priority: "high", dueDate: "2030-11-04" }));
  const missed = await s.createTask(input({ priority: "high", dueDate: "2030-11-04" }));
  await s.completeTask(completed.id); await s.markTaskMissed(missed.id);
  const deleted = await s.createTask(input()); await s.deleteTask(deleted.id);
  const tasks = await s.listTasks(), before = structuredClone(tasks);
  assert.deepEqual(taskStatusCounts(tasks, "Africa/Lagos", instant), { active: 0, pending: 1, completed: 1, missed: 1 });
  for (const [status, id] of [["pending", pending.id], ["completed", completed.id], ["missed", missed.id]] as const) {
    assert.deepEqual(queryTasks(tasks, { timezone: "Africa/Lagos", instant, status, filters: { dueDate: "2030-11-04", priority: "high" }, sort: "due-earliest" }).map(task => task.id), [id]);
    assert.equal(queryTasks(tasks, { timezone: "Africa/Lagos", status, filters: { priority: "low" } }).length, 0);
  }
  assert.deepEqual(tasks, before);
  const summary = taskDaySummary(tasks, "2030-11-04", "Africa/Lagos", instant);
  assert.equal(summary.pending, 1); assert.equal(summary.completed, 1); assert.equal(summary.missed, 1);
});

test("task misses use the tracker's same occurrence and affect only its own date and totals", async () => {
  const f = fixture(), s = f.service(() => new Date("2031-01-01T12:00:00Z")), tracker = new HabitTaskGateway(s);
  const dates = ["2030-11-04", "2030-11-06"];
  const monday = await tracker.receive(occurrence("monday", dates[0]), dates);
  await tracker.receive(occurrence("wednesday", dates[1]), dates);
  const missed = await s.markTaskMissed(monday.id);
  assert.equal((await tracker.getOccurrence("reading", "monday")).missedAt, missed.missedAt);
  assert.equal((await tracker.getOccurrence("reading", "wednesday")).status, "pending");
  assert.deepEqual(await tracker.totals(dates[0]), { scheduled: 1, completed: 0, missed: 1, pending: 0 });
  assert.deepEqual(await tracker.totals(dates[1]), { scheduled: 1, completed: 0, missed: 0, pending: 1 });
});

test("version-one migration preserves pending/completed/missed records, original timestamps, IDs and audits", async () => {
  const f = fixture(), s = f.service();
  const pending = await s.createTask(input({ dueDate: "2020-01-01" }));
  const complete = await s.createTask(input()); await s.completeTask(complete.id);
  const tracker = new HabitTaskGateway(s);
  const habit = await tracker.receive(occurrence("monday", "2020-01-01"), ["2020-01-01"]);
  await tracker.recordMiss("reading", "monday");
  const legacy = { ...parseTaskDataset(f.values.get(TASK_STORAGE_KEY)!), version: 1 };
  for (const task of legacy.tasks) delete task.missedAt;
  const raw = JSON.stringify(legacy);
  f.values.set(TASK_STORAGE_KEY, raw);
  const fresh = f.service(), migrated = await fresh.listTasks();
  assert.equal(f.values.get(TASK_STORAGE_KEY), raw, "loading must not rewrite the original saved data");
  assert.equal(migrated.find(task => task.id === pending.id)!.status, "pending", "expired deadlines do not become missed");
  assert.equal(migrated.find(task => task.id === complete.id)!.completedAt, legacy.tasks.find(task => task.id === complete.id)!.completedAt);
  const migratedHabit = migrated.find(task => task.id === habit.id)!;
  assert.equal(migratedHabit.missedAt, migratedHabit.history.find(entry => entry.kind === "missed")!.at);
  assert.deepEqual(migrated.map(task => task.history), legacy.tasks.map(task => task.history));
  await fresh.createTask(input());
  assert.equal(JSON.parse(f.values.get(TASK_STORAGE_KEY)!).version, 2);
  assert.equal((await f.service().listTasks()).length, 4);
});

test("ambiguous legacy statuses are preserved without guessing or overwriting", async () => {
  const f = fixture(), s = f.service();
  await s.createTask(input());
  const legacy = { ...parseTaskDataset(f.values.get(TASK_STORAGE_KEY)!), version: 1 };
  for (const status of ["active", "unfinished", "unknown"]) {
    const ambiguous = JSON.stringify({ ...legacy, tasks: legacy.tasks.map(task => ({ ...task, status })) });
    f.values.set(TASK_STORAGE_KEY, ambiguous);
    const repo = f.repo();
    await assert.rejects(repo.load(), /ambiguous legacy status/);
    await assert.rejects(repo.save(emptyTasks()), /Load task data/);
    assert.equal(f.values.get(TASK_STORAGE_KEY), ambiguous);
  }
});

test("unfinished records derive Active before the deadline and Pending exactly at it without persistence changes", async () => {
  const f = fixture(), s = f.service();
  const task = await s.createTask(input({ dueDate: "2030-11-04", dueTime: "15:00" }));
  const raw = f.values.get(TASK_STORAGE_KEY);
  const before = new Date("2030-11-04T13:59:59.999Z"), reached = new Date("2030-11-04T14:00:00.000Z");
  assert.equal(taskViewStatus(task, "Africa/Lagos", before), "active");
  assert.equal(taskViewStatus(task, "Africa/Lagos", reached), "pending");
  assert.equal(queryTasks([task], { timezone: "Africa/Lagos", instant: before })[0].id, task.id);
  assert.equal(queryTasks([task], { timezone: "Africa/Lagos", instant: reached }).length, 0);
  assert.equal(queryTasks([task], { timezone: "Africa/Lagos", status: "pending", instant: reached })[0].id, task.id);
  const reloaded = await f.service().getTask(task.id);
  assert.equal(taskViewStatus(reloaded, "Africa/Lagos", reached), "pending");
  assert.equal(reloaded.status, "pending"); assert.equal(reloaded.history.length, 1);
  assert.equal(f.values.get(TASK_STORAGE_KEY), raw);
  assert.equal(millisecondsToNextMinute(new Date("2030-11-04T13:59:30.000Z")), 30001);
});

test("date-only unfinished tasks remain Active through the local day; undated tasks remain Active", async () => {
  const s = fixture().service(), dated = await s.createTask(input({ dueDate: "2030-11-04" }));
  assert.equal(taskViewStatus(dated, "Africa/Lagos", new Date("2030-11-04T22:59:59.999Z")), "active");
  assert.equal(taskViewStatus(dated, "Africa/Lagos", new Date("2030-11-04T23:00:00.000Z")), "pending");
  const undated = await s.createTask(input());
  assert.equal(taskViewStatus(undated, "Africa/Lagos", new Date("2040-01-01T00:00:00Z")), "active");
  await assert.rejects(s.markTaskMissed(undated.id), /deadline has arrived/);
});

test("early completion takes precedence and missed outcomes require an arrived deadline", async () => {
  const f = fixture();
  let now = new Date("2030-11-04T13:30:00.000Z"); // 14:30 in Lagos
  const s = f.service(() => now);
  const early = await s.createTask(input({ dueDate: "2030-11-04", dueTime: "15:00" }));
  const completed = await s.completeTask(early.id);
  assert.equal(completed.completedAt, now.toISOString());
  const later = await s.createTask(input({ dueDate: "2030-11-04", dueTime: "15:00" }));
  await assert.rejects(s.markTaskMissed(later.id), /deadline has arrived/);
  now = new Date("2030-11-04T14:00:00.000Z");
  assert.equal(taskViewStatus(await s.getTask(early.id), "Africa/Lagos", now), "completed");
  const missed = await s.markTaskMissed(later.id);
  assert.equal(missed.missedAt, now.toISOString());
  const reloaded = await f.service().getTask(later.id);
  assert.equal(taskViewStatus(reloaded, "Africa/Lagos", now), "missed");
  assert.equal(reloaded.missedAt, missed.missedAt);
});

test("deadline edits reclassify unfinished records and counts independently of optional filters", async () => {
  const now = new Date("2030-11-04T14:00:00.000Z"), f = fixture(), s = f.service(() => now);
  const task = await s.createTask(input({ dueDate: "2030-11-04", dueTime: "15:00" }));
  assert.equal(taskViewStatus(task, "Africa/Lagos", now), "pending");
  const edited = await s.updateTask(task.id, input({ dueDate: "2030-11-04", dueTime: "16:00", priority: "high" }));
  assert.equal(taskViewStatus(edited, "Africa/Lagos", now), "active");
  assert.deepEqual(taskStatusCounts([edited], "Africa/Lagos", now), { active: 1, pending: 0, completed: 0, missed: 0 });
  assert.equal(queryTasks([edited], { timezone: "Africa/Lagos", instant: now, status: "active", filters: { priority: "low" } }).length, 0);
  assert.equal((await s.getTask(task.id)).history.filter(entry => entry.kind === "missed").length, 0);
  assert.equal(taskViewStatus(await f.service().getTask(task.id), "Africa/Lagos", now), "active");
});

test("a stale Mark missed control cannot override a postponed deadline", async () => {
  const now = new Date("2030-11-04T14:00:00.000Z"), f = fixture(), s = f.service(() => now);
  const task = await s.createTask(input({ dueDate: "2030-11-04", dueTime: "15:00" }));
  assert.equal(taskViewStatus(task, "Africa/Lagos", now), "pending");
  await s.updateTask(task.id, input({ dueDate: "2030-11-04", dueTime: "16:00" }));
  const before = f.values.get(TASK_STORAGE_KEY);
  await assert.rejects(s.markTaskMissed(task.id), /deadline has arrived/);
  assert.equal(f.values.get(TASK_STORAGE_KEY), before);
  const saved = await s.getTask(task.id);
  assert.equal(saved.status, "pending"); assert.equal(saved.missedAt, undefined);
  assert.equal(saved.history.filter(entry => entry.kind === "missed").length, 0);
});
