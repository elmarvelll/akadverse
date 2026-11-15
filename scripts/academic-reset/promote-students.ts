/** Explicit profile-only promotion. Does not change accounts, curricula or assignments. */
import { mkdirSync, writeFileSync } from "node:fs";
import { elearningDb as db } from "../../src/lib/db/elearning";
async function main(){
 const execute=process.argv.includes("--execute");
 const result=await db.$transaction(async tx=>{
  if(execute){await tx.$executeRawUnsafe("SET LOCAL lock_timeout='10s'");await tx.$executeRawUnsafe('LOCK TABLE "StudentProfile" IN SHARE ROW EXCLUSIVE MODE');}
  const before=await tx.studentProfile.findMany({orderBy:{id:"asc"}});const targets=before.filter(p=>p.level===300);
  if(!execute)return {mode:"dry-run",studentsAt300:targets.length,totalStudents:before.length};
  mkdirSync(".elearning-reset",{recursive:true,mode:0o700});const file=`.elearning-reset/student-promotion-${Date.now()}.json`;
  writeFileSync(file,JSON.stringify({createdAt:new Date().toISOString(),operation:"StudentProfile level 300 to 400",before},null,2),{mode:0o600,flag:"wx"});
  const updated=await tx.studentProfile.updateMany({where:{id:{in:targets.map(p=>p.id)},level:300},data:{level:400}});
  if(updated.count!==targets.length)throw new Error("Concurrent student changes; promotion rolled back.");
  const after=await tx.studentProfile.findMany({orderBy:{id:"asc"}});
  if(after.length!==before.length)throw new Error("Profile count changed; rolled back.");
  for(let i=0;i<before.length;i++){
   const {updatedAt:oldTime,level:oldLevel,...oldFields}=before[i];const {updatedAt:newTime,level:newLevel,...newFields}=after[i];
   void oldTime;void newTime;
   if(JSON.stringify(oldFields)!==JSON.stringify(newFields)||newLevel!==(oldLevel===300?400:oldLevel))throw new Error("Unexpected profile change; rolled back.");
  }
  return {updated:updated.count,totalStudents:after.length,remainingAt300:after.filter(p=>p.level===300).length,studentsAt400:after.filter(p=>p.level===400).length,backup:file,accountsDeleted:0};
 },{isolationLevel:"Serializable",timeout:120000});
 console.log(JSON.stringify(result));
 if(execute){writeFileSync(`${(result as {backup:string}).backup}.receipt.json`,JSON.stringify({verifiedAt:new Date().toISOString(),...result},null,2),{mode:0o600,flag:"wx"});}
}
main().catch(e=>{console.error(e instanceof Error?e.message:"Promotion failed");process.exitCode=1}).finally(()=>db.$disconnect());
