import { conversationFixture } from "../tests/helpers/stewart-conversation-fixture";
// Real production renderer/composer in Chrome. Recorded live responses + explicit formatting/error fixtures.
import { createRequire } from "node:module";
import { createServer } from "node:http";
import { mkdtemp, readFile, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import assert from "node:assert/strict";
import { build } from "esbuild";
import postcss from "postcss";
import tailwind from "@tailwindcss/postcss";
import { docx } from "../tests/helpers/office-files";
async function main() {
  const temporary = await mkdtemp(path.join(tmpdir(), "stewart-learning-"));
  const conflict = JSON.parse(await readFile("tests/fixtures/stewart/conflict-response.json", "utf8"));
  const recorded = async (name: string, fallback: unknown) => JSON.parse(await readFile(`/tmp/stewart-live-${name}.json`, "utf8").catch(() => readFile(`tests/fixtures/stewart/${name}-response.json`, "utf8")).catch(() => JSON.stringify(fallback)));
  const definition = await recorded("definition", { answer: "Conflict within one group.", sources: [] });
  const structured = await recorded("structured", conflict);
  const attachmentMath = await recorded("attachment-math", { answer: "A circuit explanation.", sources: [] });
  const attachmentFollowup = await recorded("attachment-followup", { answer: "The current is 3 A.", sources: [] });
  const followup = await recorded("followup", { answer: "Address disagreements early.", sources: [] });
  const exampleTexts = ["A student team disagrees about the project format.", "A workplace team disagrees about its shift schedule.", "A business team disagrees about expanding into a new market."];
  const mathAnswer = '# Circuit relationships\n\n## Definition\n\n**Voltage** and *current* are related by $V=IR$.\n\n### Calculate current\n\n$$\nI=\\frac{V}{R}=\\frac{12}{4}=3\\,\\mathrm{A}\n$$\n\n1. Read the voltage.\n2. Divide by resistance.\n   - Keep units consistent.\n\n> Check that the resistance is nonzero.\n\n| Quantity | Meaning | Value |\n| --- | --- | --- |\n| V | Voltage | 12 V |\n| R | Resistance | 4 Ω |\n\nUse `I = V / R`.\n\n```python\ncurrent = voltage / resistance\n```\n\n[Learning link](https://example.com/circuits)';
  const fixtureSources = [{ document_id: "lecture", title: "Circuit notes", material_type: "NOTES", chunk_preview: "PRIVATE CHUNK PREVIEW" }, { document_id: "lecture", title: "Circuit notes", material_type: "NOTES", chunk_preview: "SECOND CHUNK" }];
  const samples: Record<string, { answer: string; sources: unknown[] }> = {
    actual: conflict, definition, structured, followup, "live-math": attachmentMath, "live-attachment-followup": attachmentFollowup,
    duplicates: { answer: exampleTexts.concat(exampleTexts[0]).map((e) => `[AI-GENERATED EXAMPLE]\n\n${e}`).join("\n\n"), sources: [{ title: "Generated", source_type: "ai_generated", material_type: "AI_GENERATED", chunk_preview: exampleTexts[0] }] },
    math: { answer: mathAnswer, sources: fixtureSources },
    long: { answer: Array.from({ length: 18 }, () => mathAnswer).join("\n\n") + "\n\nEND-OF-LONG-ANSWER", sources: fixtureSources },
  };
  const requests: { attachment_ids?: string[]; messages: { text: string }[] }[] = [];
  const uploaded: File[] = [];
  const fixture = conversationFixture();
  const server = createServer(async (req, res) => {
    try {
      const url = new URL(req.url!, "http://localhost");
      if (url.pathname === "/") { res.setHeader("Content-Type", "text/html"); return res.end('<link rel="stylesheet" href="/style.css"><link rel="stylesheet" href="/katex/katex.min.css"><div id="root"></div><script type="module" src="/bundle.js"></script>'); }
      if (["/bundle.js", "/style.css"].includes(url.pathname)) { res.setHeader("Content-Type", url.pathname.endsWith("js") ? "text/javascript" : "text/css"); return res.end(await readFile(path.join(temporary, url.pathname.slice(1)))); }
      if (url.pathname.startsWith("/katex/")) { const relative = url.pathname.slice(7); if (!/^(katex\.min\.css|fonts\/[A-Za-z0-9_-]+\.(woff2?|ttf))$/.test(relative)) { res.statusCode = 404; return res.end(); } res.setHeader("Content-Type", relative.endsWith("css") ? "text/css" : "font/woff2"); return res.end(await readFile(path.join("node_modules/katex/dist", relative))); }
      if (url.pathname.includes("/access")) { res.setHeader("Content-Type", "application/json"); return res.end(JSON.stringify({ url: "/notes.docx" })); }
      if (url.pathname === "/notes.docx") return res.end(docx(["Circuit lesson: V = IR.", "For V = 12 volts and R = 4 ohms, current I = 3 amperes.", "The current through each series resistor is the same."]));
      const chunks: Buffer[] = []; for await (const chunk of req) chunks.push(chunk);
      const bytes = Buffer.concat(chunks); res.setHeader("Content-Type", "application/json");
      const conversationResult = fixture.handle(url.pathname, req.method, bytes);
      if (conversationResult) { res.statusCode = conversationResult.status; return res.end(JSON.stringify(conversationResult.body)); }
      if (url.pathname.endsWith("/attachments") && req.method === "POST") {
        const form = await new Request("http://localhost", { method: "POST", headers: { "Content-Type": req.headers["content-type"]! }, body: bytes }).formData();
        const file = form.get("file") as File; uploaded.push(file);
        if (file.type === "image/png") await writeFile("/tmp/stewart-learning-capture.png", Buffer.from(await file.arrayBuffer()));
        return res.end(JSON.stringify({ success: true, attachment: { attachment_id: `00000000-0000-4000-8000-${String(uploaded.length).padStart(12, "0")}`, filename: file.name, mime_type: file.type, size_bytes: file.size, created_at: new Date().toISOString(), expires_at: new Date(Date.now() + 6 * 3600000).toISOString(), status: "uploaded" } }));
      }
      if (url.pathname.endsWith("/chat") || url.pathname.endsWith("/messages")) {
        const request = fixture.begin(url.pathname, JSON.parse(bytes.toString())) as typeof requests[number]; requests.push(request);
        const sample = samples[request.messages.at(-1)?.text ?? "math"] ?? samples.math;
        const sources = [...sample.sources, ...(request.attachment_ids ?? []).map((id: string) => ({ source_type: "attachment", material_type: "ATTACHMENT", attachment_id: id, title: "Attached material", filename: "Attached material", document_id: null, chunk_preview: "INTERNAL ATTACHMENT PREVIEW" }))];
        return res.end(JSON.stringify(fixture.finish(url.pathname, request as unknown as Record<string, unknown>, { reply: sample.answer, sources, session_id: "stable-fixture-session", truncated: false })));
      }
      res.end("{}");
    } catch (error) { console.error(error); res.statusCode = 500; res.end("Fixture failure"); }
  });
  let browser;
  try {
    await build({ entryPoints: ["tests/helpers/stewart-browser-harness.tsx"], outfile: path.join(temporary, "bundle.js"), bundle: true, platform: "browser", format: "esm", jsx: "automatic", tsconfig: "tsconfig.json", define: { "process.env.NODE_ENV": '"development"' } });
    const css = await postcss([tailwind()]).process('@import "tailwindcss";', { from: path.resolve("src/app/globals.css") }); await writeFile(path.join(temporary, "style.css"), css.css);
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const playwright = createRequire(path.join(process.env.BROWSER_MODULE_DIR ?? process.cwd(), "package.json"))("playwright-core");
    browser = await playwright.chromium.launch({ executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", headless: true });
    const page = await browser.newPage({ viewport: { width: 1200, height: 850 } });
    const errors: string[] = []; page.on("pageerror", (e: Error) => errors.push(e.message));
    await page.goto(`http://127.0.0.1:${(server.address() as { port: number }).port}`);
    const explanation = page.getByRole("article", { name: "Stewart explanation", exact: true });
    const send = async (question: string) => { const before = await explanation.count(); await page.getByRole("textbox").fill(question); await page.getByRole("button", { name: "Send message to Stewart" }).click(); await explanation.nth(before).waitFor(); return explanation.nth(before); };
    const actual = await send("actual");
    assert.equal((await actual.innerText()).split("Imagine a student project group tasked with creating a presentation.").length - 1, 1);
    assert.ok(!(await actual.innerText()).includes("AI_GENERATED"));
    const refs = actual.locator("details"); assert.equal(await refs.getAttribute("open"), null);
    await actual.getByText("View learning sources", { exact: true }).click(); assert.equal(await refs.locator("li").count(), 1);
    assert.ok(!(await actual.innerText()).includes("Class conflict: Conflict that occurs"));
    const short = await send("definition"); assert.ok((await short.innerText()).includes("Intra-group conflict"));
    assert.ok(!(await short.innerText()).includes("[AI-GENERATED EXAMPLE]"));
    const detail = await send("structured");
    if (/^#{1,6} /m.test(structured.answer)) assert.ok(await detail.getByRole("heading").count() > 0);
    await send("followup");
    const actualMath = await send("live-math");
    assert.ok(await actualMath.locator(".katex-display").count() > 0);
    assert.equal(await actualMath.locator("table").count(), 1);
    assert.equal(await actualMath.locator("details").getAttribute("open"), null);
    await send("live-attachment-followup");
    const duplicate = await send("duplicates"); for (const text of exampleTexts) assert.equal((await duplicate.innerText()).split(text).length - 1, 1);
    const math = await send("math");
    assert.equal(await math.locator(".katex-display").count(), 1); assert.ok(await math.locator(".katex").count() >= 2);
    assert.equal(await math.locator("table").count(), 1); assert.equal(await math.locator("blockquote").count(), 1); assert.equal(await math.locator("pre code").count(), 1);
    assert.equal(await math.locator("details").getAttribute("open"), null);
    assert.equal(await math.evaluate((node: HTMLElement) => node.parentElement!.className.includes("bg-gray-100")), false);
    const styles = await math.locator("h1").evaluate((node: HTMLElement) => ({ h1: parseFloat(getComputedStyle(node).fontSize), p: parseFloat(getComputedStyle(node.parentElement!.querySelector("p")!).fontSize) })); assert.ok(styles.h1 > styles.p);
    await page.setViewportSize({ width: 768, height: 900 }); const long = await send("long"); assert.ok((await long.innerText()).includes("END-OF-LONG-ANSWER"));
    for (const width of [768, 390]) {
      await page.setViewportSize({ width, height: 844 });
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `no page overflow at ${width}`);
      assert.ok(await long.evaluate((node: HTMLElement) => node.scrollWidth <= node.clientWidth + 1), "wide math, tables and code stay inside the answer");
    }
    await page.screenshot({ path: "/tmp/stewart-learning-mobile.png" });
    await page.setViewportSize({ width: 1200, height: 850 });
    await page.getByRole("button", { name: "Capture", exact: true }).click(); const box = await page.getByLabel("Drag to select a screenshot area. Escape cancels.").boundingBox();
    await page.mouse.move(box.x + 15, box.y + 10); await page.mouse.down(); await page.mouse.move(box.x + 450, box.y + 220, { steps: 6 }); await page.mouse.up(); await page.getByRole("button", { name: "Attach screenshot", exact: true }).click();
    await page.locator('input[type="file"]').setInputFiles([{ name: "Circuit-notes.txt", mimeType: "text/plain", buffer: Buffer.from("Ohm's law is V = IR. For V = 12 V and R = 4 ohms, I = 3 A.") }]);
    await send("attachment"); assert.equal(requests.at(-1)!.attachment_ids!.length, 2); assert.equal(uploaded.length, 2);
    await page.screenshot({ path: "/tmp/stewart-learning-desktop.png" }); assert.deepEqual(errors, []);
    console.log("PASS recorded live definition/explanation/follow-up, Markdown/KaTeX, exact example deduplication, collapsed/grouped sources, responsive long content, screenshot plus document, and follow-up preservation");
  } finally { await browser?.close(); await new Promise<void>((resolve) => server.close(() => resolve())); await rm(temporary, { recursive: true, force: true }); }
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
