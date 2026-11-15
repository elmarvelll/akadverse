import fs from 'node:fs';
import path from 'node:path';
const output=path.resolve('../checkpoints/habit-refinements-2026-11-07');
const pages=await (await fetch('http://localhost:9231/json/list')).json();
const page=pages.find(p=>p.url==='http://localhost:3000/');
const socket=new WebSocket(page.webSocketDebuggerUrl);await new Promise((resolve,reject)=>{socket.onopen=resolve;socket.onerror=reject;});
let id=0;const pending=new Map();const errors=[];socket.onmessage=event=>{const data=JSON.parse(event.data);if(data.id){const request=pending.get(data.id);pending.delete(data.id);if(data.error)request.reject(Error(JSON.stringify(data.error)));else request.resolve(data.result);}else if(data.method==='Runtime.exceptionThrown')errors.push(data.params.exceptionDetails.text);};
const send=(method,params={})=>new Promise((resolve,reject)=>{const requestId=++id;pending.set(requestId,{resolve,reject});socket.send(JSON.stringify({id:requestId,method,params}));});
async function run(expression){const result=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(result.exceptionDetails)throw Error(result.exceptionDetails.exception?.description||result.exceptionDetails.text);return result.result.value;}
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function until(expression){for(let i=0;i<80;i++){if(await run(expression))return;await delay(100);}throw Error('Timed out: '+expression);}
async function click(text){await run(`(()=>{const b=[...document.querySelectorAll('button')].find(b=>b.textContent.trim().endsWith(${JSON.stringify(text)}));if(!b)throw Error('Button absent: '+${JSON.stringify(text)});b.click();})()`);}
async function set(selector,value){await run(`(()=>{const element=document.querySelector(${JSON.stringify(selector)});if(!element)throw Error('Input absent');Object.getOwnPropertyDescriptor(element instanceof HTMLSelectElement?HTMLSelectElement.prototype:HTMLInputElement.prototype,'value').set.call(element,${JSON.stringify(value)});element.dispatchEvent(new Event(element instanceof HTMLSelectElement?'change':'input',{bubbles:true}));})()`);}
const checks=[];function check(value,message){if(!value)throw Error(message);checks.push(message);}
try{
 await send('Runtime.enable');
 // This is the newly created isolated browser-check profile, containing only fixtures from this script.
 await run(`(()=>{const data=JSON.parse(localStorage.getItem('productivity-layer.habits.v1')||'{"habits":[]}');if(data.habits.some(h=>!h.revisions[0].name.startsWith('UI test')))throw Error('Unexpected test-profile data');for(const key of ['productivity-layer.habits.v1','productivity-layer.tasks.v1','productivity-layer.schedule.v1'])localStorage.removeItem(key);})()`);
 await send('Page.reload');
 await until(`!![...document.querySelectorAll('button')].find(b=>b.textContent.trim()==='Habit Tracker')`);
 const original=await run('location.href');
 await click('Habit Tracker');await until(`!![...document.querySelectorAll('button')].find(b=>b.textContent.trim()==='Add habit')`);
 await click('Add habit');await until(`!!document.querySelector('dialog input')`);
 check(await run(`document.querySelector('dialog input[type=time]').value===''`),'Task deadline starts empty');
 await set('dialog input:not([type])','UI test daily');await click('Save habit');await until(`!document.querySelector('dialog')`);
 await click('To-do List');await until(`!!document.querySelector('h2.task-title')`);
 check(await run(`document.querySelectorAll('.task-card').length===1`),'One daily habit card visible in Active');
 await run(`document.querySelector('button[aria-label="Open details for UI test daily"]').click()`);await until(`!!document.querySelector('dialog')`);
 check(await run(`!![...document.querySelectorAll('dialog button')].find(b=>b.textContent.trim()==='Edit habit')&&!['Complete','Mark missed'].some(text=>[...document.querySelectorAll('dialog button')].some(b=>b.textContent.trim()===text))`),'Task details provide Edit habit and no outcome controls');
 await click('Edit habit');await until(`document.querySelector('dialog h2')?.textContent==='Edit habit'`);await click('Cancel');
 await send('Input.dispatchKeyEvent',{type:'keyDown',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});await send('Input.dispatchKeyEvent',{type:'keyUp',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});await until(`!document.querySelector('dialog')`);
 await click('To-do List');await until(`!!document.querySelector('.task-card')`);
 await run(`document.querySelector('.task-card .outcome-complete').click()`);await until(`!document.querySelector('.task-card')`);
 check(await run(`!document.querySelector('dialog')`),'Card Complete saves without opening dialog');
 await run(`document.querySelector('#task-tab-completed').click()`);await until(`!!document.querySelector('.task-card')`);
 check(await run(`!![...document.querySelectorAll('label')].find(e=>e.textContent.includes('Habit history'))`),'Completed tab exposes habit history filter');
 await click('Habit Tracker');await until(`!!document.querySelector('.habit-completed')`);await run(`document.querySelector('.habit-completed').click()`);await until(`!!document.querySelector('dialog')`);
 await click('Clear outcome');await click('Confirm correction');await until(`document.querySelector('dialog')?.textContent.includes('No outcome recorded')`);
 check(await run(`JSON.parse(localStorage.getItem('productivity-layer.tasks.v1')).tasks[0].status==='pending'`),'Tracker clearing updates the shared task record');
 await send('Input.dispatchKeyEvent',{type:'keyDown',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});await send('Input.dispatchKeyEvent',{type:'keyUp',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});await until(`!document.querySelector('dialog')`);
 await click('Add habit');await until(`!!document.querySelector('dialog input')`);await set('dialog input:not([type])','UI test event');await set('dialog select','event');
 check(await run(`[...document.querySelectorAll('dialog input[type=time]')].every(e=>e.value==='')`),'Event times start empty and require explicit input');
 await set('dialog input[type=time]','00:00');await set('dialog input[type=time]:last-of-type','00:00');
 await run(`(()=>{const elements=document.querySelectorAll('dialog input[type=time]');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(elements[1],'00:01');elements[1].dispatchEvent(new Event('input',{bubbles:true}));})()`);
 await click('Save habit');await until(`!document.querySelector('dialog')`);
 const today=await run(`new Intl.DateTimeFormat('en-CA',{timeZone:'Africa/Lagos',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date())`);
 await run(`document.querySelector('button[aria-label="UI test event, ${today}: Scheduled, no outcome"]').click()`);await until(`!!document.querySelector('dialog')`);
 await click('Mark missed');await until(`!![...document.querySelectorAll('dialog button')].find(b=>b.textContent.trim()==='Change to Completed')`);await click('Change to Completed');await click('Confirm correction');await until(`document.querySelector('dialog')?.textContent.includes('Completed:')`);
 check(await run(`JSON.parse(localStorage.getItem('productivity-layer.schedule.v1')).events.find(e=>e.title==='UI test event').status==='completed'`),'Event correction persists on its schedule occurrence');
 await send('Input.dispatchKeyEvent',{type:'keyDown',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});await send('Input.dispatchKeyEvent',{type:'keyUp',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});await until(`!document.querySelector('dialog')`);
 await click('Schedule Manager');await until(`!![...document.querySelectorAll('h3,h2')].find(e=>e.textContent==='UI test event')`);
 await run(`(()=>{const card=[...document.querySelectorAll('.event-card')].find(e=>e.textContent.includes('UI test event'));const button=[...card.querySelectorAll('button')].find(b=>b.textContent.includes('Details'));if(!button)throw Error(card.innerText);button.click();})()`);await until(`!!document.querySelector('dialog')`);
 check(await run(`document.querySelector('dialog').textContent.includes('No backup time set')&&!['Complete','Mark missed'].some(text=>[...document.querySelectorAll('dialog button')].some(b=>b.textContent.trim()===text))&&!document.querySelector('dialog').textContent.includes('Africa/Lagos')`),'Event details omit timezone, show backup fallback and have no outcome controls');
 await send('Input.dispatchKeyEvent',{type:'keyDown',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});await send('Input.dispatchKeyEvent',{type:'keyUp',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});await until(`!document.querySelector('dialog')`);
 await click('Habit Tracker');await until(`!!document.querySelector('.habit-grid')`);
 check((await run('location.href'))===original,'Navigation preserves full URL');
 const snapshot=await run(`({tasks:JSON.parse(localStorage.getItem('productivity-layer.tasks.v1')).tasks.length,events:JSON.parse(localStorage.getItem('productivity-layer.schedule.v1')).events.length})`);
 await send('Page.reload');await until(`!![...document.querySelectorAll('button')].find(b=>b.textContent.trim()==='Habit Tracker')`);await click('Habit Tracker');await until(`!!document.querySelector('.habit-grid')`);
 check(await run(`JSON.parse(localStorage.getItem('productivity-layer.tasks.v1')).tasks.length===${snapshot.tasks}&&JSON.parse(localStorage.getItem('productivity-layer.schedule.v1')).events.length===${snapshot.events}`),'Reload preserves counts without duplicates');
 await send('Emulation.setDeviceMetricsOverride',{width:1280,height:900,deviceScaleFactor:1,mobile:false});await delay(200);
 const shot=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});fs.writeFileSync(path.join(output,'habit-desktop.png'),Buffer.from(shot.data,'base64'));
 await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});await delay(200);const mobile=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});fs.writeFileSync(path.join(output,'habit-mobile.png'),Buffer.from(mobile.data,'base64'));
 check(await run(`document.querySelector('.habit-grid-scroll').scrollWidth>=document.querySelector('.habit-grid-scroll').clientWidth`),'Mobile grid supports horizontal scrolling');
 fs.writeFileSync(path.join(output,'browser-check-results.json'),JSON.stringify({checks,errors},null,2));console.log(JSON.stringify({checks,errors},null,2));
} finally {socket.close();}
