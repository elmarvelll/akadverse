// Real NextAuth + API + PostgreSQL integration check. Build first, then run
// npm run test:productivity:http. Only localhost databases are permitted.
import "../tests/helpers/env";
import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import { createWriteStream, existsSync, mkdirSync } from "node:fs";
import { createServer } from "node:net";
import path from "node:path";
import { spawn, spawnSync, type ChildProcess } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { addDays, localNow, type Dataset, type Student } from "@/features/productivity/schedule/domain";
import type { Habit, Occurrence } from "@/features/productivity/habits/domain";
import type { Task } from "@/features/productivity/tasks/domain";

const databaseKeys = ["DATABASE_URL", "DIRECT_URL", "ELEARNING_DATABASE_URL", "ELEARNING_DIRECT_URL"] as const;
for (const key of databaseKeys) {
  const url = new URL(process.env[key]!);
  const loopback = (host: string) => ["localhost", "127.0.0.1", "[::1]", "::1"].includes(host);
  assert.ok(["postgres:", "postgresql:"].includes(url.protocol) && loopback(url.hostname), `${key} must be local PostgreSQL.`);
  for (const name of ["host", "hostaddr"]) assert.ok(url.searchParams.getAll(name).every(loopback), `${key} cannot override its host with a remote target.`);
}
assert.ok(existsSync(".next/BUILD_ID"), "Run npm run build before the production-mode HTTP integration check.");

async function freePort() {
  const server = createServer();
  await new Promise<void>((resolve, reject) => { server.once("error", reject); server.listen(0, "127.0.0.1", resolve); });
  const address = server.address(); assert.ok(address && typeof address !== "string");
  await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  return address.port;
}

type Session = { user?: { id: string; email: string; role: string; isAdmin: boolean } };
class HttpSession {
  private readonly cookies = new Map<string, string>();
  userId = "";
  constructor(private readonly origin: string) {}
  async request(route: string, options: RequestInit = {}) {
    const headers = new Headers(options.headers);
    if (this.cookies.size) headers.set("Cookie", [...this.cookies].map(([key, value]) => `${key}=${value}`).join("; "));
    const response = await fetch(this.origin + route, { ...options, headers, redirect: "manual", signal: AbortSignal.timeout(60000) });
    for (const cookie of response.headers.getSetCookie()) {
      const first = cookie.split(";")[0], index = first.indexOf("=");
      this.cookies.set(first.slice(0, index), first.slice(index + 1));
    }
    return response;
  }
  async csrf() { return (await (await this.request("/api/auth/csrf")).json() as { csrfToken: string }).csrfToken; }
  async login(email: string, password: string) {
    const response = await this.request("/api/auth/callback/credentials", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ email, password, csrfToken: await this.csrf(), callbackUrl: this.origin + "/studashboard", json: "true" }) });
    assert.equal(response.status, 200);
    const result = await response.json() as { url?: string }; assert.ok(!result.url?.includes("error="), "Password login failed.");
    const session = await (await this.request("/api/auth/session")).json() as Session;
    assert.ok(session.user); assert.equal(session.user.email, email); assert.equal(session.user.role, "student"); assert.equal(session.user.isAdmin, false);
    this.userId = session.user.id;
    return session.user;
  }
  async response(operation: string, args: unknown[] = [], requestId: string = randomUUID(), expectedId = this.userId) {
    return this.request("/api/productivity", { method: "POST", headers: { "Content-Type": "application/json", Origin: this.origin, "X-Productivity-User": expectedId }, body: JSON.stringify({ operation, args, requestId }) });
  }
  async rpc<T>(operation: string, args: unknown[] = [], requestId?: string): Promise<T> {
    const response = await this.response(operation, args, requestId);
    const body = await response.json() as { result: T; code?: string; error?: string };
    assert.ok(response.ok, `${operation} failed with ${response.status}/${body.code || "UNKNOWN"}: ${body.error || "No error description"}`);
    return body.result;
  }
  async logout() {
    await this.request("/api/auth/signout", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ csrfToken: await this.csrf(), callbackUrl: this.origin + "/login", json: "true" }) });
    assert.ok(!(await (await this.request("/api/auth/session")).json() as Session).user);
  }
}

async function main() {
  const users: string[] = [];
  let server: ChildProcess | undefined;
  mkdirSync(".local-development", { recursive: true });
  const log = createWriteStream(path.join(".local-development", `productivity-http-${randomUUID()}.log`));
  try {
    const port = await freePort(), origin = `http://localhost:${port}`;
    server = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "--hostname", "127.0.0.1", "--port", String(port)], {
      windowsHide: true, stdio: ["ignore", "pipe", "pipe"], env: { ...process.env, NODE_ENV: "production", NEXTAUTH_URL: origin, NEXTAUTH_SECRET: randomBytes(32).toString("hex"), ENABLE_DEV_LOGIN: "true", GOOGLE_CLIENT_ID: "", GOOGLE_CLIENT_SECRET: "" },
    });
    server.stdout?.pipe(log, { end: false }); server.stderr?.pipe(log, { end: false });
    let ready = false;
    for (let attempt = 0; attempt < 100; attempt++) {
      if (server.exitCode !== null) throw new Error("Production test server exited; inspect its private .local-development log.");
      try { const response = await fetch(origin + "/api/auth/providers", { signal: AbortSignal.timeout(1000) }); if (response.ok) { ready = true; break; } } catch { /* Wait for this test's local server only. */ }
      await delay(150);
    }
    assert.ok(ready, "Production test server did not become ready.");
    const providers = await (await fetch(origin + "/api/auth/providers")).json() as Record<string, unknown>;
    assert.ok(providers.credentials); assert.ok(!providers["dev-student"]); assert.ok(!providers.google);

    const password = randomBytes(24).toString("hex"), hash = await bcrypt.hash(password, 10);
    const makeStudent = async () => {
      const user = await prisma.user.create({ data: { firstName: "Productivity Integration", lastName: "Test", email: `productivity-${randomUUID()}@stu.cu.edu.ng`, password: hash, role: "student", isAdmin: false } });
      users.push(user.id); return user;
    };
    const [studentA, studentB] = await Promise.all([makeStudent(), makeStudent()]);
    const a = new HttpSession(origin), b = new HttpSession(origin);
    assert.equal((await a.login(studentA.email, password)).id, studentA.id);
    assert.equal((await b.login(studentB.email, password)).id, studentB.id);
    for (const route of ["/studashboard/productivity-layer", "/e-learning/student/dashboard", "/studashboard/marketplace"]) {
      const response = await a.request(route); assert.equal(response.status, 200, `Existing student route failed: ${route}`); await response.arrayBuffer();
    }
    assert.equal((await a.rpc<{ student: Student }>("context")).student.id, studentA.id);
    console.log("Verified ordinary password sessions and existing student Productivity, e-learning and marketplace routes in production mode; dev login stays disabled.");

    const today = localNow("Africa/Lagos").date, tomorrow = addDays(today, 1), yesterday = addDays(today, -1);
    const key = randomUUID(), taskInput = { title: "Private integration task", priority: "medium", scheduledSlot: { date: tomorrow, start: "09:00", end: "10:30", timezone: "Africa/Lagos" }, ownerId: studentB.id };
    const task = await a.rpc<Task>("tasks.create", [taskInput], key);
    const scheduled = await a.rpc<import("@/features/productivity/workspace/data").WorkspaceSnapshot>("workspace.view", [{ section: "schedule", start: tomorrow, end: tomorrow }]);
    assert.equal(scheduled.data.tasks.tasks.find(row => row.id === task.id)?.scheduledSlot?.start, "09:00");
    assert.equal(await prisma.productivityEvent.count({ where: { ownerId: studentA.id } }), 0, "task allocation does not create an event copy");
    assert.equal(task.ownerId, studentA.id); assert.equal((await a.rpc<Task>("tasks.create", [taskInput], key)).id, task.id);
    const habit = await a.rpc<Habit>("habits.save", [{ name: "Private integration habit", description: "", type: "task", frequency: "daily", weekdays: [], priority: "medium", time: "", startDate: today }]);
    await Promise.all(Array.from({ length: 4 }, () => a.rpc("habits.synchronize", [{ start: today, end: tomorrow }])));
    assert.equal(await prisma.productivityOccurrence.count({ where: { ownerId: studentA.id, habitId: habit.id, originalDate: today } }), 1);
    const tasks = await a.rpc<Task[]>("tasks.list"), habitTask = tasks.find(item => item.source.kind === "habit" && item.source.habitId === habit.id && item.source.scheduledDate === today);
    assert.ok(habitTask); await a.rpc("tasks.complete", [habitTask.id]);
    const occurrences = await a.rpc<Occurrence[]>("habits.synchronize", [{ start: today, end: tomorrow }]);
    assert.equal(occurrences.find(item => item.habitId === habit.id && item.date === today)?.task?.status, "completed");
    assert.equal((await a.response("habits.record", [habit.id, tomorrow, "completed"])).status, 400);
    await a.rpc("habits.archive", [habit.id, true]);
    assert.equal((await a.rpc<Task>("tasks.get", [habitTask.id])).status, "completed", "Archiving a habit must preserve recorded outcomes.");
    const eventHabit = await a.rpc<Habit>("habits.save", [{ name: "Past event habit", description: "", type: "event", frequency: "daily", weekdays: [], priority: "low", time: "08:00", end: "09:00", startDate: yesterday, endDate: yesterday }]);
    await a.rpc("habits.synchronize", [{ start: yesterday, end: yesterday }]);
    await a.rpc("habits.record", [eventHabit.id, yesterday, "completed"]);
    const habitEvent = (await a.rpc<Dataset>("schedule.load")).events.find(item => item.source.kind === "habit" && item.source.habitId === eventHabit.id);
    assert.ok(habitEvent?.completedAt, "Habit Tracker outcomes must be shared with the scheduled event.");
    const past = await a.rpc<Task>("tasks.create", [{ title: "Expired without an outcome", priority: "low", dueDate: yesterday }]);
    assert.equal((await a.rpc<Task>("tasks.get", [past.id])).status, "pending", "Deadline expiry must not record a missed outcome.");

    const categories = await a.rpc<Dataset>("schedule.category", ["Integration category", "", null, false]), category = categories.schedules[0];
    const eventInput = { title: "Private overnight event", description: "Verify history and 24-hour times.", priority: "medium", mustComplete: false, subScheduleId: category.id,
      slot: { date: tomorrow, start: "23:00", end: "01:00", timezone: "Africa/Lagos" }, backup: { date: addDays(tomorrow, 1), start: "23:00", end: "01:00", timezone: "Africa/Lagos" } };
    const schedule = await a.rpc<Dataset>("schedule.save", [eventInput]), event = schedule.events.find(item => item.title === eventInput.title);
    assert.ok(event);
    await a.rpc("schedule.save", [{ ...eventInput, title: "Edited overnight event" }, event.id]);
    const archived = await a.rpc<Dataset>("schedule.archive", [event.id]);
    const archivedEvent = archived.events.find(item => item.id === event.id); assert.ok(archivedEvent);
    assert.ok(archivedEvent.archivedAt); assert.ok(archivedEvent.history.some(entry => entry.kind === "edited")); assert.deepEqual(archivedEvent.backup, eventInput.backup);
    assert.equal((await a.response("schedule.complete", [event.id])).status, 400, "Schedule Manager must not expose completion operations.");
    await a.rpc("preferences.save", ["Europe/London"]);
    const originalId = task.id, exported = { tasks: { version: 2, tasks: [task] } };
    assert.equal((await a.response("import", [exported, false])).status, 400, "Local-data import requires explicit ownership confirmation.");
    assert.equal((await a.rpc<{ tasks: number }>("import", [exported, true])).tasks, 1);
    assert.equal((await a.rpc<{ skipped: number }>("import", [exported, true])).skipped, 1);
    assert.equal(task.id, originalId, "Import must not mutate the supplied original export.");

    assert.deepEqual(await b.rpc("tasks.list"), []); assert.deepEqual(await b.rpc("habits.list"), []); assert.equal((await b.rpc<Dataset>("schedule.load")).events.length, 0);
    for (const [operation, args] of [["tasks.get", [task.id]], ["tasks.delete", [task.id]], ["habits.archive", [habit.id, true]], ["schedule.archive", [event.id]]] as [string, unknown[]][]) assert.equal((await b.response(operation, args)).status, 404, operation);
    assert.equal((await b.response("schedule.save", [{ ...eventInput, title: "Foreign category link" }])).status, 400);
    assert.equal((await a.response("tasks.list", [], randomUUID(), studentB.id)).status, 401, "A browser-supplied identity cannot choose another owner.");
    await prisma.user.update({ where: { id: studentB.id }, data: { role: "faculty" } });
    assert.equal((await b.response("tasks.list")).status, 403, "The server must recheck current database roles.");
    console.log("Verified ownership/link isolation, stable occurrences, shared habit outcomes, explicit deadline behavior, overnight events, backup times, archive history and preferences.");

    await a.logout(); assert.equal((await a.response("context")).status, 401);
    const loggedOut = await a.request("/studashboard/productivity-layer"); assert.ok([302, 303, 307, 308].includes(loggedOut.status)); assert.ok(loggedOut.headers.get("location")?.includes("/login"));
    assert.equal((await a.login(studentA.email, password)).id, studentA.id);
    assert.ok((await a.rpc<Task[]>("tasks.list")).some(item => item.id === task.id)); assert.ok((await a.rpc<Habit[]>("habits.list")).some(item => item.id === habit.id));
    assert.ok((await a.rpc<Dataset>("schedule.load")).events.find(item => item.id === event.id)?.archivedAt);
    assert.equal((await a.rpc<{ student: Student }>("context")).student.timezone, "Europe/London");
    await a.logout(); await b.logout();
    console.log("Verified real reload/new-session persistence and logout protection. Only temporary localhost test accounts were used.");
  } finally {
    if (server?.pid) {
      if (process.platform === "win32") spawnSync("taskkill.exe", ["/PID", String(server.pid), "/T", "/F"], { windowsHide: true, stdio: "ignore" });
      else server.kill("SIGTERM");
    }
    try { if (users.length) await prisma.user.deleteMany({ where: { id: { in: users } } }); }
    finally { await prisma.$disconnect(); log.end(); }
  }
}

void main().catch(error => { console.error(error); process.exitCode = 1; });
