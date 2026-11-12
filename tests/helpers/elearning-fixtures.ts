// tests/helpers/elearning-fixtures.ts
//
// A minimal, self-contained E-Learning world in the local test database: one programme, one course offered this
// semester with an assigned lecturer, and one student with an APPROVED registration for it. Everything is uniquely
// named per call, and tests pass the academic context explicitly instead of depending on "the current session".

import { randomUUID } from "node:crypto";
import { elearningDb } from "@/lib/db/elearning";
import type { CurrentAcademicContext } from "@/services/e-learning/shared/academic-calendar";

const uid = () => randomUUID().slice(0, 8);

export async function courseScenario() {
  const tag = uid();
  const session = await elearningDb.academicSession.create({ data: { name: `T-${tag}` } });
  const semester = await elearningDb.semester.create({
    data: { academicSessionId: session.id, name: "First", sequence: 1, startDate: new Date("2026-09-07T00:00:00Z"), endDate: new Date("2026-12-18T00:00:00Z") },
  });
  const college = await elearningDb.college.create({ data: { name: `College ${tag}`, code: `C${tag}` } });
  const department = await elearningDb.department.create({ data: { collegeId: college.id, name: `Dept ${tag}`, code: `D${tag}` } });
  const programme = await elearningDb.programme.create({ data: { departmentId: department.id, name: `Programme ${tag}`, code: `P${tag}` } });
  const course = await elearningDb.course.create({ data: { code: `TST ${tag}`, title: "Test Course", creditUnits: 3 } });
  const curriculum = await elearningDb.curriculum.create({
    data: { programmeId: programme.id, academicSessionId: session.id, semesterId: semester.id, name: `Cur ${tag}`, status: "PUBLISHED", createdByUserId: "test" },
  });
  const curriculumCourse = await elearningDb.curriculumCourse.create({ data: { curriculumId: curriculum.id, courseId: course.id, level: 100, creditUnits: 3 } });
  const offering = await elearningDb.courseOffering.create({ data: { curriculumCourseId: curriculumCourse.id } });

  const lecturerId = `lec-${tag}`;
  const otherLecturerId = `lec-other-${tag}`;
  await elearningDb.facultyProfile.create({ data: { userId: lecturerId, departmentId: department.id } });
  await elearningDb.facultyProfile.create({ data: { userId: otherLecturerId, departmentId: department.id } });
  await elearningDb.courseOfferingLecturer.create({ data: { courseOfferingId: offering.id, facultyUserId: lecturerId, role: "COORDINATOR" } });

  const makeStudent = async (registered: "APPROVED" | "PENDING_HOD" | null) => {
    const userId = `stu-${uid()}`;
    await elearningDb.studentProfile.create({ data: { userId, departmentId: department.id, programmeId: programme.id, level: 100, admissionSessionId: session.id } });
    if (registered) {
      await elearningDb.courseRegistration.create({
        data: { studentUserId: userId, academicSessionId: session.id, semesterId: semester.id, status: registered, items: { create: [{ courseId: course.id }] } },
      });
    }
    return userId;
  };

  return {
    ctx: { session, semester } as CurrentAcademicContext,
    course,
    offering,
    lecturerId,
    otherLecturerId,
    studentId: await makeStudent("APPROVED"),
    makeStudent,
  };
}
