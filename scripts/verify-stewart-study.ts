import { conversationFixture } from "../tests/helpers/stewart-conversation-fixture";
// Browser integration checks against fixture HTTP responses; no AI/database required.
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
  const playwright = createRequire(path.join(process.env.BROWSER_MODULE_DIR ?? process.cwd(), "package.json"))("playwright-core");
  const temporary = await mkdtemp(path.join(tmpdir(), "stewart-study-"));
  const fixture = conversationFixture();
  const server = createServer(async (req, res) => {
    const url = req.url!;
    if (url === "/") { res.setHeader("Content-Type", "text/html"); return res.end('<link rel="stylesheet" href="/style.css"><link rel="stylesheet" href="/katex/katex.min.css"><link rel="stylesheet" href="/bundle.css"><div id="root"></div><script type="module" src="/bundle.js"></script>'); }
    if (["/bundle.js", "/bundle.css", "/style.css"].includes(url)) { res.setHeader("Content-Type", url.endsWith("js") ? "text/javascript" : "text/css"); return res.end(await readFile(path.join(temporary, url.slice(1)))); }
    if (url.startsWith("/katex/")) {
      const relative = url.slice("/katex/".length);
      if (!/^(katex\.min\.css|fonts\/[A-Za-z0-9_-]+\.(woff2?|ttf))$/.test(relative)) { res.statusCode = 404; return res.end(); }
      res.setHeader("Content-Type", relative.endsWith("css") ? "text/css" : "font/woff2");
      return res.end(await readFile(path.join("node_modules/katex/dist", relative)));
    }
    if (url.includes("/access")) { res.setHeader("Content-Type", "application/json"); return res.end(JSON.stringify({ url: "/notes.docx" })); }
    if (url === "/notes.docx") return res.end(docx(Array.from({ length: 60 }, (_, i) => `Section ${i}: Voltage and current in circuits.`)));
    const chunks: Buffer[] = []; for await (const chunk of req) chunks.push(chunk); const bytes = Buffer.concat(chunks);
    res.setHeader("Content-Type", "application/json");
    const result = fixture.handle(new URL(url, "http://localhost").pathname, req.method, bytes);
    if (result) { res.statusCode = result.status; return res.end(JSON.stringify(result.body)); }
    const body = fixture.begin(url, bytes.length ? JSON.parse(bytes.toString()) : {});
    res.end(JSON.stringify(fixture.finish(url, body, { reply: "**Voltage** follows Ohm's law.", truncated: false })));
  });
  let browser;
  try {
    await build({ entryPoints: ["tests/helpers/stewart-study-harness.tsx"], outfile: path.join(temporary, "bundle.js"), bundle: true, platform: "browser", format: "esm", jsx: "automatic", tsconfig: "tsconfig.json", define: { "process.env.NODE_ENV": '"development"' }, plugins: [{ name: "fixture-router", setup(build) { build.onResolve({ filter: /^next\/link$/ }, () => ({ path: "link", namespace: "fixture" })); build.onResolve({ filter: /^next\/navigation$/ }, () => ({ path: "router", namespace: "fixture" })); build.onLoad({ filter: /.*/, namespace: "fixture" }, args => ({ contents: args.path === "link" ? 'import {createElement} from "react"; export default function Link(props){return createElement("a",props)}' : 'export const useRouter=()=>({refresh(){},push(){}});', resolveDir: process.cwd() })); } }] });
    const css = await postcss([tailwind()]).process('@import "tailwindcss";', { from: path.resolve("src/app/globals.css") });
    await writeFile(path.join(temporary, "style.css"), css.css);
    await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
    browser = await playwright.chromium.launch({ executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", headless: true });
    const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
    await page.route("https://example.com/**", (route: { fulfill: (options: unknown) => Promise<void> }) => route.fulfill({ contentType: "image/svg+xml", body: '<svg xmlns="http://www.w3.org/2000/svg" width="200" height="50"><text x="5" y="25">V → R → I</text></svg>' }));
    const errors: string[] = []; page.on("pageerror", (e: Error) => { errors.push(e.message); console.error("Browser error:", e.message); });
    await page.goto(`http://127.0.0.1:${(server.address() as { port: number }).port}`);
    await page.getByRole("heading", { name: "Circuit notes", exact: true }).waitFor({ timeout: 10000 }).catch(async (error: Error) => { console.error(await page.locator("body").innerText()); throw error; });
    const input = page.getByRole("textbox", { name: "Ask Stewart a question" });
    await input.fill("Unsent question");
    const add = await page.getByRole("button", { name: "Add files", exact: true }).boundingBox(); const composer = await input.boundingBox();
    assert.ok(add.y + add.height <= composer.y);
    await page.getByRole("button", { name: "Study Mode", exact: true }).last().click();
    const dialog = page.getByRole("dialog", { name: "Study Mode" }); await dialog.waitFor();
    assert.equal(await input.inputValue(), "Unsent question");
    const bounds = await dialog.boundingBox(); assert.equal(bounds.width, 1400); assert.equal(bounds.height, 900);
    const divider = page.getByRole("separator"); const before = await divider.boundingBox();
    await page.mouse.move(before.x + 3, before.y + 100); await page.mouse.down(); await page.mouse.move(before.x + 100, before.y + 100); await page.mouse.up();
    assert.ok(Number(await divider.getAttribute("aria-valuenow")) > 50);
    await divider.focus(); await page.keyboard.press("Home"); assert.equal(await divider.getAttribute("aria-valuenow"), "30");
    await input.fill("Explain voltage"); await page.getByRole("button", { name: "Send message to Stewart" }).click();
    await page.getByText("follows Ohm's law.", { exact: false }).waitFor();
    await page.screenshot({ path: "/tmp/stewart-study-mode.png" });
    await page.getByRole("button", { name: "Leave Study Mode" }).click();
    assert.equal(await page.getByText("Explain voltage", { exact: true }).count(), 1);
    await input.fill("Keep this draft");
    await page.getByRole("button", { name: "Study Mode", exact: true }).first().click();
    await page.setViewportSize({ width: 390, height: 844 });
    await page.getByRole("button", { name: "stewart", exact: true }).click(); assert.ok(await input.isVisible());
    await page.getByRole("button", { name: "notes", exact: true }).click(); assert.equal(await input.isVisible(), false);
    await page.getByRole("button", { name: "Leave Study Mode" }).click(); assert.equal(await input.inputValue(), "Keep this draft");
    await page.setViewportSize({ width: 1400, height: 900 });
    const fixture = page.getByRole("region", { name: "Lecture fixture" });
    await fixture.getByLabel("True", { exact: true }).check(); await fixture.getByRole("button", { name: "Discuss answer with Stewart" }).click();
    assert.ok((await page.locator("#answer").innerText()).includes("My answer: True"));
    assert.equal(await fixture.locator("math mfrac").count(), 1); assert.equal(await fixture.getByRole("table").count(), 1);
    await page.getByLabel("Week 1 documents").selectOption("extra"); await page.getByRole("heading", { name: "Extra notes", exact: true }).waitFor();
    await page.getByLabel("Week 1 documents").selectOption("notes");
    assert.equal(await input.inputValue(), "Keep this draft");
    assert.equal(await page.getByText("Explain voltage", { exact: true }).count(), 1);
    await page.getByRole("tab", { name: /Week 2/ }).click();
    await page.getByRole("button", { name: "Study Mode", exact: true }).click();
    await page.getByText("No material for Week 2 yet", { exact: true }).waitFor();
    await page.keyboard.press("Escape"); assert.equal(await dialog.count(), 0);
    assert.deepEqual(errors, []);
    console.log("PASS: composer placement, full viewport, pointer/keyboard resizing, chat submission, state preservation, mobile panels, document switching, structured math/table and knowledge checks");
  } finally { await browser?.close(); server.close(); await rm(temporary, { recursive: true, force: true }); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
