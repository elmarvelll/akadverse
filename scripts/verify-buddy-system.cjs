/* eslint-disable @typescript-eslint/no-require-imports */
// Real Chromium checks against isolated in-memory HTTP fixtures; no account/provider/database access.
const { buildSync } = require('esbuild');
const { createServer } = require('node:http');
const { spawn } = require('node:child_process');
const { readFileSync, mkdtempSync, rmSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { join } = require('node:path');
const assert = require('node:assert/strict');
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
async function waitFor(check, name) { const until = Date.now() + 30000; while (Date.now() < until) { if (await check()) return; await delay(50); } throw Error(`Timed out: ${name}`); }
async function main() {
  const bundle = buildSync({ entryPoints: ['tests/productivity/buddy.browser.tsx'], bundle: true, write: false, outdir: '/tmp/buddy-browser-build', platform: 'browser', jsx: 'automatic', define: { 'process.env.NODE_ENV': '"development"' } }).outputFiles[0].text;
  const css = readFileSync('src/features/productivity/styles.css', 'utf8') + buildSync({ entryPoints: ['tests/productivity/buddy.browser.tsx'], bundle: true, write: false, outdir: '/tmp/buddy-browser-build', platform: 'browser', jsx: 'automatic' }).outputFiles.find(file => file.path.endsWith('.css')).text;
  const server = createServer((req,res) => { if (req.url === '/app.js') { res.setHeader('content-type','text/javascript'); res.end(bundle); } else res.end(`<html><meta name="viewport" content="width=device-width,initial-scale=1"><style>${css}</style><div id="root"></div><script src="/app.js"></script></html>`); });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const profile = mkdtempSync(join(tmpdir(), 'akadverse-assistant-chrome-'));
  const executable = process.env.CHROME_BIN || (process.platform === 'darwin' ? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' : process.platform === 'win32' ? 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe' : 'google-chrome');
  const browser = spawn(executable, ['--headless=new','--disable-gpu','--no-first-run','--remote-debugging-port=0',`--user-data-dir=${profile}`,'about:blank'], { stdio: ['ignore', 'ignore', 'pipe'] });
  let chromeError = ''; browser.stderr.on('data', chunk => { chromeError = (chromeError + chunk).slice(-3000); });
  browser.on('error', error => { chromeError = error.message; });
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

    const click = text => evaluate(`Array.from(document.querySelectorAll('button')).find(node=>node.textContent.trim()===${JSON.stringify(text)})?.click()`);
    const setValue = (selector,value) => evaluate(`(()=>{const node=document.querySelector(${JSON.stringify(selector)});Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(node,${JSON.stringify(value)});node.dispatchEvent(new Event('input',{bubbles:true}));})()`);
    await waitFor(() => evaluate('(document.body?.textContent || "").includes("Calculus Circle")'), 'discovery card');
    await setValue('input[type=search]','  MTH exams  ');
    await waitFor(() => evaluate('!!document.querySelector("article")'), 'description search');
    await click('Request to Join');
    await waitFor(() => evaluate('location.hash.includes("listing=") && !!document.querySelector("form")'), 'direct detail');
    assert.equal(await evaluate('!!document.querySelector("a[target=_blank]")'),false);
    await evaluate('document.querySelector("form").requestSubmit()');
    await waitFor(() => evaluate('(document.body?.textContent || "").includes("Your request is pending approval")'), 'pending state');
    assert.equal(await evaluate('!!document.querySelector("a[target=_blank]")'),false);
    await evaluate('document.querySelector("#actor").click()');
    await waitFor(() => evaluate('(document.body?.textContent || "").includes("Membership Requests") && (document.body?.textContent || "").includes("Sam Student")'), 'creator dashboard');
    await click('Accept');
    await waitFor(() => evaluate('(document.body?.textContent || "").includes("Application accepted.")'), 'approval feedback');
    await evaluate('document.querySelector("#actor").click()');
    await waitFor(() => evaluate('!!document.querySelector("a[target=_blank]")'), 'approved link');
    assert.equal(await evaluate('document.querySelector("a[target=_blank]").rel'),'noopener noreferrer');
    await click('My Groups'); await click("Groups I've Joined");
    await waitFor(() => evaluate('!!document.querySelector("article")'), 'joined groups');
    await click('Create'); await waitFor(() => evaluate('!!document.querySelector("input[name=privateDetails]")'), 'creation form');
    await setValue('input[name=title]','New group');
    await evaluate(`(()=>{const node=document.querySelector('textarea');Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value').set.call(node,'Study together');node.dispatchEvent(new Event('input',{bubbles:true}));})()`);
    await setValue('input[name=privateDetails]','https://evil.test');
    await evaluate('document.querySelector("form").requestSubmit()');
    await waitFor(() => evaluate('(document.body?.textContent || "").includes("Enter a valid WhatsApp")'), 'invalid invitation rejected');
    await click('Cancel'); await click('Buddy Groups');
    await waitFor(() => evaluate('!!document.querySelector("article")'), 'return to discovery');
    for(const size of [{width:1440,height:1000,mobile:false},{width:768,height:1024,mobile:false},{width:390,height:844,mobile:true}]) {
      await send('Emulation.setDeviceMetricsOverride',{...size,deviceScaleFactor:1});
      assert.equal(await evaluate('document.documentElement.scrollWidth<=innerWidth'),true,`fits ${size.width}px`);
    }
    console.log(JSON.stringify({passed:true,checks:['discovery','description search','details','pending link protection','creator management','acceptance refresh','approved chat link','My Groups joined','invalid invite validation','desktop/tablet/mobile bounds']}));
  } catch (error) { console.error(chromeError); throw error; } finally { socket?.close(); browser.kill(); await new Promise(resolve => server.close(resolve)); await delay(250); rmSync(profile,{recursive:true,force:true}); }
}
main().catch(error=>{console.error(error);process.exitCode=1});
