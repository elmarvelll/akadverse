import "../helpers/env";
import { after, before, beforeEach, it, mock } from "node:test";
import assert from "node:assert/strict";
import { AsyncLocalStorage } from "node:async_hooks";
import { createServer } from "node:http";
import { spawnSync } from "node:child_process";
import type { NextApiRequest, NextApiResponse } from "next";
import type { NextAuthOptions } from "next-auth";
import { NextRequest } from "next/server";
import bcrypt from "bcryptjs";
import { memoryPrisma, resetDatabase, rows } from "../productivity/memory-db";
import { DEV_STUDENT_EMAIL, DEV_STUDENT_FIRST_NAME, DEV_STUDENT_LAST_NAME, isDevLoginEnabled, hasLocalDevDatabase, hasGoogleCredentials } from "@/lib/dev-login-policy";

const requestContext = new AsyncLocalStorage<{ headers: Headers; cookies: { name: string; value: string }[] }>();
let clientMatchesEnvironment = true;
mock.module("@/lib/prisma", { namedExports: { prisma: memoryPrisma, corePrismaMatchesCurrentEnvironment: () => clientMatchesEnvironment } });
mock.module("@/services/productivity-layer/academics", { namedExports: { officialClasses: async () => [] } });
mock.module("next/headers", { namedExports: {
  headers: async () => requestContext.getStore()?.headers || new Headers(),
  cookies: async () => ({ getAll: () => requestContext.getStore()?.cookies || [] }),
} });

let authOptions: NextAuthOptions;
let handler: (req: NextApiRequest, res: NextApiResponse) => Promise<void>;
let proxy: typeof import("@/proxy").proxy;
let productivity: typeof import("@/app/api/productivity/route").POST;
let requireProductivityUser: typeof import("@/services/productivity-layer/auth").requireProductivityUser;
let createDevelopmentLoginProvider: typeof import("@/lib/dev-login").createDevelopmentLoginProvider;
let origin = "";
const jar = new Map<string, string>();
const envKeys = ["NODE_ENV", "ENABLE_DEV_LOGIN", "DATABASE_URL", "DIRECT_URL", "NEXTAUTH_SECRET", "NEXTAUTH_URL", "GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET"];
const originalEnv = Object.fromEntries(envKeys.map(key => [key, process.env[key]]));
const localDatabase = "postgresql://test:test@127.0.0.1:5433/akadverse_test";
const setEnv = (name: string, value?: string) => { if (value === undefined) delete process.env[name]; else process.env[name] = value; };
function developmentEnv() {
  setEnv("NODE_ENV", "development"); setEnv("ENABLE_DEV_LOGIN", "true");
  setEnv("DATABASE_URL", localDatabase); setEnv("DIRECT_URL", localDatabase);
  setEnv("NEXTAUTH_SECRET", "test-secret-for-development-login-verification-only");
  delete process.env.GOOGLE_CLIENT_ID; delete process.env.GOOGLE_CLIENT_SECRET;
  if (origin) process.env.NEXTAUTH_URL = origin;
}

const server = createServer((req, res) => {
  void (async () => {
    const url = new URL(req.url!, origin);
    const requestCookies = (req.headers.cookie || "").split(";").filter(Boolean).map(part => {
      const index = part.indexOf("="); return { name: part.slice(0, index).trim(), value: decodeURIComponent(part.slice(index + 1)) };
    });
    const headers = new Headers();
    for (const [key, value] of Object.entries(req.headers)) if (value !== undefined) headers.set(key, Array.isArray(value) ? value.join(", ") : value);
    const chunks: Buffer[] = []; for await (const chunk of req) chunks.push(Buffer.from(chunk));
    const body = Buffer.concat(chunks).toString();
    await requestContext.run({ headers, cookies: requestCookies }, async () => {
      if (url.pathname.startsWith("/api/auth/")) {
        const nextReq = req as NextApiRequest;
        nextReq.query = { ...Object.fromEntries(url.searchParams), nextauth: url.pathname.slice("/api/auth/".length).split("/") };
        nextReq.cookies = Object.fromEntries(requestCookies.map(cookie => [cookie.name, cookie.value]));
        nextReq.body = Object.fromEntries(new URLSearchParams(body));
        const nextRes = res as NextApiResponse;
        nextRes.status = status => { res.statusCode = status; return nextRes; };
        nextRes.json = value => { res.setHeader("Content-Type", "application/json"); res.end(JSON.stringify(value)); return nextRes; };
        nextRes.send = value => { if (typeof value === "string") res.end(value); else nextRes.json(value); return nextRes; };
        return handler(nextReq, nextRes);
      }
      if (url.pathname === "/protected/student") {
        const user = await requireProductivityUser(); res.setHeader("Content-Type", "application/json"); res.end(JSON.stringify({ user })); return;
      }
      if (url.pathname === "/api/productivity") {
        const response = await productivity(new Request(url, { method: "POST", headers, body }));
        res.statusCode = response.status; res.setHeader("Content-Type", "application/json"); res.end(await response.text()); return;
      }
      res.statusCode = 404; res.end();
    });
  })().catch(error => { res.statusCode = typeof error.status === "number" ? error.status : 500; res.setHeader("Content-Type", "application/json"); res.end(JSON.stringify({ error: "Request rejected" })); });
});

before(async () => {
  developmentEnv();
  await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
  origin = `http://127.0.0.1:${(server.address() as { port: number }).port}`; process.env.NEXTAUTH_URL = origin;
  const { default: NextAuth } = await import("next-auth");
  ({ authOptions } = await import("@/lib/auth"));
  // Errors are asserted below; avoid printing session cookies or server internals.
  authOptions = { ...authOptions, logger: { error() {}, warn() {}, debug() {} } };
  handler = NextAuth(authOptions);
  ({ proxy } = await import("@/proxy"));
  ({ POST: productivity } = await import("@/app/api/productivity/route"));
  ({ requireProductivityUser } = await import("@/services/productivity-layer/auth"));
  ({ createDevelopmentLoginProvider } = await import("@/lib/dev-login"));
});
beforeEach(() => { developmentEnv(); resetDatabase(); jar.clear(); clientMatchesEnvironment = true; });
after(async () => {
  await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  for (const key of envKeys) setEnv(key, originalEnv[key]);
});

async function request(path: string, form?: Record<string, string>, json?: unknown) {
  const response = await fetch(origin + path, {
    method: form || json ? "POST" : "GET", redirect: "manual",
    headers: { Cookie: [...jar].map(([key, value]) => `${key}=${value}`).join("; "),
      ...(form ? { "Content-Type": "application/x-www-form-urlencoded" } : {}),
      ...(json ? { "Content-Type": "application/json", Origin: origin } : {}) },
    body: form ? new URLSearchParams(form).toString() : json ? JSON.stringify(json) : undefined,
  });
  for (const cookie of response.headers.getSetCookie()) {
    const pair = cookie.split(";")[0], index = pair.indexOf("="); const key = pair.slice(0, index), value = pair.slice(index + 1);
    if (!value) jar.delete(key); else jar.set(key, value);
  }
  return { status: response.status, body: await response.json() };
}
async function login(fields: Record<string, string> = {}, provider = "dev-student") {
  const { body } = await request("/api/auth/csrf");
  return request(`/api/auth/callback/${provider}`, { csrfToken: body.csrfToken, callbackUrl: origin + "/studashboard", json: "true", ...fields });
}
async function protectedProxy(path = "/studashboard/productivity-layer") {
  return proxy(new NextRequest(origin + path, { headers: { Cookie: [...jar].map(([key, value]) => `${key}=${value}`).join("; ") } }));
}

it("requires both exact server gates, and refuses missing, invalid or remote Core database targets", () => {
  for (const mode of ["production", "test", undefined]) { setEnv("NODE_ENV", mode); assert.equal(isDevLoginEnabled(), false); assert.equal(createDevelopmentLoginProvider(), null); }
  setEnv("NODE_ENV", "development");
  for (const value of [undefined, "false", "TRUE", "1"]) { setEnv("ENABLE_DEV_LOGIN", value); assert.equal(isDevLoginEnabled(), false); assert.equal(createDevelopmentLoginProvider(), null); }
  setEnv("ENABLE_DEV_LOGIN", "true"); assert.equal(isDevLoginEnabled(), true);
  for (const url of [undefined, "bad", "postgresql://test:test@production.example/db", "postgresql://test:test@localhost/db?host=production.example"]) { setEnv("DATABASE_URL", url); assert.equal(hasLocalDevDatabase(), false); }
});
it("registers the dedicated Credentials provider without Google or dummy OAuth credentials", async () => {
  const providers = await request("/api/auth/providers");
  assert.equal(providers.status, 200); assert(providers.body.credentials); assert(providers.body["dev-student"]); assert(!providers.body.google);
  assert.equal(hasGoogleCredentials(), false);
  setEnv("GOOGLE_CLIENT_ID", "public-test-client"); assert.equal(hasGoogleCredentials(), false);
  setEnv("GOOGLE_CLIENT_SECRET", "test-only-client-secret"); assert.equal(hasGoogleCredentials(), true);
});
it("creates a normal NextAuth session for the actual dedicated database ID, ignoring requested identity and role", async () => {
  const result = await login({ email: "another@example.test", userId: "victim", role: "super_admin", isAdmin: "true" });
  assert.equal(result.status, 200); assert.equal(result.body.url, origin + "/studashboard");
  assert.equal(rows("user").length, 1); const user = rows("user")[0];
  assert.equal(user.email, DEV_STUDENT_EMAIL); assert.equal(user.role, "student"); assert.equal(user.isAdmin, false); assert.equal(user.password, "");
  const session = (await request("/api/auth/session")).body;
  assert.equal(session.user.id, user.id); assert.equal(session.user.name, "Development Test Student"); assert.equal(session.user.role, "student"); assert.equal(session.user.isAdmin, false);
  assert.equal(session.user.password, undefined); assert.equal((await protectedProxy()).headers.get("x-middleware-next"), "1");
  assert.equal((await request("/protected/student")).body.user.id, user.id);
  await login(); assert.equal(rows("user").length, 1);
});
it("passes the same authenticated user through task, habit and schedule persistence operations", async () => {
  await login(); const userId = (await request("/api/auth/session")).body.user.id;
  const run = (operation: string, args: unknown[]) => request("/api/productivity", undefined, { operation, args, requestId: crypto.randomUUID() });
  const task = await run("tasks.create", [{ title: "Development task", priority: "medium" }]);
  assert.equal(task.status, 200); assert.equal(task.body.result.ownerId, userId);
  const habit = await run("habits.save", [{ name: "Development habit", description: "", type: "task", frequency: "daily", weekdays: [], priority: "medium", time: "" }]);
  assert.equal(habit.status, 200); assert.equal(habit.body.result.ownerId, userId);
  const category = await run("schedule.category", ["Development", "", null, false]);
  const event = await run("schedule.save", [{ title: "Development event", description: "Test local persistence", priority: "medium", mustComplete: false, subScheduleId: category.body.result.schedules[0].id, slot: { date: "2030-01-15", start: "12:00", end: "13:00", timezone: "Africa/Lagos" } }]);
  assert.equal(event.status, 200); assert.equal(event.body.result.events[0].ownerId, userId);
});
it("uses standard CSRF protection and logout, removing access to protected routes", async () => {
  const denied = await request("/api/auth/callback/dev-student", { json: "true", callbackUrl: origin + "/studashboard" });
  assert(!rows("user").length); assert(!denied.body.user);
  await login(); const { body } = await request("/api/auth/csrf");
  await request("/api/auth/signout", { csrfToken: body.csrfToken, callbackUrl: origin + "/login", json: "true" });
  assert.equal((await request("/api/auth/session")).body.user, undefined);
  assert.equal((await protectedProxy()).status, 307); assert.equal((await request("/protected/student")).status, 401);
});
it("rejects direct development login and previously issued sessions when disabled or running in production", async () => {
  for (const mode of ["disabled", "production"]) {
    developmentEnv(); jar.clear(); await login();
    if (mode === "disabled") setEnv("ENABLE_DEV_LOGIN", "false"); else setEnv("NODE_ENV", "production");
    assert.equal((await protectedProxy()).status, 307);
    assert.equal((await protectedProxy("/api/productivity")).status, 401);
    assert.equal((await request("/api/auth/session")).body.user, undefined);
    assert.equal((await request("/protected/student")).status, 401);
    const before = rows("user").length; const result = await login();
    assert.equal(new URL(result.body.url).searchParams.get("error"), "CredentialsSignin");
    assert.equal(rows("user").length, before);
  }
});
it("refuses a remote/missing database, missing secret or promoted/colliding test account without overwriting it", async () => {
  for (const key of ["DATABASE_URL", "DIRECT_URL", "NEXTAUTH_SECRET"]) {
    developmentEnv(); delete process.env[key];
    const result = await login(); assert.match(new URL(result.body.url).searchParams.get("error") || "", /^DevLogin/); assert.equal(rows("user").length, 0);
  }
  developmentEnv(); setEnv("DATABASE_URL", "postgresql://test:test@production.example/db");
  await login(); assert.equal(rows("user").length, 0);
  developmentEnv(); rows("user").push({ id: "existing", email: DEV_STUDENT_EMAIL, firstName: DEV_STUDENT_FIRST_NAME, lastName: DEV_STUDENT_LAST_NAME, role: "faculty", isAdmin: true, password: "" });
  const result = await login(); assert.equal(new URL(result.body.url).searchParams.get("error"), "DevLoginStudentInvalid");
  assert.equal(rows("user")[0].role, "faculty"); assert.equal(rows("user")[0].isAdmin, true);
});
it("preserves ordinary email/password authentication when development login and Google are disabled", async () => {
  setEnv("ENABLE_DEV_LOGIN", "false");
  rows("user").push({ id: "ordinary-student", email: "ordinary@example.test", firstName: "Ordinary", lastName: "Student", role: "student", isAdmin: false, password: await bcrypt.hash("test-password-only", 4) });
  const result = await login({ email: "ordinary@example.test", password: "test-password-only" }, "credentials");
  assert.equal(result.status, 200); const session = (await request("/api/auth/session")).body;
  assert.equal(session.user.id, "ordinary-student"); assert.equal(session.user.isAdmin, false); assert.equal((await protectedProxy()).status, 200);
});
it("refuses a stale singleton after a database target change before touching any user records", async () => {
  clientMatchesEnvironment = false;
  const result = await login();
  assert.equal(new URL(result.body.url).searchParams.get("error"), "DevLoginRestart");
  assert.equal(rows("user").length, 0);
});
it("omits the dev provider from freshly loaded production auth configuration even with ENABLE_DEV_LOGIN=true", () => {
  const result = spawnSync(process.execPath, ["--import", "tsx", "-e", "const {authOptions}=require('./src/lib/auth');console.log(JSON.stringify(authOptions.providers.map(p=>p.options?.id||p.id)))"], {
    cwd: process.cwd(), env: { ...process.env, NODE_ENV: "production", ENABLE_DEV_LOGIN: "true" }, encoding: "utf8",
  });
  assert.equal(result.status, 0, "Production provider inspection must run successfully");
  const providers = JSON.parse(result.stdout.trim()); assert(providers.includes("credentials")); assert(!providers.includes("dev-student")); assert(!providers.includes("google"));
});
