/** Clear assignments/registrations only; preserve all course/catalogue/structure records. */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { createHash } from "node:crypto";
import { elearningDb as db } from "../../src/lib/db/elearning";
const canonical=(value:unknown):unknown=>Array.isArray(value)?value.map(canonical).sort((a,b)=>JSON.stringify(a).localeCompare(JSON.stringify(b))):value && typeof value==="object" && !(value instanceof Date)?Object.fromEntries(Object.entries(value).sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>[k,canonical(v)])):value;
const sha=(value:unknown)=>createHash("sha256").update(JSON.stringify(canonical(value))).digest("hex");
const structureQuery={where:{programme:{code:"EEE"},courses:{some:{level:400}}},include:{programme:{include:{department:true}},semester:true,courses:{include:{course:true,offering:{include:{lecturers:true,materials:true}}}}}} as const;
function structureSnapshot(rows:unknown){return JSON.parse(JSON.stringify(rows, (key,value)=>key==="lecturers"?undefined:value));}
async function main(){
 const auditPath=process.argv[2];if(!auditPath)throw new Error("Provide owner audit path; default mode is dry-run.");
 const audit=JSON.parse(readFileSync(auditPath,"utf8"));if(!audit.eee400Structures?.length)throw new Error("No verified EEE 400 structure to preserve.");
 const expected=sha(structureSnapshot(audit.eee400Structures));
 const receipt=`${auditPath}.academic-execution.json`;
 if(existsSync(receipt))throw new Error("This reset already has an execution receipt. Do not execute it again.");
 const counts={courseAssignment:await db.courseAssignment.count(),courseOfferingLecturer:await db.courseOfferingLecturer.count(),courseRegistration:await db.courseRegistration.count(),courseRegistrationItem:await db.courseRegistrationItem.count(),studentCourseRegistration:await db.studentCourseRegistration.count(),levelAdvisorAssignment:await db.levelAdvisorAssignment.count(),levelAdvisorAssignmentChange:await db.levelAdvisorAssignmentChange.count()};
 if(sha(structureSnapshot(await db.curriculum.findMany(structureQuery)))!==expected)throw new Error("EEE 400 structure changed: refresh preservation audit; nothing deleted.");
 console.log("Proposed academic cleanup:",JSON.stringify(counts),"preserved structure SHA256",expected);
 if(!process.argv.includes("--execute"))return;
 const flag=process.argv.indexOf("--backup");if(flag<0)throw new Error("Verified backup manifest required.");const backup=JSON.parse(readFileSync(process.argv[flag+1],"utf8"));
 if(!backup.restoreVerified)throw new Error("Both backup restore checks must complete first.");
 for(const item of backup.backups)if(createHash("sha256").update(readFileSync(item.file)).digest("hex")!==item.sha256)throw new Error("Backup checksum mismatch.");
 writeFileSync(receipt,JSON.stringify({state:"STARTED",startedAt:new Date().toISOString(),deleted:counts,preservedStructureSha256:expected},null,2),{mode:0o600,flag:"wx"});
 await db.$transaction(async tx=>{
  await tx.$executeRawUnsafe("SET LOCAL lock_timeout='10s'");
  await tx.$executeRawUnsafe('LOCK TABLE "CourseAssignment", "CourseOfferingLecturer", "CourseRegistration", "CourseRegistrationItem", "StudentCourseRegistration", "FacultyProfile", "LevelAdvisorAssignment", "LevelAdvisorAssignmentChange", "Curriculum", "CurriculumCourse", "Course" IN SHARE ROW EXCLUSIVE MODE');
  if(sha(structureSnapshot(await tx.curriculum.findMany(structureQuery)))!==expected)throw new Error("Preserved course structure drifted.");
  await tx.courseRegistrationItem.deleteMany({});await tx.studentCourseRegistration.deleteMany({});await tx.courseRegistration.deleteMany({});
  await tx.courseAssignment.deleteMany({});await tx.courseOfferingLecturer.deleteMany({});
  await tx.facultyProfile.updateMany({data:{levelAdvisorId:null,isLevelAdviser:false,levelAdviserOf:null}});
  await tx.levelAdvisorAssignmentChange.deleteMany({});await tx.levelAdvisorAssignment.deleteMany({});
  if(sha(structureSnapshot(await tx.curriculum.findMany(structureQuery)))!==expected)throw new Error("Course preservation verification failed.");
 },{isolationLevel:"Serializable",timeout:300000});
 const remaining=await Promise.all([db.courseAssignment.count(),db.courseOfferingLecturer.count(),db.courseRegistration.count(),db.courseRegistrationItem.count(),db.studentCourseRegistration.count(),db.levelAdvisorAssignment.count(),db.levelAdvisorAssignmentChange.count(),db.facultyProfile.count({where:{OR:[{isLevelAdviser:true},{levelAdvisorId:{not:null}},{levelAdviserOf:{not:null}}]}})]);
 if(remaining.some(Boolean))throw new Error("New academic activity exists after reset; review concurrent writes.");
 writeFileSync(receipt,JSON.stringify({state:"VERIFIED",verifiedAt:new Date().toISOString(),deleted:counts,preservedStructureSha256:expected,preservedCurriculumIds:audit.eee400Structures.map((s:{id:string})=>s.id),accountsChanged:false},null,2),{mode:0o600});console.log("Academic reset verified; EEE 400 structure unchanged. Account deletion is a separate operation.");
}
main().catch(e=>{console.error(e instanceof Error?e.message:"Reset failed");process.exitCode=1}).finally(()=>db.$disconnect());
