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
async function waitFor(check, name) { const until = Date.now() + 15000; while (Date.now() < until) { if (await check()) return; await delay(50); } throw Error(`Timed out: ${name}`); }
async function main() {
  const bundle = buildSync({ entryPoints: ['tests/productivity/schedule.browser.tsx'], bundle: true, write: false, platform: 'browser', jsx: 'automatic', define: { 'process.env.NODE_ENV': '"development"' } }).outputFiles[0].text;
  const css = readFileSync('src/features/productivity/styles.css', 'utf8');
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

    await waitFor(() => evaluate('!!document.querySelector("#create-task")'), 'mount');
    const setValue = async (selector,value) => evaluate(`(()=>{const node=document.querySelector(${JSON.stringify(selector)});Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(node,${JSON.stringify(value)});node.dispatchEvent(new Event('input',{bubbles:true}));node.dispatchEvent(new Event('change',{bubbles:true}));})()`);
    await evaluate('document.querySelector("#create-task").click()');
    await waitFor(() => evaluate('!!document.querySelector("dialog[open]")'), 'task form');
    await setValue('dialog input[maxlength="200"]','Study EIE 342');
    await evaluate('document.querySelector("dialog input[type=checkbox]").click()');
    await waitFor(() => evaluate('document.querySelectorAll("dialog input[type=date]").length===2'), 'allocation controls');
    await setValue('dialog input[type=date]:not(:disabled)', '2030-01-16');
    await setValue('dialog .check ~ label input[type=date]', '2030-01-15');
    await evaluate('document.querySelector("dialog form").requestSubmit()');
    await waitFor(() => evaluate('!document.querySelector("dialog") && !!document.querySelector(".time-task")'), 'allocated task card');
    assert.equal(await evaluate('document.querySelectorAll(".time-event").length'),2);
    assert.match(await evaluate('document.querySelector(".time-task").title'),/^Task/);
    assert.match(await evaluate('document.querySelector(".time-task").getAttribute("aria-label")'),/Task/);
    assert.equal(await evaluate('document.querySelector(".time-task").style.top'),'650px');
    assert.equal(await evaluate('document.querySelector(".time-task").style.height'),'68px');
    assert.equal(await evaluate('document.querySelector(".time-task").classList.contains("has-conflict")'),true);
    require('node:fs').mkdirSync('docs/productivity-upgrade/screenshots',{recursive:true});
    await send('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false});
    const overlapCapture=await send('Page.captureScreenshot',{format:'png'});
    writeFileSync('docs/productivity-upgrade/screenshots/schedule-overlap.png',Buffer.from(overlapCapture.data,'base64'));
    await evaluate('document.querySelector(".time-task").click()');
    assert.match(await evaluate('document.querySelector("#details").textContent'),/^task:/);
    await evaluate('document.querySelector("#edit-task").click()');
    await waitFor(() => evaluate('!!document.querySelector("dialog[open]")'), 'edit form');
    await setValue('dialog .check ~ label input[type=date]', '2030-01-16');
    await evaluate('document.querySelector("dialog form").requestSubmit()');
    await waitFor(() => evaluate('!document.querySelector("dialog") && !document.querySelector(".time-task")'), 'old date cleared');
    await evaluate('document.querySelector("#next-day").click()');
    await waitFor(() => evaluate('!!document.querySelector(".time-task")'), 'new date shown');
    await evaluate('document.querySelector("#complete-task").click()');
    await waitFor(() => evaluate('document.querySelector(".time-task").textContent.includes("completed")'), 'outcome updated');
    const { mkdirSync } = require('node:fs'); mkdirSync('docs/productivity-upgrade/screenshots',{recursive:true});
    for(const size of [{name:'desktop',width:1440,height:1000},{name:'mobile',width:390,height:844}]) {
      await send('Emulation.setDeviceMetricsOverride',{width:size.width,height:size.height,deviceScaleFactor:1,mobile:size.name==='mobile'});
      assert.equal(await evaluate('document.documentElement.scrollWidth<=innerWidth'),true,`${size.name} page fits`);
      const capture=await send('Page.captureScreenshot',{format:'png'});writeFileSync(`docs/productivity-upgrade/screenshots/schedule-${size.name}.png`,Buffer.from(capture.data,'base64'));
    }
    await evaluate('document.querySelector("#delete-task").click()');
    await waitFor(() => evaluate('!document.querySelector(".time-task")'), 'deleted task removed');
    console.log(JSON.stringify({passed:true,checks:['real TaskForm allocation','source task card','correct hour and height','overlap indication','source details target','reschedule moves days','completion status','deletion removes card','desktop/mobile bounds']}));
  } finally { socket?.close(); browser.kill(); await new Promise(resolve => server.close(resolve)); await delay(250); rmSync(profile,{recursive:true,force:true}); }
}
main().catch(error=>{console.error(error);process.exitCode=1});
