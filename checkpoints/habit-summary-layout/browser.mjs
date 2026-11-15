import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { createElement } from '../../schedule-manager/node_modules/react/index.js';
import { renderToStaticMarkup } from '../../schedule-manager/node_modules/react-dom/server.node.js';
import ts from '../../schedule-manager/node_modules/typescript/lib/typescript.js';
import * as domain from '../../schedule-manager/src/features/habits/domain.ts';
import { rangeDays } from '../../schedule-manager/src/features/analytics/periods.ts';
const require = createRequire(new URL('../../schedule-manager/package.json', import.meta.url));
function component(file, name) {
  const source = fs.readFileSync(new URL(`../../schedule-manager/src/features/habits/${file}`, import.meta.url), 'utf8');
  const compiled = ts.transpileModule(source, { compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const exports = {};
  new Function('require', 'exports', compiled)(dependency => dependency === './domain' ? domain : require(dependency), exports);
  return exports[name];
}
const HabitGrid = component('HabitGrid.tsx', 'HabitGrid'), HabitFeedback = component('HabitFeedback.tsx', 'HabitFeedback');
const css = ['globals.css', 'figma.css'].map(file => fs.readFileSync(new URL(`../../schedule-manager/src/app/${file}`, import.meta.url), 'utf8')).join('\n');
const pages = await (await fetch('http://localhost:9241/json/list')).json();
const socket = new WebSocket(pages.find(page => page.url.startsWith('http://localhost:3011')).webSocketDebuggerUrl);
await new Promise((resolve, reject) => { socket.onopen = resolve; socket.onerror = reject; });
let id = 0;
const pending = new Map(), errors = [], checks = [];
socket.onmessage = event => {
  const data = JSON.parse(event.data);
  if (data.id) { const request = pending.get(data.id); pending.delete(data.id); data.error ? request.reject(Error(JSON.stringify(data.error))) : request.resolve(data.result); }
  else if (data.method === 'Runtime.exceptionThrown') errors.push(data.params.exceptionDetails.text);
};
const send = (method, params = {}) => new Promise((resolve, reject) => { pending.set(++id, { resolve, reject }); socket.send(JSON.stringify({ id, method, params })); });
const run = async expression => { const result = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }); if (result.exceptionDetails) throw Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text); return result.result.value; };
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
const until = async expression => { for (let n = 0; n < 80; n++) { if (await run(expression)) return; await delay(100); } throw Error('Timeout: ' + expression); };
const click = label => run(`([...document.querySelectorAll('button')].find(b => b.textContent.trim() === ${JSON.stringify(label)})).click()`);
const check = async (name, expression) => { assert.ok(await run(expression), name); checks.push(name); };
const metrics = () => run(`(()=>{const c=document.querySelector('.habit-calendar-panel'),p=document.querySelector('.habit-consistency-panel'),s=document.querySelector('.habit-consistency-content'),h=document.querySelector('.habit-consistency-heading');return {calendar:c.getBoundingClientRect().height,summary:p.getBoundingClientRect().height,scroll:s.clientHeight,content:s.scrollHeight,header:h.getBoundingClientRect().top,rows:document.querySelectorAll('.habit-today-row').length,width:innerWidth,height:innerHeight};})()`);
const snapshot = async name => { await run(`document.querySelector('.habit-calendar-layout').scrollIntoView({block:'start'});window.scrollBy(0,-80)`); await delay(150); const result = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false }); fs.writeFileSync(new URL(name, import.meta.url), Buffer.from(result.data, 'base64')); };
async function seed(count, date) {
  // Render the actual components without invoking recurrence generation or
  // writing records. These fixtures isolate layout from domain throughput.
  const at='2025-01-01T00:00:00Z';
  const habits=Array.from({length:count},(_,index)=>({id:'summary-layout-'+index,ownerId:'student',timezone:'Africa/Lagos',createdDate:'2025-01-01',createdAt:at,revisions:[{name:'Habit '+String(index+1).padStart(2,'0'),description:'Layout fixture',type:'task',priority:'medium',frequency:'daily',weekdays:[],time:'',startDate:'2025-01-01',effectiveDate:'2025-01-01',at,archived:false}]}));
  const dates=rangeDays(domain.monthRange(date));
  const occurrences=habits.flatMap(habit=>dates.map(day=>({id:`${habit.id}:${day}`,habitId:habit.id,date:day,settings:habit.revisions[0]})));
  const grid=renderToStaticMarkup(createElement(HabitGrid,{habit:habits[0],dates,occurrences,today:date,onOpen(){}}));
  const summary=renderToStaticMarkup(createElement(HabitFeedback,{habit:habits[0],habits,occurrences,monthOccurrences:occurrences,now:{date,time:'12:00'},period:'month',weekDate:date,showToday:true,onPeriod(){},onWeekDate(){},onOpen(){},onRule(){}}));
  const html=`<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>${css}</style></head><body><div class="productivity-workspace"><main class="prod-main"><div class="module-view"><div class="habit-calendar-layout"><section class="habit-calendar-panel"><div class="habit-calendar-heading"><h2>Habit 01 Attendance Calendar</h2><div class="habit-month-nav"><button>‹</button><span>${new Intl.DateTimeFormat('en-GB',{month:'long',year:'numeric',timeZone:'UTC'}).format(new Date(date+'T12:00:00Z'))}</span><button>›</button></div></div><div class="habit-calendar-legend"><span><i class="legend-completed"></i>Completed</span><span><i class="legend-missed"></i>Missed</span><span><i class="legend-unscheduled"></i>Not scheduled</span><span><i class="legend-unrecorded"></i>Unrecorded / upcoming</span><span><i class="legend-review"></i>Needs review</span></div>${grid}<div class="habit-calendar-footer"><span>Choose a date to view its occurrence.</span><button>Current month</button></div></section>${summary}</div></div></main></div></body></html>`;
  const tree=await send('Page.getFrameTree');
  await send('Page.setDocumentContent',{frameId:tree.frameTree.frame.id,html});
}
try {
  await send('Runtime.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false });
  await send('Page.navigate',{url:'about:blank'});
  await delay(100);
  await seed(1, '2026-02-15');
  const short = await metrics();
  assert.ok(Math.abs(short.summary-short.calendar)<1); checks.push('Short summary matches a four-week calendar');
  await seed(30, '2026-02-15');
  const long = await metrics();
  assert.ok(Math.abs(long.summary-long.calendar)<1 && Math.abs(long.calendar-short.calendar)<1); checks.push('Thirty items do not stretch the calendar or row');
  assert.ok(long.content>long.scroll); checks.push('Long summary content scrolls internally');
  await check('Scroll region can shrink and shows a right-side scrollbar', `(()=>{const s=document.querySelector('.habit-consistency-content'),style=getComputedStyle(s);return style.minHeight==='0px' && style.overflowY==='auto' && s.offsetWidth>s.clientWidth;})()`);
  await run(`document.querySelector('.habit-consistency-content').scrollTop=1e6`);
  const scrolled = await metrics();
  assert.equal(scrolled.header,long.header); checks.push('Heading stays fixed while the content scrolls');
  await check('Last item and Inspect rule remain reachable', `(()=>{const s=document.querySelector('.habit-consistency-content'),r=s.getBoundingClientRect(),last=document.querySelector('.habit-today-row:last-child').getBoundingClientRect(),footer=document.querySelector('.habit-consistency-footer').getBoundingClientRect();return last.top>=r.top && last.bottom<=r.bottom && footer.bottom<=r.bottom;})()`);
  await run(`document.querySelector('.habit-today-row:last-child button').focus()`);
  await check('Last summary item remains keyboard accessible', `document.activeElement.getAttribute('aria-label')==='Habit 30 today: Open'`);
  await snapshot('desktop-long.png');
  await seed(30, '2026-08-15');
  const sixWeeks = await metrics();
  assert.ok(sixWeeks.calendar>long.calendar+100 && Math.abs(sixWeeks.summary-sixWeeks.calendar)<1); checks.push('Six-week month increases both heights automatically');
  await run(`window.__calendarHeight=document.querySelector('.habit-calendar-panel').getBoundingClientRect().height;document.querySelector('.habit-feedback-explanation').open=true;`);
  await check('Expanded content cannot change row height', `Math.abs(document.querySelector('.habit-consistency-panel').getBoundingClientRect().height-window.__calendarHeight)<1 && Math.abs(document.querySelector('.habit-calendar-panel').getBoundingClientRect().height-window.__calendarHeight)<1`);
  await send('Emulation.setDeviceMetricsOverride', { width: 1200, height: 900, deviceScaleFactor: 1, mobile: false });
  await check('Narrow desktop keeps matching heights as calendar headings wrap', `Math.abs(document.querySelector('.habit-consistency-panel').getBoundingClientRect().height-document.querySelector('.habit-calendar-panel').getBoundingClientRect().height)<1`);
  await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
  const mobile = await metrics();
  assert.ok(mobile.summary<=844*.7+1 && mobile.content>mobile.scroll); checks.push('Mobile summary has a viewport-relative bound and internal scrolling');
  await check('Mobile panels stack without page overflow', `document.querySelector('.habit-consistency-panel').getBoundingClientRect().top>document.querySelector('.habit-calendar-panel').getBoundingClientRect().bottom && document.documentElement.scrollWidth<=innerWidth`);
  await run(`document.querySelector('.habit-consistency-panel').scrollIntoView({block:'start'});window.scrollBy(0,-80);document.querySelector('.habit-consistency-content').scrollTop=0`);
  const headingBefore = (await metrics()).header;
  await run(`document.querySelector('.habit-consistency-content').scrollTop=1e6`);
  assert.equal((await metrics()).header, headingBefore); checks.push('Mobile heading remains visible while reaching the last item');
  await check('Mobile last item and footer are accessible', `(()=>{const s=document.querySelector('.habit-consistency-content').getBoundingClientRect(),last=document.querySelector('.habit-today-row:last-child').getBoundingClientRect(),footer=document.querySelector('.habit-consistency-footer').getBoundingClientRect();return last.top>=s.top && last.bottom<=s.bottom && footer.bottom<=s.bottom;})()`);
  const shot=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});fs.writeFileSync(new URL('mobile-long.png',import.meta.url),Buffer.from(shot.data,'base64'));
  await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 500, deviceScaleFactor: 1, mobile: true });
  const small = await metrics(); assert.ok(small.summary<=351 && small.scroll>0 && small.content>small.scroll); checks.push('Short mobile viewport retains a usable scroll area');
  await seed(1,'2026-02-15');
  const mobileShort = await metrics(); assert.ok(mobileShort.summary<=351 && mobileShort.scroll>0); checks.push('Short list remains bounded in stacked layout');
  assert.deepEqual(errors, []);
  const result={passed:checks.length,checks,measurements:{short,long,sixWeeks,mobile,small,mobileShort},errors};
  fs.writeFileSync(new URL('results.json',import.meta.url),JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));
} finally { socket.close(); }
