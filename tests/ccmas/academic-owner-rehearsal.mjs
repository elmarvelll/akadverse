// Rehearse on a new loopback-only container restored from the verified academic backup.
import {spawnSync} from 'node:child_process';import{readFileSync,writeFileSync,mkdirSync}from'node:fs';import{randomUUID}from'node:crypto';
const manifest=JSON.parse(readFileSync(process.argv[2],'utf8'));const auditPath=process.argv[3];if(!manifest.restoreVerified)throw new Error('Verified backup required');
const name=`akadverse-academic-rehearsal-${randomUUID().slice(0,8)}`,folder=`.elearning-reset/academic-owner-rehearsal-${Date.now()}`;mkdirSync(folder,{mode:0o700});const localAudit=`${folder}/audit.json`;writeFileSync(localAudit,readFileSync(auditPath),{mode:0o600});
const docker=(args,input)=>{const r=spawnSync('docker',args,{input,maxBuffer:16*1024*1024});if(r.status!==0)throw new Error(String(r.stderr));return String(r.stdout)};let started=false;
try{
 docker(['run','--rm','-d','--name',name,'-p','127.0.0.1::5432','-e','POSTGRES_PASSWORD=local_restore_only','-e','POSTGRES_DB=restore','postgres:17']);started=true;
 let ready=false;for(let i=0;i<30;i++){if(spawnSync('docker',['exec',name,'pg_isready','-U','postgres','-d','restore']).status===0){ready=true;break}await new Promise(r=>setTimeout(r,1000))}if(!ready)throw new Error('Local server not ready');
 docker(['exec','-i',name,'pg_restore','-U','postgres','-d','restore','--clean','--if-exists','--no-owner','--no-privileges','--exit-on-error'],readFileSync(manifest.backups.find(b=>b.database==='academic').file));
 const mapping=docker(['port',name,'5432/tcp']).trim();if(!/^127\.0\.0\.1:\d+$/.test(mapping))throw new Error('Refusing non-loopback target');
 const url=`postgresql://postgres:local_restore_only@${mapping}/restore`;const env={...process.env,DATABASE_URL:url,DIRECT_URL:url,ELEARNING_DATABASE_URL:url,ELEARNING_DIRECT_URL:url};
 const args=['--import','tsx','scripts/academic-reset/reset-academic.ts',localAudit,'--execute','--backup',process.argv[2]];
 const first=spawnSync('node',args,{env,encoding:'utf8'});if(first.status!==0)throw new Error(first.stderr);console.log(first.stdout);
 const repeat=spawnSync('node',args,{env,encoding:'utf8'});if(repeat.status!==1||!repeat.stderr.includes('execution receipt'))throw new Error('Repeat execution was not refused');
 console.log(`PASS: real seven-course preservation snapshot survived assignment reset; repeat execution refused. ${folder}`);
}finally{if(started)docker(['stop',name])}
