/** Read-only post-reset role workflow checks; no synthetic live registrations/approvals. */
import assert from "node:assert/strict";
import { writeFileSync } from "node:fs";
import { elearningDb as db } from "../../src/lib/db/elearning";
import { getCurrentAcademicContext } from "../../services/e-learning/shared/academic-calendar";
import { getRegistrationView } from "../../services/e-learning/student/registration";
import { getStudyCourses } from "../../services/e-learning/student/study-zone";
import { getMySubjects } from "../../services/e-learning/faculty/my-subjects";
import { getPendingApprovals } from "../../services/e-learning/level-adviser/registrations";
import { listCurriculaForHod } from "../../services/e-learning/hod/curriculum-review";
import { listStructuresForReview } from "../../services/e-learning/dapu/curriculum/list-structures-for-review";
import { getStructureView } from "../../services/e-learning/dapu/curriculum/get-structure-view";
async function main() {
 const ctx=await getCurrentAcademicContext();assert.ok(ctx?.session && ctx.semester);
 const students=await db.studentProfile.findMany();
 const groups=new Map(students.map(p=>[`${p.programmeId}/${p.level}`,p]));
 for(const student of groups.values()) { const view=await getRegistrationView(student,ctx);assert.equal(view.state,"NO_CURRICULUM");assert.equal((await getStudyCourses(student.userId,ctx)).length,0); }
 const faculty=await db.facultyProfile.findMany();
 for(const lecturer of faculty) {assert.equal((await getMySubjects(lecturer.userId,ctx)).length,0);if(lecturer.isLevelAdviser)assert.equal((await getPendingApprovals(lecturer,ctx)).length,0);}
 for(const hod of await db.hodProfile.findMany())assert.equal((await listCurriculaForHod(hod)).structures.length,0);
 assert.equal((await listStructuresForReview()).length,0);
 const programmes=await db.programme.findMany({include:{department:true,ccmasProgramme:{include:{discipline:{include:{document:true}}}}}});
 for(const programme of programmes) {
  assert.equal(programme.department.code,"EIENG");assert.equal(programme.ccmasProgramme?.code,programme.code);assert.equal(programme.ccmasProgramme?.discipline.document.version,"2023");
  const view=await getStructureView({collegeId:programme.department.collegeId,departmentId:programme.departmentId,programmeId:programme.id,level:300,academicSessionId:ctx.session.id,semesterId:ctx.semester.id});
  assert.ok(view.ccmasCourses.length>0);assert.equal(view.selected.length,0);assert.ok(view.ccmasCourses.every(c=>c.level===300));
 }
 assert.equal(await db.classroomSession.count({where:{status:"LIVE"}}),0);
 assert.equal(await db.courseMaterial.count(),0);
 assert.equal(await db.aiIngestTask.count({where:{operation:"DELETE",state:{not:"DONE"}}}),0);
 const report={verifiedAt:new Date().toISOString(),studentsPreserved:students.length,studentProgrammeLevelCases:groups.size,facultyPreserved:faculty.length,programmes:programmes.map(p=>p.code),registration:"No old registrations or selectable old curricula",studyZone:"No old registered courses",lecturer:"No old subjects",hod:"No pending old curricula",dapu:"Clean structures and new 2023 reference available",hierarchy:"EEE/CPE/ICE remain under EIENG",liveClasses:0,materials:0,pendingAiDeletion:0};
 const file=`.elearning-reset/role-verification-${Date.now()}.json`;writeFileSync(file,JSON.stringify(report,null,2),{mode:0o600,flag:"wx"});console.log(JSON.stringify(report));console.log(file);
}
main().catch(e=>{console.error(e instanceof Error?e.message:"Role verification failed");process.exitCode=1}).finally(()=>db.$disconnect());
