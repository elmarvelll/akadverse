import "../helpers/env";
import { it } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { elearningDb as db } from "@/lib/db/elearning";
import { courseScenario } from "../helpers/elearning-fixtures";
import { getSignupOptions, resolveAcademicSelection, createStudentProfile } from "@/services/e-learning/student/signup-academics";
import { assignOrChangeLevelAdvisor, unassignLevelAdvisor } from "@/services/e-learning/hod/level-advisors";
async function currentSession(){return await db.academicSession.findFirst({where:{isCurrent:true}}) ?? db.academicSession.create({data:{name:`Current-${randomUUID()}`,isCurrent:true}});}
it("400-level onboarding validates and persists the level without inherited registrations",async()=>{
 const college=await db.college.upsert({where:{code:"CoE"},update:{},create:{code:"CoE",name:"College of Engineering"}});
 const department=await db.department.upsert({where:{code:"EIENG"},update:{},create:{code:"EIENG",name:"Electrical and Information Engineering",collegeId:college.id}});
 const programme=await db.programme.upsert({where:{code:"EEE"},update:{},create:{code:"EEE",name:"Electrical and Electronics Engineering",departmentId:department.id}});
 await currentSession();const selection={collegeId:college.id,departmentId:department.id,programmeId:programme.id,level:400};
 assert.ok((await getSignupOptions()).levels.some(l=>l.value===400));assert.equal((await resolveAcademicSelection(selection)).level,400);
 const tag=randomUUID();const p=await createStudentProfile(`signup-${tag}`,selection,`400-${tag.slice(0,8)}`);
 assert.equal((await db.studentProfile.findUniqueOrThrow({where:{id:p.id}})).level,400);assert.equal(await db.courseRegistration.count({where:{studentUserId:p.userId}}),0);
 await assert.rejects(resolveAcademicSelection({...selection,level:500}),/level/);
});
it("unassign checks HOD scope and stale confirmation while preserving lecturer and course roles",async()=>{
 const f=await courseScenario();const faculty=await db.facultyProfile.findUniqueOrThrow({where:{userId:f.lecturerId}});
 const programme=(await db.studentProfile.findUniqueOrThrow({where:{userId:f.studentId}})).programmeId!;const session=await currentSession();
 const hod=await db.hodProfile.create({data:{userId:`hod-${randomUUID()}`,departmentId:faculty.departmentId}});
 const core=new PrismaClient();
 try {
 const account=await core.user.create({data:{id:f.lecturerId,email:`${randomUUID()}@test.invalid`,firstName:"Test",lastName:"Lecturer",role:"faculty",password:"preserved-local-fixture-hash"}});
 const a=await assignOrChangeLevelAdvisor(hod,{programmeId:programme,level:400,academicSessionId:session.id,facultyUserId:f.lecturerId});
 assert.equal((await db.facultyProfile.findUniqueOrThrow({where:{userId:f.lecturerId}})).isLevelAdviser,true);
 await assert.rejects(unassignLevelAdvisor({...hod,departmentId:"other-department"},a.assignmentId,f.lecturerId),/department/);
 await assert.rejects(unassignLevelAdvisor(hod,a.assignmentId,f.otherLecturerId),/changed/);
 await unassignLevelAdvisor(hod,a.assignmentId,f.lecturerId);
 assert.equal(await db.levelAdvisorAssignment.findUnique({where:{id:a.assignmentId}}),null);
 const after=await db.facultyProfile.findUniqueOrThrow({where:{userId:f.lecturerId}});assert.equal(after.isLevelAdviser,false);assert.equal(after.levelAdvisorId,null);
 assert.equal(await db.courseOfferingLecturer.count({where:{courseOfferingId:f.offering.id,facultyUserId:f.lecturerId}}),1);
 const preserved=await core.user.findUniqueOrThrow({where:{id:account.id}});assert.equal(preserved.role,"faculty");assert.equal(preserved.password,account.password);
 } finally {await core.$disconnect();}
});
