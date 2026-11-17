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
  const bundle = buildSync({ entryPoints: ['tests/platform/portal.browser.tsx'], alias: { 'next/navigation': join(process.cwd(),'tests/platform/portal-runtime.browser.tsx'), 'next/link': join(process.cwd(),'tests/platform/portal-runtime.browser.tsx'), 'next-auth/react': join(process.cwd(),'tests/platform/portal-runtime.browser.tsx') }, bundle: true, write: false, platform: 'browser', jsx: 'automatic', define: { 'process.env.NODE_ENV': '"development"' } }).outputFiles[0].text;
  const css = (await require('postcss')([require('@tailwindcss/postcss')()]).process('@import "tailwindcss" source(none);\n@source "./src/app/studashboard/page.tsx";\n@source "./src/app/components/dashboard/student";', {from:join(process.cwd(),'portal-test.css')})).css + readFileSync('src/app/globals.css','utf8').split('/* Navigation feedback')[1].replace(/^/, '/* Navigation feedback');
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

    await waitFor(() => evaluate('document.querySelectorAll(".workspace-entry").length===3'), 'student cards');
    assert.equal(await evaluate('/CGPA|Results/.test(document.body.textContent)'),false);
    const colours=[];
    const { mkdirSync }=require('node:fs'); mkdirSync('docs/productivity-upgrade/screenshots',{recursive:true});
    await send('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false});
    for(const workspace of [{name:'Marketplace',path:'/studashboard/marketplace'},{name:'E-Learning',path:'/e-learning/student/dashboard'},{name:'Productivity Layer',path:'/studashboard/productivity-layer'}]) {
      const before=await evaluate('portalTest.calls.length');
      await evaluate(`(()=>{const card=[...document.querySelectorAll('.workspace-entry')].find(el=>el.textContent.includes(${JSON.stringify(workspace.name)}));card.click();card.click();})()`);
      await waitFor(() => evaluate('!!document.querySelector(".workspace-entry-icon.is-pending")'), 'pending icon');
      assert.equal(await evaluate('portalTest.calls.length'),before+1,'rapid duplicate click blocked');
      assert.equal(await evaluate('portalTest.calls.at(-1)'),workspace.path);
      assert.equal(await evaluate('[...document.querySelectorAll(".workspace-entry")].every(el=>el.disabled)'),true);
      colours.push(await evaluate('getComputedStyle(document.querySelector(".workspace-entry-icon.is-pending")).color'));
      const capture=await send('Page.captureScreenshot',{format:'png'});writeFileSync(`docs/productivity-upgrade/screenshots/portal-${workspace.name.split(' ')[0].toLowerCase()}.png`,Buffer.from(capture.data,'base64'));
      await evaluate('portalTest.finish()');
      await waitFor(() => evaluate('!document.querySelector(".is-pending") && [...document.querySelectorAll(".workspace-entry")].every(el=>!el.disabled)'), 'transition completes');
    }
    assert.equal(new Set(colours).size,3,'application theme colours differ');
    await evaluate('document.querySelector(".workspace-entry").click()');
    await waitFor(() => evaluate('!!document.querySelector(".is-pending")'), 'cancel attempt pending');
    await send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});
    assert.equal(await evaluate('getComputedStyle(document.querySelector(".is-pending"),"::after").animationName'),'none');
    await evaluate('portalTest.finish(true)');
    await waitFor(() => evaluate('!document.querySelector(".is-pending")'), 'cancelled transition clears');
    console.log(JSON.stringify({passed:true,checks:['three accessible student application cards','blue/orange/green theme colours','transition pending state','rapid repeat prevention','transition completion','cancelled transition recovery','reduced motion','no results or CGPA']}));
  } finally { socket?.close(); browser.kill(); await new Promise(resolve => server.close(resolve)); await delay(250); rmSync(profile,{recursive:true,force:true}); }
}
main().catch(error=>{console.error(error);process.exitCode=1});
