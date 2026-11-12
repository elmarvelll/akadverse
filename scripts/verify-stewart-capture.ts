import { conversationFixture } from "../tests/helpers/stewart-conversation-fixture";
// Real Chrome check of the production viewer/composer components with fixture access/chat endpoints.
// No database, AI credentials, uploads, or application test routes are needed.
// BROWSER_MODULE_DIR points to an installed playwright-core package's parent directory.
// Run: BROWSER_MODULE_DIR=... npx tsx scripts/verify-stewart-capture.ts
import { createRequire } from "node:module";
import { createServer } from "node:http";
import { readFile, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import assert from "node:assert/strict";
import { build } from "esbuild";
import postcss from "postcss";
import tailwind from "@tailwindcss/postcss";
import sharp from "sharp";
import { docx, pdf } from "../tests/helpers/office-files";

async function main() {
  const requireModule = createRequire(import.meta.url);
  const playwright = createRequire(path.join(process.env.BROWSER_MODULE_DIR ?? process.cwd(), "package.json"))("playwright-core");
  const officeOnly = process.argv.includes("--office-only");
  const temporary = await mkdtemp(path.join(tmpdir(), "stewart-capture-"));
  let browser;
  const fixture = conversationFixture();
  const uploads: { name: string; bytes: Buffer }[] = [];
  const requests: { grounded?: boolean; attachment_ids: string[]; messages: { text: string }[] }[] = [];
  let failNext = true;
  let failUploadName: string | null = null;
  let expireNext = false;
  const uploadAttempts: string[] = [];
  const server = createServer(async (req, res) => {
    try {
      const url = new URL(req.url!, "http://localhost");
      if (url.pathname === "/") { res.setHeader("Content-Type", "text/html"); return res.end('<html><head><link rel="stylesheet" href="/style.css"><link rel="stylesheet" href="/katex/katex.min.css"></head><body><div id="root"></div><script type="module" src="/bundle.js"></script></body></html>'); }
      if (url.pathname === "/bundle.js" || url.pathname === "/style.css") { res.setHeader("Content-Type", url.pathname.endsWith("js") ? "text/javascript" : "text/css"); return res.end(await readFile(path.join(temporary, url.pathname.slice(1)))); }
      if (/\/documents\/.*\/access/.test(url.pathname)) { res.setHeader("Content-Type", "application/json"); return res.end(JSON.stringify({ url: url.pathname.includes("pdf") ? "/lecture.pdf" : "/lecture.docx" })); }
      if (url.pathname.startsWith("/katex/")) {
        const relative = url.pathname.slice("/katex/".length);
        if (!/^(katex\.min\.css|fonts\/[A-Za-z0-9_-]+\.(woff2?|ttf))$/.test(relative)) { res.statusCode = 404; return res.end(); }
        res.setHeader("Content-Type", relative.endsWith("css") ? "text/css" : "font/woff2");
        return res.end(await readFile(path.join("node_modules/katex/dist", relative)));
      }
      if (url.pathname === "/lecture.docx") return res.end(docx(Array.from({ length: 70 }, (_, i) => `Section ${i + 1}: Ohm's law V = IR connects voltage, current and resistance. A series circuit carries the same current through every resistor.`)));
      if (url.pathname === "/lecture.pdf") return res.end(await readFile("src/lib/resources/Engineering-CCMAS.pdf"));
      if (url.pathname.startsWith("/api/e-learning/pdfjs/")) {
        const asset = url.pathname.replace("/api/e-learning/pdfjs/", "");
        res.setHeader("Content-Type", asset.endsWith("mjs") ? "text/javascript" : "application/octet-stream");
        return res.end(await readFile(path.join(path.dirname(requireModule.resolve("pdfjs-dist/package.json")), asset)));
      }
      const chunks: Buffer[] = [];
      for await (const chunk of req) chunks.push(chunk);
      const bytes = Buffer.concat(chunks);
      res.setHeader("Content-Type", "application/json");
      const conversationResult = fixture.handle(url.pathname, req.method, bytes);
      if (conversationResult) { res.statusCode = conversationResult.status; return res.end(JSON.stringify(conversationResult.body)); }
      if (url.pathname.endsWith("/attachments") && req.method === "POST") {
        const form = await new Request("http://localhost", { method: "POST", headers: { "content-type": req.headers["content-type"]! }, body: bytes }).formData();
        const file = form.get("file") as File;
        uploadAttempts.push(file.name);
        if (file.name === failUploadName) { failUploadName = null; res.statusCode = 503; return res.end(JSON.stringify({ error: "Upload interrupted; retry this file." })); }
        uploads.push({ name: file.name, bytes: Buffer.from(await file.arrayBuffer()) });
        return res.end(JSON.stringify({ success: true, attachment: { attachment_id: `00000000-0000-4000-8000-${String(uploads.length).padStart(12, "0")}`, filename: file.name, mime_type: file.type, size_bytes: file.size, created_at: new Date().toISOString(), expires_at: new Date(Date.now() + 6 * 3600000).toISOString(), status: "uploaded" } }));
      }
      if (url.pathname.endsWith("/chat") || url.pathname.endsWith("/messages")) {
        const chatBody = fixture.begin(url.pathname, JSON.parse(bytes.toString()));
        requests.push(chatBody as typeof requests[number]);
        if (expireNext) { expireNext = false; res.statusCode = 422; return res.end(JSON.stringify({ code: "ATTACHMENT_REATTACH_REQUIRED", error: "Reattach these files and submit again." })); }
        if (failNext) { failNext = false; res.statusCode = 503; return res.end(JSON.stringify({ error: "Temporary AI failure; retry your question." })); }
        return res.end(JSON.stringify(fixture.finish(url.pathname, chatBody, { reply: "The resistor obeys Ohm's law.", truncated: false,
          sources: requests.at(-1)?.grounded ? [{ title: "External circuit reference", url: "https://example.com/circuits" }] : [
            ...(requests.at(-1)?.attachment_ids ?? []).map((id) => ({ title: "Supporting file", source_type: "attachment", attachment_id: id, filename: "Study attachment", document_id: null, chunk_preview: "Attachment source preview" })),
            { title: "Worked example", source_type: "ai_generated", document_id: null, material_type: "AI_GENERATED" }
          ] })));
      }
      res.end("{}");
    } catch (error) { res.statusCode = 500; res.end(String(error)); }
  });
  try {
    await build({ entryPoints: ["tests/helpers/stewart-browser-harness.tsx"], outfile: path.join(temporary, "bundle.js"), bundle: true, external: officeOnly ? ["pdfjs-dist"] : [], platform: "browser", format: "esm", jsx: "automatic", define: { "process.env.NODE_ENV": '"development"' }, tsconfig: "tsconfig.json" });
    const css = await postcss([tailwind()]).process('@import "tailwindcss";', { from: path.resolve("src/app/globals.css"), to: path.join(temporary, "style.css") });
    const { writeFile } = await import("node:fs/promises");
    await writeFile(path.join(temporary, "style.css"), css.css);
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const address = server.address() as { port: number };
    browser = await playwright.chromium.launch({ executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", headless: true });
    const page = await browser.newPage({ viewport: { width: 1200, height: 850 }, deviceScaleFactor: 2 });
    const errors: string[] = [];
    page.on("pageerror", (error: Error) => { errors.push(error.message); console.error("Browser error:", error.message); });
    page.on("console", (message: { type(): string; text(): string }) => { if (message.type() === "error") console.error("Browser console:", message.text()); });
    await page.goto(`http://127.0.0.1:${address.port}/`);
    console.log("Browser loaded fixture; waiting for Office document");
    await page.locator("article").waitFor({ timeout: 10000 }).catch(async (error: Error) => { console.error(await page.locator("body").innerText()); throw error; });
    const capture = page.getByRole("button", { name: "Capture", exact: true });
    await capture.click();
    await page.keyboard.press("Escape");
    assert.equal(await page.getByRole("button", { name: "Cancel", exact: true }).count(), 0);
    await capture.click();
    const smallBox = await page.getByLabel("Drag to select a screenshot area. Escape cancels.").boundingBox();
    await page.mouse.move(smallBox.x + 100, smallBox.y + 100);
    await page.mouse.down();
    await page.mouse.move(smallBox.x + 104, smallBox.y + 104);
    await page.mouse.up();
    await page.getByText("Select an area at least 12 × 12 pixels.").waitFor();
    assert.equal(await page.getByText(/Attachments —/).count(), 0);
    await page.keyboard.press("Escape");
    // Scroll the actual rendered Office document, then crop its visible content.
    await page.locator("article").evaluate((article: HTMLElement) => { article.parentElement!.scrollTop = 700; });
    await capture.click();
    const overlay = page.getByLabel("Drag to select a screenshot area. Escape cancels.");
    const box = await overlay.boundingBox();
    await page.mouse.move(box.x + 80, box.y + 90);
    await page.mouse.down();
    await page.mouse.move(box.x + 400, box.y + 250, { steps: 8 });
    await page.mouse.up();
    await page.getByRole("dialog", { name: "Screenshot preview" }).waitFor();
    await page.getByRole("button", { name: "Attach screenshot", exact: true }).click();
    await page.getByText(/Attachments — 1 file/).waitFor();
    assert.equal(uploads.length, 0, "capture stays local until Send");
    await page.locator('input[type="file"]').setInputFiles([{ name: "Lecture-notes.txt", mimeType: "text/plain", buffer: Buffer.from("The current through a series resistor is identical at every node.") }]);
    await page.getByText(/Attachments — 2 files/).waitFor();
    assert.equal(uploads.length, 0, "file picking stays local until Send");
    await page.locator('input[type="file"]').setInputFiles([{ name: "Supporting.pdf", mimeType: "application/pdf", buffer: Buffer.from(pdf()) }]);
    await page.getByText(/Attachments — 3 files/).waitFor();
    await page.getByRole("textbox", { name: "Ask Stewart a question" }).fill("Explain the equation using these notes.");
    await page.getByRole("button", { name: "Send message to Stewart" }).click();
    await page.getByText("Temporary AI failure; retry your question.").waitFor();
    assert.equal(await page.getByRole("textbox").inputValue(), "Explain the equation using these notes.");
    await page.getByText(/Attachments — 3 files/).waitFor();
    await page.getByRole("button", { name: "Send message to Stewart" }).click();
    await page.getByText("The resistor obeys Ohm's law.").waitFor();
    assert.equal(uploads.length, 3, "retry reuses processed files");
    const screenshot = uploads.find((u) => u.name.startsWith("Screenshot-"))!;
    const stats = await sharp(screenshot.bytes).stats();
    assert.ok(stats.channels.some((c) => c.stdev > 1), "capture contains document pixels");
    await page.getByRole("textbox").fill("Explain the symbol again.");
    await page.getByRole("button", { name: "Send message to Stewart" }).click();
    await page.getByText("The resistor obeys Ohm's law.").nth(1).waitFor();
    assert.deepEqual(requests.at(-1)!.attachment_ids, requests[0].attachment_ids);
    assert.equal(uploads.length, 3, "follow-ups do not re-upload");
    await page.getByText("View learning sources", { exact: true }).first().click();
    await page.getByText("Illustrative examples were created by Stewart.", { exact: true }).first().waitFor();
    await page.getByText("Study attachment", { exact: true }).first().waitFor();
    assert.equal(await page.getByText("Attachment source preview", { exact: true }).count(), 0);
    assert.deepEqual(errors, []);
    console.log("PASS Office capture after scrolling, Escape, local files, mixed submission, failed-send retry, previews, and follow-up references");
    // Grounding selection must survive requests and failures, and retain real source links.
    await page.goto(`http://127.0.0.1:${address.port}/`);
    const grounding = page.getByRole("button", { name: "Explain with Grounding" });
    assert.equal(await grounding.getAttribute("aria-pressed"), "false");
    await grounding.click();
    assert.equal(await grounding.getAttribute("aria-pressed"), "true");
    await page.getByRole("textbox").fill("Explain with external references.");
    failNext = true;
    await page.getByRole("button", { name: "Send message to Stewart" }).click();
    await page.getByText("Temporary AI failure; retry your question.").waitFor();
    assert.equal(requests.at(-1)!.grounded, true);
    assert.equal(await grounding.getAttribute("aria-pressed"), "true");
    await page.getByRole("button", { name: "Send message to Stewart" }).click();
    await page.getByText("View learning sources", { exact: true }).first().click();
    const source = page.getByRole("link", { name: "External circuit reference" });
    await source.waitFor();
    assert.equal(await source.getAttribute("href"), "https://example.com/circuits");
    assert.equal(requests.at(-1)!.grounded, true);
    await grounding.click();
    assert.equal(await grounding.getAttribute("aria-pressed"), "false");
    await page.getByRole("textbox").fill("Explain from my course notes.");
    await page.getByRole("button", { name: "Send message to Stewart" }).click();
    await page.getByText("The resistor obeys Ohm's law.").nth(1).waitFor();
    assert.equal(requests.at(-1)!.grounded, false);
    console.log("PASS grounding toggle, aria-pressed, mode retention on failure/retry, source links, and normal-mode routing");
    // Invalid/oversized files, limits, duplicates, per-file failure/retry and expiry recovery.
    await page.goto(`http://127.0.0.1:${address.port}/`);
    const picker = page.locator('input[type="file"]');
    await picker.setInputFiles([{ name: "bad.exe", mimeType: "application/octet-stream", buffer: Buffer.from("bad") }, { name: "big.pdf", mimeType: "application/pdf", buffer: Buffer.alloc(4 * 1024 * 1024 + 1) }]);
    await page.getByRole("alert").filter({ hasText: "isn't supported" }).waitFor();
    assert.equal(await page.getByText(/Attachments —/).count(), 0);
    const eight = Array.from({ length: 8 }, (_, i) => ({ name: `limit-${i}.txt`, mimeType: "text/plain", buffer: Buffer.from(`File ${i}`) }));
    await picker.setInputFiles(eight);
    await page.getByText(/Attachments — 8 files/).waitFor();
    await picker.setInputFiles([eight[0], { name: "ninth.txt", mimeType: "text/plain", buffer: Buffer.from("ninth") }]);
    await page.getByRole("alert").filter({ hasText: "at most 8" }).waitFor();
    await page.getByText(/Attachments — 8 files/).waitFor();
    await page.goto(`http://127.0.0.1:${address.port}/`);
    failUploadName = "retry.txt";
    const startAttempts = uploadAttempts.length;
    await page.locator('input[type="file"]').setInputFiles([{ name: "ok.txt", mimeType: "text/plain", buffer: Buffer.from("base case") }, { name: "retry.txt", mimeType: "text/plain", buffer: Buffer.from("recursion") }]);
    await page.getByRole("textbox").fill("Explain both files.");
    await page.getByRole("button", { name: "Send message to Stewart" }).click();
    await page.getByRole("button", { name: "Retry", exact: true }).waitFor();
    assert.deepEqual(uploadAttempts.slice(startAttempts), ["ok.txt", "retry.txt"]);
    await page.getByRole("button", { name: "Retry", exact: true }).click();
    await page.getByRole("button", { name: "Retry", exact: true }).waitFor({ state: "detached" });
    assert.deepEqual(uploadAttempts.slice(startAttempts), ["ok.txt", "retry.txt", "retry.txt"]);
    await page.getByRole("button", { name: "Send message to Stewart" }).click();
    await page.getByText("The resistor obeys Ohm's law.").waitFor();
    assert.equal(uploadAttempts.length - startAttempts, 3, "Send reuses individually retried uploads");
    expireNext = true;
    await page.getByRole("textbox").fill("Explain again after expiry.");
    await page.getByRole("button", { name: "Send message to Stewart" }).click();
    await page.getByText("Reattach these files and submit again.", { exact: true }).waitFor();
    await page.getByText(/Attachments — 2 files/).waitFor();
    assert.equal(await page.getByRole("textbox").inputValue(), "Explain again after expiry.");
    await page.getByRole("button", { name: "Send message to Stewart" }).click();
    await page.getByText("The resistor obeys Ohm's law.").nth(1).waitFor();
    assert.equal(uploadAttempts.length - startAttempts, 5, "Expired files receive new uploads only after resubmission");
    console.log("PASS invalid/oversized files, eight-file cap, duplicate/ninth rejection, per-file retry, and expiry recovery");
    if (officeOnly) return;
    // Exercise the repository's actual 9 MB engineering PDF, not an HTML substitute.
    await page.goto(`http://127.0.0.1:${address.port}/?kind=pdf`);
    await page.locator('canvas[data-pdf-ready="true"]').first().waitFor({ timeout: 60000 });
    await page.getByRole("button", { name: "Capture", exact: true }).click();
    const pdfBox = await page.getByLabel("Drag to select a screenshot area. Escape cancels.").boundingBox();
    await page.mouse.move(pdfBox.x + 70, pdfBox.y + 100);
    await page.mouse.down();
    await page.mouse.move(pdfBox.x + 450, pdfBox.y + 400, { steps: 8 });
    await page.mouse.up();
    await page.getByRole("dialog", { name: "Screenshot preview" }).waitFor();
    await page.getByRole("button", { name: "Attach screenshot", exact: true }).click();
    await page.getByText(/Attachments — 1 file/).waitFor();
    const pdfPixels = await page.locator('img[alt^="Preview of Screenshot-"]').evaluate(async (image: HTMLImageElement) => Array.from(new Uint8Array(await (await fetch(image.src)).arrayBuffer())));
    const pdfImage = sharp(Buffer.from(pdfPixels));
    const pdfMeta = await pdfImage.metadata();
    assert.equal(pdfMeta.width, 760);
    assert.equal(pdfMeta.height, 600);
    assert.ok((await pdfImage.stats()).channels.some((channel) => channel.stdev > 1), "PDF crop contains real page pixels");
    await page.getByRole("button", { name: "Retake" }).click();
    await page.getByRole("button", { name: "Cancel", exact: true }).waitFor();
    await page.getByRole("button", { name: "Cancel", exact: true }).click();
    await page.setViewportSize({ width: 375, height: 812 });
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), "mobile has no horizontal overflow");
    assert.deepEqual(errors, []);
    console.log("PASS real engineering PDF rendering/crop, retake, Cancel, and mobile layout");
    const mobile = await browser.newPage({ viewport: { width: 375, height: 812 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
    await mobile.goto(`http://127.0.0.1:${address.port}/?kind=pdf`);
    await mobile.locator('canvas[data-pdf-ready="true"]').first().waitFor({ timeout: 60000 });
    const mobileGrounding = mobile.getByRole("button", { name: "Explain with Grounding" });
    await mobileGrounding.tap();
    assert.equal(await mobileGrounding.getAttribute("aria-pressed"), "true");
    await mobileGrounding.tap();
    assert.equal(await mobileGrounding.getAttribute("aria-pressed"), "false");
    await mobile.getByRole("button", { name: "Capture", exact: true }).tap();
    const touchBox = await mobile.getByLabel("Drag to select a screenshot area. Escape cancels.").boundingBox();
    const session = await mobile.context().newCDPSession(mobile);
    const start = { x: touchBox.x + 40, y: touchBox.y + 100 };
    await session.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [start] });
    await session.send("Input.dispatchTouchEvent", { type: "touchCancel", touchPoints: [] });
    assert.equal(await mobile.getByText(/Attachments —/).count(), 0, "pointer cancellation creates no attachment");
    await session.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [start] });
    await session.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: touchBox.x + 280, y: touchBox.y + 260 }] });
    await session.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    await mobile.getByRole("button", { name: "Attach screenshot", exact: true }).tap();
    await mobile.getByText(/Attachments — 1 file/).waitFor();
    assert.ok(await mobile.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    await mobile.close();
    console.log("PASS mobile touch drag and pointer cancellation");
  } finally {
    await browser?.close();
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await rm(temporary, { recursive: true, force: true });
  }
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
