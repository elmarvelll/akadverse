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
  const bundle = buildSync({ entryPoints: ['tests/learning-ai/journey.browser.tsx'], alias: { 'next/link': join(process.cwd(), 'tests/platform/runtime.browser.tsx') }, bundle: true, write: false, platform: 'browser', jsx: 'automatic', define: { 'process.env.NODE_ENV': '"development"' } }).outputFiles[0].text;
  const css = 'body{font-family:system-ui;margin:16px;color:#172033}section{max-width:960px;margin:auto}button{margin:4px;padding:8px}textarea,input{box-sizing:border-box;max-width:100%}article{padding:12px;border:1px solid #ddd;margin:8px 0}';
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
    socket.addEventListener('message', event => { const msg = JSON.parse(event.data); if (msg.method==='Runtime.exceptionThrown') console.error(msg.params.exceptionDetails.exception?.description || msg.params.exceptionDetails.text); if (!msg.id) return; const item = pending.get(msg.id); if (!item) return; pending.delete(msg.id); if (msg.error) item.reject(Error(msg.error.message)); else item.resolve(msg.result); });
    const send = (method,params = {}) => new Promise((resolve,reject) => { const id = ++sequence; pending.set(id,{resolve,reject}); socket.send(JSON.stringify({id,method,params})); });
    const evaluate = async expression => { const result = await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true}); if (result.exceptionDetails) throw Error((result.exceptionDetails.exception?.description || result.exceptionDetails.text) + ' in ' + expression.slice(0,250)); return result.result.value; };
    await send('Runtime.enable');
    await send('Page.navigate',{url:`http://127.0.0.1:${server.address().port}`});

    await waitFor(() => evaluate('document.body.textContent.includes("Start or resume lesson")'), 'mount');
    const click = label => evaluate(`Array.from(document.querySelectorAll('button')).find(b=>b.textContent.trim()===${JSON.stringify(label)}).click()`);
    const setValue = async (selector,value) => evaluate(`(()=>{const node=document.querySelector(${JSON.stringify(selector)});const proto=node.tagName==='TEXTAREA'?HTMLTextAreaElement.prototype:HTMLInputElement.prototype;Object.getOwnPropertyDescriptor(proto,'value').set.call(node,${JSON.stringify(value)});node.dispatchEvent(new Event('input',{bubbles:true}));})()`);
    await click('Start or resume lesson');
    await waitFor(() => evaluate('document.body.textContent.includes("Quadratic discriminants")'), 'owned lesson');
    assert.equal(await evaluate('Array.from(document.querySelectorAll("button")).some(b=>b.textContent.trim()==="Try practice")'),false);
    await click('Explain');
    await waitFor(() => evaluate('document.body.textContent.includes("A discriminant describes") && window.learningFixture.receipts.length>0'), 'rendered delivery acknowledgement');
    assert.equal(await evaluate('window.learningFixture.receipts.every(r=>r.visible)'),true);
    await waitFor(() => evaluate('Array.from(document.querySelectorAll("button")).some(b=>b.textContent.trim()==="Try practice")'), 'coverage refresh');
    await click('Try practice');
    await waitFor(() => evaluate('document.querySelectorAll("textarea").length===2'), 'private practice form');
    await setValue('textarea','My draft'); await click('Get a hint');
    await waitFor(() => evaluate('document.body.textContent.includes("Think about real square roots")'), 'hint rendered');
    assert.equal(await evaluate('document.querySelector("textarea").value'),'My draft');
    await setValue('textarea','No real roots'); await setValue('textarea:last-of-type','Negative numbers have no real square root');
    await click('Check my answer');
    await waitFor(() => evaluate('document.body.textContent.includes("Assisted attempt")'), 'backend assistance feedback');
    await click('Try practice');
    await waitFor(() => evaluate('document.querySelectorAll("textarea").length===2'), 'new attempt');
    assert.equal(await evaluate('document.querySelector("textarea").value'),'');
    await click('Continue lesson');
    await waitFor(() => evaluate('document.body.textContent.includes("Lesson completed.")'), 'completion');
    assert.equal(await evaluate('Array.from(document.querySelectorAll("button")).some(b=>b.textContent.trim()==="Continue lesson")'),false);
    assert.equal(await evaluate('document.body.textContent.includes("PRIVATE_")'),false);
    require('node:fs').mkdirSync('docs/audit/screenshots',{recursive:true});
    for(const size of [{name:'desktop',width:1440,height:1000},{name:'mobile',width:390,height:844}]) {
      await send('Emulation.setDeviceMetricsOverride',{width:size.width,height:size.height,deviceScaleFactor:1,mobile:size.name==='mobile'});
      assert.equal(await evaluate('document.documentElement.scrollWidth<=innerWidth'),true,`${size.name} page fits`);
      const capture=await send('Page.captureScreenshot',{format:'png'});writeFileSync(`docs/audit/screenshots/learning-${size.name}.png`,Buffer.from(capture.data,'base64'));
    }
    console.log(JSON.stringify({passed:true,checks:['coverage gates practice','StrictMode receipt follows rendered content','coverage refresh unlocks practice','hint preserves draft','backend assistance feedback','new attempt clears old answer','completion stops progression controls','private content absent','desktop/mobile bounds']}));
  } finally { socket?.close(); browser.kill(); await new Promise(resolve => server.close(resolve)); await delay(250); rmSync(profile,{recursive:true,force:true}); }
}
main().catch(error=>{console.error(error);process.exitCode=1});
