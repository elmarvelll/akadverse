/* eslint-disable @typescript-eslint/no-require-imports */
// Windows/Edge local production benchmark. Build first. Creates and removes only
// its own normal student fixture; never connects to a shared or remote database.
// Run: npm run test:productivity:performance -- after
const fs=require('node:fs'),path=require('node:path'),net=require('node:net');
const {spawn,spawnSync}=require('node:child_process'); const {randomUUID,randomBytes}=require('node:crypto');
const assert=require('node:assert/strict');
const {setTimeout:delay}=require('node:timers/promises');const {PrismaClient}=require('@prisma/client');const bcrypt=require('bcryptjs');
fs.mkdirSync('.local-development',{recursive:true});
const core='postgresql://akadverse:akadverse_local_only@127.0.0.1:5433/akadverse';
const academicUrl=new URL(core);academicUrl.pathname='/akadverse_elearning';const academic=academicUrl.toString();
Object.assign(process.env,{DATABASE_URL:core,DIRECT_URL:core,ELEARNING_DATABASE_URL:academic,ELEARNING_DIRECT_URL:academic});
const db=new PrismaClient({datasourceUrl:core,log:[]});
async function freePort(){const s=net.createServer();await new Promise((r,j)=>{s.once('error',j);s.listen(0,'127.0.0.1',r)});const p=s.address().port;await new Promise(r=>s.close(r));return p;}
class CDP {
 constructor(socket){this.socket=socket;this.id=0;this.pending=new Map();this.listeners=[];socket.addEventListener('message',event=>{const m=JSON.parse(event.data);if(m.id){const p=this.pending.get(m.id);this.pending.delete(m.id);if(p){if(m.error)p.reject(new Error(m.error.message));else p.resolve(m.result); }}else this.listeners.forEach(fn=>fn(m.method,m.params));});}
 send(method,params={}){return new Promise((resolve,reject)=>{const id=++this.id;this.pending.set(id,{resolve,reject});this.socket.send(JSON.stringify({id,method,params}));});}
 async evaluate(expression){const result=await this.send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(result.exceptionDetails)throw Error(result.exceptionDetails.exception?.description||result.exceptionDetails.text);return result.result.value;}
}
async function waitFor(fn,label,limit=60000){const start=Date.now();while(Date.now()-start<limit){if(await fn())return Date.now()-start;await delay(40);}throw new Error('Timed out: '+label);}
async function main(){let app,edge,user,browserDir;let logs='';let cdp;const report={label:process.argv[2]||'before',latencyMs:Number(process.env.PERF_LATENCY_MS||150),fixture:{completedTasks:Number(process.env.PERF_COMPLETED_TASKS||60),openTasks:Number(process.env.PERF_OPEN_TASKS||10),dailyHabits:2},views:[]};
 try{
  const appPort=await freePort(),origin=`http://localhost:${appPort}`,debugPort=await freePort();
  app=spawn(process.execPath,['node_modules/next/dist/bin/next','start','--hostname','127.0.0.1','--port',String(appPort)],{windowsHide:true,stdio:['ignore','pipe','pipe'],env:{...process.env,NODE_ENV:'production',ENABLE_DEV_LOGIN:'false',NEXTAUTH_URL:origin,NEXTAUTH_SECRET:randomBytes(32).toString('hex'),GOOGLE_CLIENT_ID:'',GOOGLE_CLIENT_SECRET:'',DB_TIMING_DEBUG:'1'}});
  for(const stream of [app.stdout,app.stderr])stream.on('data',chunk=>{logs+=chunk;});
  await waitFor(async()=>{try{return (await fetch(origin+'/api/auth/providers')).ok}catch{return false}},'production server');
  const password=randomBytes(24).toString('hex');user=await db.user.create({data:{firstName:'Performance',lastName:'Local Fixture',email:`perf-${randomUUID()}@stu.cu.edu.ng`,password:await bcrypt.hash(password,10),role:'student'}});
  const {TaskService}=require('../src/features/productivity/tasks/service.ts');
  let data={version:2,tasks:[]};const identity={getCurrentStudent:async()=>({id:user.id,name:'Performance Local Fixture',timezone:'Africa/Lagos',development:false})};
  const tasks=new TaskService({load:async()=>structuredClone(data),save:async value=>{data=structuredClone(value);}},identity,()=>new Date(Date.now()-20*86400000));
  for(let i=0;i<report.fixture.completedTasks+report.fixture.openTasks;i++){const task=await tasks.createTask({title:`Performance task ${i}`,description:'Historical notes '.repeat(20),priority:'medium'});if(i<report.fixture.completedTasks)await tasks.completeTask(task.id);}
  await db.productivityTask.createMany({data:data.tasks.map(task=>({id:task.id,ownerId:user.id,data:JSON.parse(JSON.stringify(task)),outcome:task.status==='pending'?'unrecorded':task.status,createdAt:new Date(task.createdAt)}))});
  const cookies=new Map();
  async function request(route,options={}){const headers=new Headers(options.headers);headers.set('Cookie',[...cookies].map(([k,v])=>`${k}=${v}`).join('; '));const response=await fetch(origin+route,{...options,headers,redirect:'manual'});for(const cookie of response.headers.getSetCookie()){const [first]=cookie.split(';'),at=first.indexOf('=');cookies.set(first.slice(0,at),first.slice(at+1));}return response;}
  const csrf=(await (await request('/api/auth/csrf')).json()).csrfToken;
  await request('/api/auth/callback/credentials',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({csrfToken:csrf,email:user.email,password,json:'true',callbackUrl:origin+'/studashboard'})});
  const session=await (await request('/api/auth/session')).json();if(session.user?.id!==user.id)throw Error('Fixture login failed');
  async function rpc(operation,args=[]){const response=await request('/api/productivity',{method:'POST',headers:{'Content-Type':'application/json',Origin:origin,'X-Productivity-User':user.id},body:JSON.stringify({operation,args,requestId:randomUUID()})});const body=await response.json();if(!response.ok)throw Error(operation+' '+response.status);return body.result;}
  const day=new Intl.DateTimeFormat('en-CA',{timeZone:'Africa/Lagos',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
  for(const type of ['task','event'])await rpc('habits.save',[{name:`Performance ${type} habit`,description:'',type,frequency:'daily',weekdays:[],priority:'medium',time:type==='task'?'':'14:00',end:type==='event'?'15:00':undefined,startDate:day}]);
  browserDir=path.resolve('.local-development',`edge-perf-${randomUUID()}`);
  edge=spawn('C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',['--headless=new','--disable-gpu','--no-first-run',`--remote-debugging-port=${debugPort}`,`--user-data-dir=${browserDir}`,'about:blank'],{windowsHide:true,stdio:'ignore'});
  let target;await waitFor(async()=>{try{const list=await(await fetch(`http://127.0.0.1:${debugPort}/json/list`)).json();target=list.find(t=>t.type==='page');return !!target}catch{return false}},'browser');
  const socket=new WebSocket(target.webSocketDebuggerUrl);await new Promise((r,j)=>{socket.addEventListener('open',r,{once:true});socket.addEventListener('error',j,{once:true});});cdp=new CDP(socket);
  await cdp.send('Network.enable');await cdp.send('Page.enable');await cdp.send('Runtime.enable');await cdp.send('Network.setCacheDisabled',{cacheDisabled:true});
  await cdp.send('Network.setCookies',{cookies:[...cookies].map(([name,value])=>({name,value,domain:'localhost',path:'/'}))});
  await cdp.send('Network.emulateNetworkConditions',{offline:false,latency:report.latencyMs,downloadThroughput:10000000,uploadThroughput:10000000});
  let events=[],pending=new Set(),changed=0,peak=0;const assets=[];
  cdp.listeners.push((method,params)=>{if(method==='Network.requestWillBeSent'){if(['Script','Stylesheet'].includes(params.type))assets.push(params.requestId);if(params.request.url.includes('/api/productivity')){let operation='unknown';try{operation=JSON.parse(params.request.postData).operation}catch{}events.push({id:params.requestId,operation,signature:params.request.postData,started:Date.now()});pending.add(params.requestId);peak=Math.max(peak,pending.size);changed=Date.now();}}
   if(method==='Page.frameNavigated'&&!params.frame.parentId){for(const event of events)if(pending.has(event.id)){event.cancelled=true;event.durationMs=Date.now()-event.started;}pending.clear();changed=Date.now();}
   if(method==='Network.loadingFinished'||method==='Network.loadingFailed'){const event=events.find(e=>e.id===params.requestId);if(event){event.durationMs=Date.now()-event.started;event.bytes=params.encodedDataLength||0;pending.delete(params.requestId);changed=Date.now();}}
  });
  async function idle(){await waitFor(()=>Promise.resolve(pending.size===0&&Date.now()-changed>400),'API idle');}
  async function visible(selector){return cdp.evaluate(`(()=>{const elements=[...document.querySelectorAll(${JSON.stringify(selector)})];return elements.some(e=>e.getClientRects().length>0&&!e.closest('[hidden]'))})()`);}
  // Measure navigation within one freshness window. Deadline/midnight behavior
  // is tested separately; setup waiting is excluded from measured timings.
  const untilMinute=60000-Date.now()%60000;if(untilMinute<12000)await delay(untilMinute+20);
  const start=Date.now(),queryStart=logs.length;await cdp.send('Page.navigate',{url:origin+'/studashboard/productivity-layer'});
  await waitFor(()=>visible('.prod-sidebar'),'shell');report.shellMs=Date.now()-start;
  await waitFor(()=>visible('.module-view'),'initial view');report.initialContentMs=Date.now()-start;report.defaultTitle=await cdp.evaluate(`document.querySelector('.module-view .page-heading h1')?.textContent`);
  report.contentBeforePrefetch={completedRequests:events.filter(event=>event.durationMs!==undefined).length,bytes:events.filter(event=>event.durationMs!==undefined).reduce((sum,event)=>sum+(event.bytes||0),0),sqlQueries:(logs.slice(queryStart).match(/\[db-timing\]/g)||[]).length};
  report.opensToday=await visible('.today-module'); await waitFor(()=>cdp.evaluate(`document.querySelector('[data-productivity-preparation="ready"]')!==null`),'shared preparation'); report.initialPreparationMs=Date.now()-start; await idle();
  const screenshot=await cdp.send('Page.captureScreenshot',{format:'png'});fs.writeFileSync(path.join('.local-development',`productivity-${report.label}.png`),Buffer.from(screenshot.data,'base64'));
  report.peakInitialRequests=peak;
  report.initialRequests=events.length;report.initialOperations=events.map(e=>e.operation);report.initialBytes=events.reduce((n,e)=>n+(e.bytes||0),0);report.initialSqlQueries=(logs.slice(queryStart).match(/\[db-timing\]/g)||[]).length;
  const officialResponse=events.find(event=>event.operation==='official.range');
  const officialBody=await cdp.send('Network.getResponseBody',{requestId:officialResponse.id});
  const officialResult=JSON.parse(officialBody.base64Encoded?Buffer.from(officialBody.body,'base64').toString('utf8'):officialBody.body);
  assert.deepEqual(officialResult.result.failedDates,[]);report.academicPrepared=true;
  for(let repeat=0;repeat<2;repeat++)for(const [label,selector]of [['To-do List','.tasks-module'],['Schedule Manager','.schedule-module, .module-view:has(.schedule-panel)'],['Habit Tracker','.habits-module'],['Today','.today-module']]){
    const before=events.length,codeBefore=assets.length,sql=logs.length,t=Date.now();
    await cdp.evaluate(`document.querySelector('nav[aria-label="Workspace navigation"] button[aria-label="${label}"]').click()`);
    const targetSelector=label==='Schedule Manager'?'.schedule-manager, .module-view:has(.date-toolbar)':selector;
    await waitFor(()=>visible(targetSelector),label);
    const ready=Date.now()-t;await idle();const requests=events.slice(before);
    report.views.push({section:label,readyMs:ready,requests:requests.length,codeRequests:assets.length-codeBefore,operations:requests.map(e=>e.operation),bytes:requests.reduce((n,e)=>n+(e.bytes||0),0),sqlQueries:(logs.slice(sql).match(/\[db-timing\]/g)||[]).length});
  }
  // All four default task tabs were part of the initial preparation.
  await cdp.evaluate(`document.querySelector('nav[aria-label="Workspace navigation"] button[aria-label="To-do List"]').click()`);
  await waitFor(()=>visible('.tasks-module'),'prepared task tabs');
  const tabStart=events.length;report.taskTabs=[];
  for(const status of ['active','pending','completed','missed','active']){
    const started=Date.now();await cdp.evaluate(`document.getElementById('task-tab-${status}').click()`);
    await waitFor(()=>cdp.evaluate(`document.getElementById('task-tab-${status}').getAttribute('aria-selected')==='true'`),'prepared '+status+' tab');
    report.taskTabs.push({status,readyMs:Date.now()-started});
  }
  await idle();report.taskTabRequests=events.length-tabStart;assert.equal(report.taskTabRequests,0);
  report.journeyRequests=events.length;
  // A different month and extra task pages load on demand, then are reusable.
  await cdp.evaluate(`document.querySelector('nav[aria-label="Workspace navigation"] button[aria-label="Habit Tracker"]').click()`);
  await waitFor(()=>visible('.habits-module'),'month navigation');
  const monthStart=events.length;
  await cdp.evaluate(`document.querySelector('.habits-module button[aria-label="Next month"]').click()`);await idle();
  report.additionalMonthRequests=events.length-monthStart;assert.equal(report.additionalMonthRequests,1);
  const monthReturn=events.length;
  await cdp.evaluate(`[...document.querySelectorAll('.habits-module button')].find(button=>button.textContent==='Current month').click()`);await idle();
  report.returnMonthRequests=events.length-monthReturn;assert.equal(report.returnMonthRequests,0);
  await cdp.evaluate(`document.querySelector('nav[aria-label="Workspace navigation"] button[aria-label="To-do List"]').click()`);
  await waitFor(()=>visible('.tasks-module'),'task pagination');
  const nextPage=`[...document.querySelectorAll('.tasks-module button')].find(button=>button.textContent==='Next page')`;
  report.additionalHistoryPage=false;
  await cdp.evaluate(`document.getElementById('task-tab-completed').click()`);await idle();
  if(await cdp.evaluate(`!${nextPage}.disabled`)){
    const pageStart=events.length;await cdp.evaluate(`${nextPage}.click()`);await idle();
    report.additionalHistoryPage=events.length>pageStart;
    await cdp.evaluate(`[...document.querySelectorAll('.tasks-module button')].find(button=>button.textContent==='Previous page').click()`);await idle();
  }
  await cdp.evaluate(`document.getElementById('task-tab-active').click()`);await idle();
  report.duplicateRequests=events.length-new Set(events.map(event=>event.signature)).size;
  report.requestDurations=events.map(({operation,durationMs,bytes})=>({operation,durationMs,bytes}));
  report.sqlDurationMs=(logs.slice(queryStart).match(/\[db-timing\] (\d+)ms/g)||[]).reduce((sum,line)=>sum+Number(line.match(/(\d+)ms/)[1]),0);
  // The same route and selection state must survive fast navigation.
  const rapidStart=events.length;
  for(const label of ['Schedule Manager','Habit Tracker','To-do List','Today','Habit Tracker','Today'])await cdp.evaluate(`document.querySelector('nav[aria-label="Workspace navigation"] button[aria-label="${label}"]').click()`);
  await waitFor(()=>visible('.today-module'),'rapid switch to Today');await idle();
  report.rapidSwitchRequests=events.length-rapidStart;
  assert.equal(await visible('.tasks-module'),false);
  assert.equal(await visible('.habits-module'),false);
  assert.equal(await visible('.schedule-module'),false);
  // Drive the real form and client RPC so this exercises cache invalidation.
  await cdp.evaluate(`document.querySelector('nav[aria-label="Workspace navigation"] button[aria-label="To-do List"]').click()`);
  await waitFor(()=>visible('.tasks-module'),'task form');
  await cdp.evaluate(`[...document.querySelectorAll('.tasks-module button')].find(button=>button.textContent.includes('New task')).click()`);
  await waitFor(()=>visible('dialog input[required]'),'task editor');
  await cdp.evaluate(`(()=>{const input=document.querySelector('dialog input[required]');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input,'Cache verification task');input.dispatchEvent(new Event('input',{bubbles:true}));})()`);
  await cdp.evaluate(`document.querySelector('dialog form').requestSubmit()`);
  await waitFor(()=>cdp.evaluate(`!document.querySelector('dialog')&&document.querySelector('.tasks-module')?.textContent.includes('Cache verification task')`),'task save and refresh');
  await cdp.evaluate(`document.querySelector('nav[aria-label="Workspace navigation"] button[aria-label="Today"]').click()`);
  await waitFor(()=>cdp.evaluate(`document.querySelector('.today-module')?.textContent.includes('Cache verification task')`),'Today mutation summary');
  report.mutationUpdatesToday=true;await idle();
  // Create an event through Schedule, then verify Today works even offline.
  await cdp.evaluate(`document.querySelector('nav[aria-label="Workspace navigation"] button[aria-label="Schedule Manager"]').click()`);
  await waitFor(()=>visible('.schedule-module'),'event save verification');
  await cdp.evaluate(`[...document.querySelectorAll('.schedule-module button')].find(button=>button.textContent.includes('Create event')).click()`);
  await waitFor(()=>visible('dialog input[required]'),'schedule editor');
  const setField=`(selector,value,textarea=false)=>{const input=document.querySelector(selector);Object.getOwnPropertyDescriptor((textarea?HTMLTextAreaElement:HTMLInputElement).prototype,'value').set.call(input,value);input.dispatchEvent(new Event('input',{bubbles:true}));}`;
  if(await cdp.evaluate(`document.querySelector('dialog h2')?.textContent.includes('sub-category')`)){
    await cdp.evaluate(`(${setField})('dialog input[required]','Verification calendar')`);
    await cdp.evaluate(`document.querySelector('dialog form').requestSubmit()`);await waitFor(()=>cdp.evaluate(`!document.querySelector('dialog')`),'calendar category save');
    await cdp.evaluate(`[...document.querySelectorAll('.schedule-module button')].find(button=>button.textContent.includes('Create event')).click()`);await waitFor(()=>visible('dialog input[required]'),'new event form');
  }
  await cdp.evaluate(`(${setField})('dialog input[required]','Event cache verification')`);
  await cdp.evaluate(`(${setField})('dialog textarea','Saved event for Today verification',true)`);
  await cdp.evaluate(`document.querySelector('dialog form').requestSubmit()`);await waitFor(()=>cdp.evaluate(`!document.querySelector('dialog')`),'event save');await idle();
  const savedStart=events.length;
  await cdp.send('Network.emulateNetworkConditions',{offline:true,latency:0,downloadThroughput:0,uploadThroughput:0});
  await cdp.evaluate(`document.querySelector('nav[aria-label="Workspace navigation"] button[aria-label="Today"]').click()`);
  await waitFor(()=>cdp.evaluate(`document.querySelector('.today-module')?.textContent.includes('Event cache verification')`),'confirmed event visible in Today offline');
  assert.equal(events.length,savedStart);report.savedEventUpdatesTodayWithoutRefetch=true;
  await cdp.send('Network.emulateNetworkConditions',{offline:false,latency:report.latencyMs,downloadThroughput:10000000,uploadThroughput:10000000});
  // Reload and switch while the common initial request is still pending.
  const earlyStart=events.length;
  await cdp.send('Page.navigate',{url:origin+'/studashboard/productivity-layer'});
  await waitFor(()=>Promise.resolve(events.slice(earlyStart).some(event=>event.operation==='workspace.initial'&&event.durationMs===undefined)),'pending shared initial request');
  await cdp.evaluate(`document.querySelector('nav[aria-label="Workspace navigation"] button[aria-label="Habit Tracker"]').click()`);
  await waitFor(()=>visible('.habits-module'),'early-selected habit view');await idle();
  report.earlySwitchWorks=true;assert.equal(await visible('.today-module'),false);
  // Inject a task-history preparation failure without discarding valid core data.
  let injected=false, interceptionError;
  const intercept=(method,params)=>{if(method!=='Fetch.requestPaused')return;void(async()=>{
    const operation=JSON.parse(params.request.postData||'{}').operation;
    if(operation==='workspace.initial'&&!injected){
      injected=true;const body=await cdp.send('Fetch.getResponseBody',{requestId:params.requestId});
      const payload=JSON.parse(body.base64Encoded?Buffer.from(body.body,'base64').toString('utf8'):body.body);
      delete payload.result.taskPages;payload.result.taskError='Test: task history is temporarily unavailable.';
      await cdp.send('Fetch.fulfillRequest',{requestId:params.requestId,responseCode:200,responseHeaders:[{name:'Content-Type',value:'application/json'},{name:'Cache-Control',value:'private, no-store'}],body:Buffer.from(JSON.stringify(payload)).toString('base64')});
    }else await cdp.send('Fetch.continueResponse',{requestId:params.requestId});
  })().catch(error=>{interceptionError=error;});};
  cdp.listeners.push(intercept);await cdp.send('Fetch.enable',{patterns:[{urlPattern:'*/api/productivity',requestStage:'Response'}]});
  await cdp.send('Page.navigate',{url:origin+'/studashboard/productivity-layer'});
  await waitFor(()=>visible('.today-module'),'Today despite task preparation failure');await idle();
  if(interceptionError)throw interceptionError;assert.equal(injected,true);
  assert.equal(await cdp.evaluate(`document.body.textContent.includes('task history is temporarily unavailable')`),true);
  await cdp.evaluate(`document.querySelector('nav[aria-label="Workspace navigation"] button[aria-label="Schedule Manager"]').click()`);
  await waitFor(()=>visible('.schedule-module'),'schedule despite task preparation failure');
  await cdp.send('Fetch.disable');cdp.listeners=cdp.listeners.filter(listener=>listener!==intercept);
  report.partialFailureKeepsSectionsUsable=true;
  // Real NextAuth sign-out, then re-enter through the protected route.
  await cdp.evaluate(`(async()=>{const {csrfToken}=await(await fetch('/api/auth/csrf')).json();await fetch('/api/auth/signout',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({csrfToken,json:'true'})});})()`);
  await cdp.send('Page.navigate',{url:origin+'/studashboard/productivity-layer'});
  await waitFor(()=>cdp.evaluate(`location.pathname==='/login'`),'protected route after logout');
  assert.equal(await visible('.today-module'),false);report.logoutProtectsWorkspace=true;
  const filename=path.join('.local-development',`productivity-performance-${report.label}.json`);fs.writeFileSync(filename,JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
 }finally{if(cdp)cdp.socket.close();for(const process of [edge,app])if(process?.pid)spawnSync('taskkill.exe',['/PID',String(process.pid),'/T','/F'],{windowsHide:true,stdio:'ignore'});if(user)await db.user.deleteMany({where:{id:user.id}});await db.$disconnect();fs.writeFileSync(path.join('.local-development',`perf-${report.label}.server.log`),logs);
  // Delete only this run's verified temporary browser profile after Edge stops.
  const privateRoot=path.resolve('.local-development');
  if(browserDir&&path.resolve(browserDir).startsWith(privateRoot+path.sep)&&path.basename(browserDir).startsWith('edge-perf-'))try{fs.rmSync(browserDir,{recursive:true,force:true,maxRetries:3,retryDelay:100});}catch{/* A locked profile remains private and ignored. */}
 }
}
main().catch(error=>{console.error(error);process.exitCode=1;});
