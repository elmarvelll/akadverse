import { spawnSync } from 'node:child_process';
import { readFileSync,writeFileSync } from 'node:fs';
import {createHash,randomUUID} from 'node:crypto';
const manifestPath=process.argv[2],auditPath=process.argv[3];if(!manifestPath||!auditPath)throw new Error('Provide manifest and owner audit');
const manifest=JSON.parse(readFileSync(manifestPath,'utf8')),audit=JSON.parse(readFileSync(auditPath,'utf8'));const results=[];
const docker=(args,input)=>{const r=spawnSync('docker',args,{input,maxBuffer:32*1024*1024});if(r.status!==0)throw new Error(String(r.stderr).slice(-1500));return String(r.stdout)};
for(const backup of manifest.backups){
 const bytes=readFileSync(backup.file);if(createHash('sha256').update(bytes).digest('hex')!==backup.sha256)throw new Error('Backup checksum mismatch');
 const name=`akadverse-owner-restore-${randomUUID().slice(0,8)}`;let started=false;
 try{
 docker(['run','--rm','--network=none','-d','--name',name,'-e','POSTGRES_PASSWORD=local_restore_only','-e','POSTGRES_DB=restore','postgres:17']);started=true;
 let ready=false;for(let i=0;i<30;i++){if(spawnSync('docker',['exec',name,'pg_isready','-U','postgres','-d','restore']).status===0){ready=true;break}await new Promise(r=>setTimeout(r,1000))}if(!ready)throw new Error('Restore server not ready');
 docker(['exec','-i',name,'pg_restore','-U','postgres','-d','restore','--clean','--if-exists','--no-owner','--no-privileges','--exit-on-error'],bytes);
 const query=sql=>docker(['exec',name,'psql','-U','postgres','-d','restore','-Atc',sql]).trim();
 if(backup.database==='core'){
 const ids=JSON.parse(query('SELECT json_agg(id ORDER BY id) FROM "User"'));
 const expected=[...audit.keep,...audit.remove].map(u=>u.id).sort();if(JSON.stringify(ids)!==JSON.stringify(expected))throw new Error('Core backup account set differs from audit');
 results.push({database:'core',accountCount:ids.length,restored:true});
 }else{
 const ids=audit.eee400Structures.map(s=>"'"+s.id.replaceAll("'","''")+"'").join(',');
 const rows=JSON.parse(query(`SELECT json_agg(json_build_object('id',cc.id,'code',c.code,'title',c.title,'description',c.description,'creditUnits',cc."creditUnits",'courseCreditUnits',c."creditUnit",'level',cc.level,'curriculumId',cc."curriculumId",'semesterId',cu."semesterId",'status',cu.status) ORDER BY cc.id) FROM "CurriculumCourse" cc JOIN "Course" c ON c.id=cc."courseId" JOIN "Curriculum" cu ON cu.id=cc."curriculumId" WHERE cu.id IN (${ids}) AND cc.level=400`));
 const expected=audit.eee400Structures.flatMap(s=>s.courses.filter(c=>c.level===400).map(c=>({id:c.id,code:c.course.code,title:c.course.title,description:c.course.description,creditUnits:c.creditUnits,courseCreditUnits:c.course.creditUnits,level:c.level,curriculumId:c.curriculumId,semesterId:s.semesterId,status:s.status}))).sort((a,b)=>a.id.localeCompare(b.id));
 if(JSON.stringify(rows)!==JSON.stringify(expected))throw new Error('Restored EEE 400 course data differs from preservation audit');results.push({database:'academic',preserved400Courses:rows.length,restored:true});
 }
 }finally{if(started)docker(['stop',name])}
}
writeFileSync(manifestPath,JSON.stringify({...manifest,restoreVerified:true,verifiedAt:new Date().toISOString(),auditPath,restoreResults:results},null,2),{mode:0o600});console.log(JSON.stringify(results));
