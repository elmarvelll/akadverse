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
  const bundle = buildSync({ entryPoints: ['tests/productivity-ai/panel.browser.tsx'], bundle: true, write: false, platform: 'browser', jsx: 'automatic', define: { 'process.env.NODE_ENV': '"development"' } }).outputFiles[0].text;
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
    await waitFor(() => evaluate('!!document.querySelector(".assistant-launcher")'), 'mount');
    await evaluate('document.querySelector(".assistant-launcher").click()');
    await waitFor(() => evaluate('!!document.querySelector(".assistant-welcome button")&&!document.querySelector(".assistant-welcome button").disabled'), 'initial load');
    await evaluate('document.querySelector(".assistant-welcome button").click()');
    await waitFor(() => evaluate('!document.querySelector("#assistant-draft").disabled'), 'new conversation');
    await evaluate('assistantTest.setDraft("create my test task")');
    await waitFor(() => evaluate('document.querySelector("#assistant-draft").value.includes("create")'), 'draft');
    await evaluate('document.querySelector(".assistant-composer").requestSubmit()');
    await waitFor(() => evaluate('document.body.textContent.includes("Saved for student-A")'), 'confirmed message');
    assert.equal(await evaluate('assistantTest.requests.filter(row=>row.data?.action==="chat").length'),1);
    assert.equal(await evaluate('!!document.querySelector(".pip-markdown h2") && !!document.querySelector(".pip-markdown ul strong")'),true,'semantic Markdown');
    assert.equal(await evaluate('!!document.querySelector(".pip-markdown script") || !!document.querySelector(".pip-markdown a[href^=\\"javascript:\\"]")'),false,'safe Markdown');
    assert.equal(await evaluate('document.querySelector(".assistant-launcher").textContent.includes("Ask PIP")'),true);
    assert.equal(await evaluate('getComputedStyle(document.querySelector(".assistant-launcher"),"::before").animationDuration'), '2s');
    assert.equal(await evaluate('!!document.querySelector(".pip-saved-card")'),true,'backend confirmed result card');
    await waitFor(() => evaluate('document.querySelector(".assistant-messages").getAttribute("aria-busy")==="false"'), 'send settles');
    await evaluate('assistantTest.setDraft("Keep this draft")');
    await waitFor(() => evaluate('document.querySelector(".assistant-composer-actions small").textContent.startsWith("15/")'), 'draft state commits');
    await evaluate('document.querySelector(".assistant-heading button").click()');
    await waitFor(() => evaluate('!document.querySelector(".assistant-panel")'), 'minimise');
    assert.equal(await evaluate('document.activeElement?.classList.contains("assistant-launcher")'),true,'focus returns to launcher');
    await evaluate('document.querySelector(".assistant-launcher").click()');
    await waitFor(() => evaluate('document.querySelector("#assistant-draft")?.value==="Keep this draft"'), 'minimise preserves draft');
    await waitFor(() => evaluate('document.activeElement?.id==="assistant-draft"'), 'focus waits for ready composer');
    await evaluate('assistantTest.setDraft("delete test task")');
    await evaluate('document.querySelector(".assistant-composer").requestSubmit()');
    await waitFor(() => evaluate('!!document.querySelector(".assistant-proposal")'), 'confirmation proposal');
    assert.match(await evaluate('document.querySelector(".assistant-proposal").textContent'),/Test reading/);
    await evaluate('document.querySelector(".assistant-actions button:last-child").click()');
    await waitFor(() => evaluate('!document.querySelector(".assistant-proposal")'), 'cancel proposal');
    assert.equal(await evaluate('assistantTest.requests.filter(row=>row.data?.action==="decide").at(-1).data.confirm'),false);
    const { mkdirSync } = require('node:fs');
    mkdirSync('docs/productivity-upgrade/screenshots', { recursive: true });
    for (const size of [{name:'desktop',width:1440,height:1000},{name:'tablet',width:820,height:1100},{name:'mobile',width:390,height:844}]) {
      await send('Emulation.setDeviceMetricsOverride',{width:size.width,height:size.height,deviceScaleFactor:1,mobile:size.name==='mobile'});
      const bounds = await evaluate('(()=>{const r=document.querySelector(".assistant-panel").getBoundingClientRect();return r.left>=0&&r.right<=innerWidth&&r.top>=0&&r.bottom<=innerHeight})()');
      assert.equal(bounds,true,`${size.name} panel bounds`);
      const capture = await send('Page.captureScreenshot',{format:'png'});
      writeFileSync(`docs/productivity-upgrade/screenshots/pip-${size.name}.png`,Buffer.from(capture.data,'base64'));
    }
    await evaluate('document.querySelector("button[aria-label=\\"Expand PIP\\"]").click()');
    assert.equal(await evaluate('document.querySelector(".assistant-panel").classList.contains("is-expanded")'),true);
    await send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});
    assert.equal(await evaluate('getComputedStyle(document.querySelector(".assistant-launcher"),"::before").animationName'),'none');
    await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
    const fits = await evaluate('(()=>{const r=document.querySelector(".assistant-panel").getBoundingClientRect();return r.left>=0&&r.right<=innerWidth&&r.top>=0&&r.bottom<=innerHeight})()'); assert.equal(fits,true,'mobile panel fits viewport');
    await evaluate('document.querySelector("#open-dialog").click()');
    await waitFor(() => evaluate('document.querySelector(".productivity-assistant").hidden'), 'dialog precedence');
    await evaluate('document.querySelector("dialog button").click()');
    await waitFor(() => evaluate('!document.querySelector(".productivity-assistant").hidden'), 'dialog closed');
    await evaluate('assistantTest.setDraft("private account A draft");document.querySelector("#switch-account").click()');
    await waitFor(() => evaluate('!document.querySelector(".assistant-panel")'), 'account clears panel');
    await evaluate('document.querySelector(".assistant-launcher").click()');
    await waitFor(() => evaluate('!!document.querySelector(".assistant-welcome")'), 'new account empty context');
    assert.equal(await evaluate('document.body.textContent.includes("Saved for student-A")'),false);
    assert.equal(await evaluate('document.querySelector("#assistant-draft").value'), '');
    const report = {passed:true,checks:['new conversation','single send','confirmed result','draft survives minimisation','exact target preview','cancellation','mobile bounds','native dialog precedence','account isolation','Markdown formatting and safety','confirmed result cards','two-second ripple','expanded panel','desktop/tablet/mobile bounds','reduced motion','composer focus after async load','focus returns on close']};
    writeFileSync(join(tmpdir(),'productivity-ai-browser-results.json'),JSON.stringify(report,null,2)); console.log(JSON.stringify(report));
  } finally { socket?.close(); browser.kill(); await new Promise(resolve => server.close(resolve)); await delay(250); rmSync(profile,{recursive:true,force:true}); }
}
main().catch(error => {console.error(error.message);process.exitCode=1;});
