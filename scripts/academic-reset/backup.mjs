// Read-only custom-format backups of both affected public schemas. No live restore.
import { spawn } from 'node:child_process';
import { mkdirSync, openSync, closeSync, readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
const dir=`.elearning-reset/owner-backup-${Date.now()}`;mkdirSync(dir,{recursive:true,mode:0o700});const backups=[];
for(const [database,variable] of [['core','DIRECT_URL'],['academic','ELEARNING_DIRECT_URL']]){
 const u=new URL(process.env[variable]);const file=`${dir}/${database}.dump`;const fd=openSync(file,'wx',0o600);
 const env={...process.env,PGHOST:u.hostname,PGPORT:u.port||'5432',PGUSER:decodeURIComponent(u.username),PGPASSWORD:decodeURIComponent(u.password),PGDATABASE:u.pathname.slice(1),PGSSLMODE:'require',PGCONNECT_TIMEOUT:'20'};
 try{const child=spawn('docker',['run','--rm','-i',...['PGHOST','PGPORT','PGUSER','PGPASSWORD','PGDATABASE','PGSSLMODE','PGCONNECT_TIMEOUT'].flatMap(k=>['--env',k]),'postgres:17','pg_dump','-Fc','--schema=public'],{env,stdio:['ignore',fd,'pipe']});let error='';child.stderr.on('data',b=>error+=b.toString());const status=await new Promise((resolve,reject)=>{child.on('error',reject);child.on('exit',resolve)});if(status!==0)throw new Error(`${database} backup failed (${status}); no deletion may proceed`);}finally{closeSync(fd)}
 backups.push({database,file,sha256:createHash('sha256').update(readFileSync(file)).digest('hex')});console.log(`${database} backup complete`);
}
writeFileSync(`${dir}/manifest.json`,JSON.stringify({createdAt:new Date().toISOString(),backups,restoreVerified:false},null,2),{mode:0o600,flag:'wx'});console.log(`${dir}/manifest.json`);
