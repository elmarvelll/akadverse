/* eslint-disable @typescript-eslint/no-require-imports */
// Isolated real-browser UI checks. No app server, login, database or network writes.
const { buildSync } = require('esbuild');
const { createServer } = require('node:http');
const { spawn } = require('node:child_process');
const { readFileSync, mkdirSync, writeFileSync } = require('node:fs');
const { resolve } = require('node:path');
const { randomUUID } = require('node:crypto');
const assert = require('node:assert/strict');
const delay = ms => new Promise(done => setTimeout(done, ms));
async function waitFor(check, label) { const start = Date.now(); while (Date.now() - start < 10000) { if (await check()) return; await delay(30); } throw new Error(`Timed out: ${label}`); }
async function main() {
  const bundle = buildSync({ entryPoints: ['tests/productivity/notifications.browser.tsx'], bundle: true, write: false, platform: 'browser', jsx: 'automatic', define: { 'process.env.NODE_ENV': '"development"' } }).outputFiles[0].text;
  const css = readFileSync('src/features/productivity/styles.css', 'utf8');
  const server = createServer((req, res) => { if (req.url === '/app.js') { res.setHeader('Content-Type', 'text/javascript'); res.end(bundle); } else res.end(`<html><head><style>${css}</style></head><body><div id="root"></div><script src="/app.js"></script></body></html>`); });
  await new Promise(done => server.listen(0, '127.0.0.1', done));
  const origin = `http://127.0.0.1:${server.address().port}`;
  const profile = resolve('.local-development', `notification-browser-${randomUUID()}`);
  mkdirSync(profile, { recursive: true });
  const edge = spawn('C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe', ['--headless=new', '--disable-gpu', '--no-first-run', '--remote-debugging-port=0', `--user-data-dir=${profile}`, 'about:blank'], { windowsHide: true, stdio: 'ignore' });
  let socket;
  try {
    let port;
    await waitFor(() => { try { port = readFileSync(resolve(profile, 'DevToolsActivePort'), 'utf8').split('\n')[0]; return !!port; } catch { return false; } }, 'browser');
    const target = (await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()).find(row => row.type === 'page');
    socket = new WebSocket(target.webSocketDebuggerUrl);
    await new Promise((done, fail) => { socket.addEventListener('open', done, { once: true }); socket.addEventListener('error', fail, { once: true }); });
    let sequence = 0; const pending = new Map();
    socket.addEventListener('message', event => { const message = JSON.parse(event.data); if (!message.id) return; const handler = pending.get(message.id); pending.delete(message.id); if (message.error) handler.reject(Error(message.error.message)); else handler.resolve(message.result); });
    const send = (method, params = {}) => new Promise((resolve, reject) => { const id = ++sequence; pending.set(id, { resolve, reject }); socket.send(JSON.stringify({ id, method, params })); });
    const evaluate = async expression => { const result = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }); if (result.exceptionDetails) throw Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text); return result.result.value; };
    const count = () => evaluate('document.querySelectorAll(".productivity-save-notification").length');
    await send('Page.navigate', { url: origin }); await waitFor(() => evaluate('!!window.toastTest'), 'React mount');
    await evaluate('toastTest.start()'); await waitFor(async () => await count() === 1, 'pending notification');
    await delay(5200); assert.match(await evaluate('document.body.textContent'), /Saving/);
    await evaluate('toastTest.succeed()'); await waitFor(() => evaluate('document.body.textContent.includes("Saved successfully.")'), 'success');
    await delay(2100); await evaluate('toastTest.rerender()'); await delay(3100); assert.equal(await count(), 0, 'rerender must not restart the five-second timer');
    await evaluate('toastTest.start(); toastTest.succeed()'); await waitFor(async () => await count() === 1, 'hover success');
    const rect = await evaluate('JSON.stringify(document.querySelector(".productivity-save-notification").getBoundingClientRect().toJSON())'); const bounds = JSON.parse(rect);
    await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: bounds.x + 10, y: bounds.y + 10 });
    await delay(5200); assert.equal(await count(), 1, 'hover pauses dismissal');
    await evaluate('document.querySelector(".productivity-save-notification button").focus()');
    await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: 1, y: 1 }); await delay(5200); assert.equal(await count(), 1, 'focus pauses after hover ends');
    await evaluate('document.querySelector(".productivity-save-notification button").click()'); await waitFor(async () => await count() === 0, 'manual dismissal');
    await evaluate('toastTest.start(); toastTest.fail()'); await waitFor(() => evaluate('!!document.querySelector(".productivity-save-notification.error")'), 'error');
    await delay(5200); assert.equal(await count(), 1, 'errors remain visible');
    await evaluate('toastTest.start()'); await waitFor(() => evaluate('!!document.querySelector(".productivity-save-notification.notice")'), 'explicit retry'); assert.equal(await count(), 1, 'retry replaces error');
    await evaluate('document.querySelector("#test-dialog").showModal()'); await waitFor(() => evaluate('!!document.querySelector("dialog[open] .productivity-save-notification")'), 'modal portal');
    await evaluate('toastTest.succeed()'); await evaluate('document.querySelector("dialog .productivity-save-notification button").focus()');
    assert.equal(await evaluate('document.activeElement.getAttribute("aria-label")'), 'Dismiss notification', 'modal close control is keyboard focusable');
    await evaluate('document.querySelector("dialog .productivity-save-notification button").click(); document.querySelector("#test-dialog").close()');
    await waitFor(async () => await count() === 0, 'modal dismissal');
    const report = { passed: true, checks: ['slow save remains pending', 'success dismisses after five seconds despite rerender', 'hover pauses', 'focus pauses', 'manual dismissal', 'persistent error', 'explicit retry replaces failure', 'modal portal and keyboard close'] };
    writeFileSync('.local-development/productivity-notifications.json', JSON.stringify(report, null, 2)); console.log(JSON.stringify(report));
  } finally { socket?.close(); edge.kill(); await new Promise(done => server.close(done)); }
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
