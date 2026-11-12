// Production browser components -> actual authorized routes -> local DB -> HTTP service fixture -> rendered answer.
// This verifies transport/integration; the service fixture does not generate real AI answers.
import "../tests/helpers/env";
import { signInAs } from "../tests/helpers/session";
import { mock } from "node:test";
import { createRequire } from "node:module";
import { randomUUID } from "node:crypto";
import { createServer } from "node:http";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import assert from "node:assert/strict";
import { build } from "esbuild";
import postcss from "postcss";
import tailwind from "@tailwindcss/postcss";
import sharp from "sharp";
import { courseScenario } from "../tests/helpers/elearning-fixtures";
import { docx, pdf } from "../tests/helpers/office-files";
import { elearningDb } from "@/lib/db/elearning";
import type { CurrentAcademicContext } from "@/services/e-learning/shared/academic-calendar";
let academicContext: CurrentAcademicContext;
mock.module("@/services/e-learning/shared/academic-calendar", { namedExports: { getCurrentAcademicContext: async () => academicContext } });

async function main() {
  const scenario = await courseScenario(); academicContext = scenario.ctx;
  signInAs({ id: scenario.studentId, email: "e2e@example.test" });
  const { POST: upload, DELETE: remove } = await import("@/app/api/e-learning/stewart/attachments/route");
  const conversations = await import("../src/app/api/e-learning/stewart/conversations/route");
  const conversation = await import("../src/app/api/e-learning/stewart/conversations/[id]/route");
  const messages = await import("../src/app/api/e-learning/stewart/conversations/[id]/messages/route");
  const { POST: chat } = await import("@/app/api/e-learning/stewart/chat/route");
  const temporary = await mkdtemp(path.join(tmpdir(), "stewart-attachment-e2e-"));
  const files = new Map<string, File>();
  const explainRequests: { question: string; session_id: string; attachment_ids?: string[]; course_offering_id: string; week: number }[] = [];
  let origin = "";
  let failNext = false;
  let delayed: Promise<void> | undefined;
  let releaseDelayed: (() => void) | undefined;
  const server = createServer(async (req, res) => {
    try {
      const url = new URL(req.url!, origin);
      if (url.pathname === "/") { res.setHeader("content-type", "text/html"); return res.end('<link rel="stylesheet" href="/style.css"><link rel="stylesheet" href="/katex/katex.min.css"><div id="root"></div><script type="module" src="/bundle.js"></script>'); }
      if (["/bundle.js", "/style.css"].includes(url.pathname)) { res.setHeader("content-type", url.pathname.endsWith("js") ? "text/javascript" : "text/css"); return res.end(await readFile(path.join(temporary, url.pathname.slice(1)))); }
      if (url.pathname.includes("/documents/") && url.pathname.endsWith("/access")) { res.setHeader("content-type", "application/json"); return res.end(JSON.stringify({ url: "/lecture.docx" })); }
      if (url.pathname.startsWith("/katex/")) {
        const relative = url.pathname.slice("/katex/".length);
        if (!/^(katex\.min\.css|fonts\/[A-Za-z0-9_-]+\.(woff2?|ttf))$/.test(relative)) { res.statusCode = 404; return res.end(); }
        res.setHeader("Content-Type", relative.endsWith("css") ? "text/css" : "font/woff2");
        return res.end(await readFile(path.join("node_modules/katex/dist", relative)));
      }
      if (url.pathname === "/lecture.docx") return res.end(docx(["The equation V = IR relates voltage V, current I, and resistance R.", "A recursive function stops when it reaches its base case."]));
      if (!url.pathname.startsWith("/microservice/") && !url.pathname.startsWith("/api/e-learning/stewart/")) { res.statusCode = 404; return res.end(); }
      const chunks: Buffer[] = []; for await (const chunk of req) chunks.push(chunk);
      const bytes = Buffer.concat(chunks);
      const headers = new Headers(); for (const [key, value] of Object.entries(req.headers)) if (typeof value === "string") headers.set(key, value);
      const request = new Request(url, { method: req.method, headers, ...(req.method !== "GET" ? { body: bytes } : {}) });
      if (url.pathname.startsWith("/microservice/")) {
        assert.equal(headers.get("authorization"), "Bearer e2e-service-key");
        res.setHeader("content-type", "application/json");
        if (url.pathname === "/microservice/attachments") {
          const form = await request.formData(); assert.deepEqual([...form.keys()], ["file"]);
          const file = form.get("file") as File; assert.ok(file instanceof File);
          const id = randomUUID(); files.set(id, file);
          return res.end(JSON.stringify({ attachment_id: id, filename: file.name, mime_type: file.type, size_bytes: file.size, created_at: new Date().toISOString(), expires_at: new Date(Date.now() + 6 * 3600000).toISOString() }));
        }
        if (url.pathname === "/microservice/explain") {
          const body = await request.json(); explainRequests.push(body);
          const question = String(body.question).split("\n\nCurrent question:\n").at(-1)!;
          if (question.includes("Pause this conversation")) { delayed ??= new Promise<void>((resolve) => { releaseDelayed = resolve; }); await delayed; }
          if (failNext) { failNext = false; res.statusCode = 503; return res.end(JSON.stringify({ detail: "Temporary test failure" })); }
          const answer = question.includes("independent") ? "This is the independent conversation." : question.includes("Pause this conversation") ? "This is the delayed conversation." : question.includes("Recover this saved question") ? "The saved question has recovered." : "The captured equation is V = IR. The attached notes explain the base case.";
          assert.equal(body.course_offering_id, scenario.offering.id); assert.equal(body.week, 3);
          for (const id of body.attachment_ids ?? []) assert.ok(files.has(id));
          return res.end(JSON.stringify({ answer, sources: (body.attachment_ids ?? []).map((id: string) => ({ title: files.get(id)!.name, filename: files.get(id)!.name, source_type: "attachment", attachment_id: id, document_id: null, material_type: "ATTACHMENT", chunk_preview: files.get(id)!.type.startsWith("image/") ? `[image: ${files.get(id)!.name}]` : "The base case stops recursion." })), retrieval_info: { attachment_chunks_available: 2, attachment_images_count: 1 } }));
        }
        if (req.method === "DELETE") { res.statusCode = 204; return res.end(); }
        throw new Error("Unexpected service request");
      }
      if (url.pathname.includes("/conversations")) {
        const id = url.pathname.split("/conversations/")[1]?.split("/")[0]; const context = { params: Promise.resolve({ id: id ?? "" }) };
        const response = url.pathname.endsWith("/messages") ? await messages.POST(request, context) : id ? (req.method === "DELETE" ? await conversation.DELETE(request, context) : await conversation.GET(request, context)) : req.method === "POST" ? await conversations.POST(request) : await conversations.GET(request);
        res.statusCode = response.status; response.headers.forEach((v, k) => res.setHeader(k, v)); return res.end(Buffer.from(await response.arrayBuffer()));
      }
      const response = url.pathname.endsWith("/chat") ? await chat(request) : req.method === "DELETE" ? await remove(request) : await upload(request);
      res.statusCode = response.status; response.headers.forEach((v, k) => res.setHeader(k, v)); res.end(Buffer.from(await response.arrayBuffer()));
    } catch (error) { console.error(error); res.statusCode = 500; res.end("Fixture failure"); }
  });
  let browser;
  try {
    await build({ entryPoints: ["tests/helpers/stewart-browser-harness.tsx"], outfile: path.join(temporary, "bundle.js"), bundle: true, platform: "browser", format: "esm", jsx: "automatic", define: { "process.env.NODE_ENV": '"development"' }, tsconfig: "tsconfig.json" });
    const css = await postcss([tailwind()]).process('@import "tailwindcss";', { from: path.resolve("src/app/globals.css") }); await writeFile(path.join(temporary, "style.css"), css.css);
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve)); origin = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
    process.env.CONCEPT_EXPLAINER_API_URL = `${origin}/microservice`; process.env.AI_SERVICE_API_KEY = "e2e-service-key";
    const playwright = createRequire(path.join(process.env.BROWSER_MODULE_DIR ?? process.cwd(), "package.json"))("playwright-core");
    browser = await playwright.chromium.launch({ executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", headless: true });
    const page = await browser.newPage({ viewport: { width: 1200, height: 850 } });
    const browserPaths: string[] = []; page.on("request", (r: { url(): string }) => browserPaths.push(new URL(r.url()).pathname));
    await page.goto(`${origin}/?courseId=${scenario.course.id}&week=3`);
    await page.locator("article").waitFor();
    await page.getByRole("button", { name: "Capture", exact: true }).click();
    const box = await page.getByLabel("Drag to select a screenshot area. Escape cancels.").boundingBox();
    await page.mouse.move(box.x + 20, box.y + 20); await page.mouse.down(); await page.mouse.move(box.x + 350, box.y + 160, { steps: 6 }); await page.mouse.up();
    await page.getByRole("button", { name: "Attach screenshot", exact: true }).click();
    await page.locator('input[type="file"]').setInputFiles([{ name: "Notes.pdf", mimeType: "application/pdf", buffer: Buffer.from(pdf()) }, { name: "recursion.txt", mimeType: "text/plain", buffer: Buffer.from("A base case stops recursion.") }]);
    await page.getByText(/Attachments — 3 files/).waitFor();
    await page.getByRole("textbox").fill("Explain the equation using both documents."); await page.getByRole("button", { name: "Send message to Stewart" }).click();
    await page.getByText("The captured equation is V = IR. The attached notes explain the base case.", { exact: true }).waitFor({ timeout: 15000 });
    assert.equal(files.size, 3); assert.equal(explainRequests[0].attachment_ids!.length, 3);
    assert.equal((await elearningDb.stewartAttachment.findMany({ where: { userId: scenario.studentId, status: "uploaded" } })).length, 3);
    assert.equal(await page.getByLabel("Message attachments").locator("li").count(), 3);
    const references = page.getByLabel("Learning sources", { exact: true });
    assert.equal(await references.isVisible(), false);
    await page.getByText("View learning sources", { exact: true }).click();
    assert.equal(await references.locator("li").count(), 3);
    const image = [...files.values()].find((f) => f.type === "image/png")!;
    assert.ok((await sharp(Buffer.from(await image.arrayBuffer())).stats()).channels.some((c) => c.stdev > 1));
    await page.getByRole("textbox").fill("Explain that again."); await page.getByRole("button", { name: "Send message to Stewart" }).click();
    await page.getByText("The captured equation is V = IR. The attached notes explain the base case.", { exact: true }).nth(1).waitFor();
    assert.equal(explainRequests[0].session_id, explainRequests[1].session_id); assert.equal(files.size, 3);
    assert.ok(!(await page.content()).includes("e2e-service-key"));
    assert.ok(!(await readFile(path.join(temporary, "bundle.js"), "utf8")).includes("e2e-service-key"));
    assert.ok(browserPaths.every((p) => !p.startsWith("/microservice/")), "browser never calls the service directly");
    console.log("PASS browser capture + PDF + TXT -> real authenticated AkadVerse routes -> local ownership records -> multipart HTTP service fixture -> explain IDs -> rendered answer/sources; stable session and upload reuse");
    const first = await elearningDb.chatConversation.findFirstOrThrow({ where: { userId: scenario.studentId }, orderBy: { createdAt: "asc" } });
    const beforeNew = await elearningDb.chatConversation.count({ where: { userId: scenario.studentId } });
    await page.getByRole("button", { name: "New chat", exact: true }).click();
    await page.getByText("Hi, I am Stewart. How can I help you today?", { exact: true }).waitFor();
    assert.equal(await elearningDb.chatConversation.count({ where: { userId: scenario.studentId } }), beforeNew, "New chat does not create an empty database row");
    await page.getByRole("textbox").fill("Describe an independent topic."); await page.getByRole("button", { name: "Send message to Stewart" }).click();
    await page.getByText("This is the independent conversation.", { exact: true }).waitFor();
    const second = await elearningDb.chatConversation.findFirstOrThrow({ where: { userId: scenario.studentId, id: { not: first.id } } });
    assert.notEqual(first.sessionId, second.sessionId);
    await page.reload();
    await page.getByText("Chat history", { exact: true }).click();
    const select = async (title: string) => { await page.getByRole("list", { name: "Saved conversations" }).getByRole("button").filter({ hasText: title }).first().click(); await page.waitForFunction((expected: string) => [...document.querySelectorAll('[aria-current="page"]')].some((node) => node.textContent?.includes(expected)), title); await page.getByText("Loading conversation…", { exact: true }).waitFor({ state: "detached" }); };
    await select(first.title);
    await page.getByText("Explain the equation using both documents.", { exact: true }).waitFor();
    assert.equal(await page.getByText("This is the independent conversation.", { exact: true }).count(), 0);
    await page.getByRole("textbox").fill("Continue the earlier material."); await page.getByRole("button", { name: "Send message to Stewart" }).click();
    await page.getByText("The captured equation is V = IR. The attached notes explain the base case.", { exact: true }).nth(2).waitFor();
    assert.equal(explainRequests.at(-1)!.session_id, first.sessionId);
    assert.ok(explainRequests.at(-1)!.question.includes("Previous conversation"));
    assert.equal(files.size, 3, "refresh reuses the unexpired attachment IDs without browser binaries");
    await select(second.title); await page.getByText("This is the independent conversation.", { exact: true }).waitFor();
    await page.getByRole("button", { name: `Delete ${second.title}`, exact: true }).click();
    await page.getByRole("alertdialog", { name: "Delete conversation" }).waitFor();
    assert.ok(await elearningDb.chatConversation.findUnique({ where: { id: second.id } }));
    await page.getByRole("button", { name: "Cancel", exact: true }).click();
    await page.getByRole("button", { name: `Delete ${second.title}`, exact: true }).click(); await page.getByRole("button", { name: "Confirm delete", exact: true }).click();
    await page.getByText("Hi, I am Stewart. How can I help you today?", { exact: true }).waitFor();
    assert.equal(await elearningDb.chatMessage.count({ where: { conversationId: second.id } }), 0);
    await page.getByRole("textbox").fill("Pause this conversation."); await page.getByRole("button", { name: "Send message to Stewart" }).click();
    for (let i = 0; i < 100 && !releaseDelayed; i++) await new Promise((resolve) => setTimeout(resolve, 50));
    assert.ok(releaseDelayed);
    await select(first.title); assert.equal(await page.getByRole("log", { name: "Conversation with Stewart" }).getByText("Pause this conversation.", { exact: true }).count(), 0);
    releaseDelayed!();
    const third = await elearningDb.chatConversation.findFirstOrThrow({ where: { userId: scenario.studentId, id: { not: first.id } } });
    for (let i = 0; i < 100 && !await elearningDb.chatMessage.count({ where: { conversationId: third.id, role: "ASSISTANT" } }); i++) await new Promise((resolve) => setTimeout(resolve, 50));
    assert.equal(await page.getByRole("log", { name: "Conversation with Stewart" }).getByText("This is the delayed conversation.", { exact: true }).count(), 0, "a background reply must not appear in the selected conversation");
    const thirdSaved = await elearningDb.chatConversation.findUniqueOrThrow({ where: { id: third.id } }); await select(thirdSaved.title); await page.getByText("This is the delayed conversation.", { exact: true }).waitFor();
    await page.getByRole("button", { name: "New chat", exact: true }).click(); failNext = true;
    await page.getByRole("textbox").fill("Recover this saved question."); await page.getByRole("button", { name: "Send message to Stewart" }).click();
    await page.getByRole("button", { name: "Retry response", exact: true }).waitFor();
    const failed = await elearningDb.chatConversation.findFirstOrThrow({ where: { userId: scenario.studentId, title: "Recover this saved question." } });
    assert.equal(await elearningDb.chatMessage.count({ where: { conversationId: failed.id, role: "USER" } }), 1);
    await page.getByRole("button", { name: "Retry response", exact: true }).click(); await page.getByText("The saved question has recovered.", { exact: true }).waitFor();
    assert.equal(await elearningDb.chatMessage.count({ where: { conversationId: failed.id } }), 2);
    await page.setViewportSize({ width: 390, height: 844 });
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    console.log("PASS saved history after refresh, independent chats/sessions, restored context and attachments, lazy New chat/greeting, deletion confirmation/cascade, background-reply isolation, failed-message retry without duplicates, and mobile overflow");

  } finally {
    releaseDelayed?.();
    await browser?.close(); await new Promise<void>((resolve) => server.close(() => resolve()));
    await elearningDb.chatConversation.deleteMany({ where: { userId: scenario.studentId } });
    await elearningDb.stewartAttachment.deleteMany({ where: { userId: scenario.studentId } }); await elearningDb.$disconnect(); await rm(temporary, { recursive: true, force: true });
  }
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
