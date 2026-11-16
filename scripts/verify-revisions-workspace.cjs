/* eslint-disable @typescript-eslint/no-require-imports */
// Real Chromium checks against isolated in-memory HTTP fixtures; no account/provider/database access.
const { buildSync } = require('esbuild');
const { createServer } = require('node:http');
const { spawn } = require('node:child_process');
const { readFileSync, mkdtempSync, rmSync, writeFileSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { join } = require('node:path');
const assert = require('node:assert/strict');
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
async function waitFor(check, name) { const until = Date.now() + 45000; while (Date.now() < until) { if (await check()) return; await delay(50); } throw Error(`Timed out: ${name}`); }
async function main() {
  const bundle = buildSync({ entryPoints: ['tests/revision-questions/workspace.browser.tsx'], bundle: true, write: false, platform: 'browser', jsx: 'automatic', define: { 'process.env.NODE_ENV': '"development"' } }).outputFiles[0].text;
  const css = 'body{margin:0;padding:12px;font:14px sans-serif} textarea,select{box-sizing:border-box;max-width:100%}';
  const server = createServer((req,res) => { if (req.url === '/app.js') { res.setHeader('content-type','text/javascript'); res.end(bundle); } else res.end(`<html><meta name="viewport" content="width=device-width,initial-scale=1"><style>${css}</style><div id="root"></div><script src="/app.js"></script></html>`); });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const profile = mkdtempSync(join(tmpdir(), 'akadverse-assistant-chrome-'));
  const executable = process.env.CHROME_BIN || (process.platform === 'darwin' ? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' : process.platform === 'win32' ? 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe' : 'google-chrome');
  const browser = spawn(executable, ['--headless=new','--disable-gpu','--no-first-run','--remote-debugging-port=0',`--user-data-dir=${profile}`,'about:blank'], { stdio: 'ignore' });
  let socket;
  try {
    let port; await waitFor(() => { try { port = readFileSync(join(profile,'DevToolsActivePort'),'utf8').split('\n')[0]; return !!port; } catch { return false; } }, 'Chromium startup');
    const tabs = await (await fetch(`http://127.0.0.1:${port}/json`)).json();
    socket = new WebSocket(tabs.find(tab => tab.type === 'page').webSocketDebuggerUrl);
    await new Promise((resolve,reject) => { socket.addEventListener('open',resolve,{once:true}); socket.addEventListener('error',reject,{once:true}); });
    const pending = new Map(); let sequence = 0;
    socket.addEventListener('message', event => { const msg = JSON.parse(event.data); if (!msg.id) return; const item = pending.get(msg.id); if (!item) return; pending.delete(msg.id); if (msg.error) item.reject(Error(msg.error.message)); else item.resolve(msg.result); });
    const send = (method,params = {}) => new Promise((resolve,reject) => { const id = ++sequence; pending.set(id,{resolve,reject}); socket.send(JSON.stringify({id,method,params})); });
    const evaluate = async expression => { const result = await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true}); if (result.exceptionDetails) throw Error((result.exceptionDetails.exception?.description || result.exceptionDetails.text) + ' in ' + expression.slice(0,250)); return result.result.value; };
    await send('Page.navigate',{url:`http://127.0.0.1:${server.address().port}`});
    await waitFor(() => evaluate('!!document.querySelector("select option[value=offering1]")'), 'registered courses');
    const click = async text => evaluate(`Array.from(document.querySelectorAll('button')).find(b=>b.textContent===${JSON.stringify(text)}).click()`);
    await click('Random Revision'); await click('Start revision');
    await waitFor(() => evaluate('document.body.textContent.includes("Which discriminant")'), 'MCQ');
    assert.equal(await evaluate('document.body.textContent.includes("PRIVATE EXPLANATION")'),false);
    await evaluate('document.querySelector("input[value=A]").click()');
    await waitFor(() => evaluate('!Array.from(document.querySelectorAll("button")).find(b=>b.textContent==="Submit answer").disabled'), 'MCQ selection');
    await evaluate('document.querySelector("form").requestSubmit()');
    await waitFor(() => evaluate('document.body.textContent.includes("Correct independent answer")'), 'feedback');
    assert.equal(await evaluate('revisionWorkspaceTest.requests.filter(r=>r.action==="rate_item").length'),0);
    await evaluate('revisionWorkspaceTest.remount()');
    await waitFor(() => evaluate('document.body.textContent.includes("PRIVATE EXPLANATION")'), 'resume feedback');
    await click('Good');
    await waitFor(() => evaluate('document.body.textContent.includes("A negative discriminant has no real roots.")'), 'true false');
    await evaluate('document.querySelector("input[type=radio]").click()');
    await waitFor(() => evaluate('!Array.from(document.querySelectorAll("button")).find(b=>b.textContent==="Submit answer").disabled'), 'true false selection');
    await evaluate('document.querySelector("form").requestSubmit()');
    await waitFor(() => evaluate('document.body.textContent.includes("Correct independent answer")'), 'true false feedback');
    await click('Hard');
    await waitFor(() => evaluate('document.body.textContent.includes("Explain the discriminant rule.")'), 'short answer');
    await evaluate(`(()=>{const e=document.querySelector('textarea');Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value').set.call(e,'No real roots');e.dispatchEvent(new Event('input',{bubbles:true}));})()`);
    await waitFor(() => evaluate('!Array.from(document.querySelectorAll("button")).find(b=>b.textContent==="Submit answer").disabled'), 'text answer');
    await evaluate('document.querySelector("form").requestSubmit()');
    await waitFor(() => evaluate('document.body.textContent.includes("Correct independent answer")'), 'text feedback');
    await click('Easy');
    await waitFor(() => evaluate('document.body.textContent.includes("Session finished")'), 'completion');
    assert.equal(await evaluate('revisionWorkspaceTest.requests.filter(r=>r.action==="rate_item").length'),3);
    assert.equal(await evaluate('revisionWorkspaceTest.requests.some(r=>r.studentId||r.expected_answer)'),false);
    await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
    assert.equal(await evaluate('document.documentElement.scrollWidth<=innerWidth'),true);
    const report={passed:true,checks:['registered course choices','Random mode','MCQ answer','hidden explanations before evaluation','independent recall rating','resume after remount','true/false answer','short answer','saved completion and next review','no client identity or expected answer','mobile width']};
    writeFileSync(join(tmpdir(),'revision-workspace-browser-results.json'),JSON.stringify(report,null,2)); console.log(JSON.stringify(report));
  } finally { socket?.close(); browser.kill(); await new Promise(resolve => server.close(resolve)); await delay(250); rmSync(profile,{recursive:true,force:true}); }
}
main().catch(error => {console.error(error.message);process.exitCode=1;});
