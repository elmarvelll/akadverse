// for_Developers/seed/e-learning.ts
//
// E-Learning development data, layered ON TOP of the project's existing seed chain (run first by index.ts):
//   npm run db:ccmas:import    -> NUC/CCMAS reference data (from the committed JSON)
//   npm run db:elearning:seed  -> colleges, departments, programmes (EEE/CPE/ICE), current session + semesters
//
// This file adds what a developer needs to click through every role's workflow immediately — the same rows the
// real DAPU -> HOD -> Level Adviser -> student workflow would produce:
//   - role profiles (Student/Faculty/HOD/DAPU) for the dev accounts
//   - a PUBLISHED EEE course structure (300 Level, current semester) built from real CCMAS EEE courses
//   - course offerings with lecturers (coordinator + lecturer) and teaching days
//   - a Level Adviser assignment (EEE, 300 Level, current session)
//   - three course registrations: APPROVED (My Courses), PENDING_LEVEL_ADVISOR, PENDING_HOD
//
// Deliberately NOT seeded:
//   - registration periods (AcademicTimeFrame): the existing seed's rule is that only DAPU creates them. Open one
//     from the DAPU portal (Timeframes) to test course registration as a student.
//   - course materials: their files live in Supabase Storage; a row without a real file would be a broken link.
//   - results, timetables: produced by the faculty/HOD/DAPU workflows themselves.
//
// Idempotent: everything is upserted on natural unique keys or stable ids (ids.ts). If a row it needs is already
// held by someone else (e.g. you created your own structure in the UI), that part is skipped with a warning rather
// than overwriting your data.

import type { PrismaClient as ElearningClient } from "../../src/generated/prisma-elearning";
import type { SeededUsers } from "./users";
import { devId } from "./ids";

// Real CCMAS EEE 300-level courses (src/lib/resources/ccmas/Engineering-CCMAS.json). The first REGISTERED_COUNT make
// up each seeded student's registration (17 units — inside the 15–24 AcademicRule the existing seed creates).
const COURSE_CODES = ["GET 301", "GET 305", "GET 307", "EEE 311", "EEE 321", "EEE 322", "GST 312", "EEE 324", "EEE 326"];
const REGISTERED_COUNT = 7;
const LEVEL = 300;

export async function seedElearning(db: ElearningClient, users: SeededUsers) {
  const session = await db.academicSession.findFirst({ where: { isCurrent: true } });
  const semester = session ? await db.semester.findFirst({ where: { academicSessionId: session.id, isCurrent: true } }) : null;
  const department = await db.department.findUnique({ where: { code: "EIENG" } });
  const programme = await db.programme.findUnique({ where: { code: "EEE" } });
  if (!session || !semester || !department || !programme?.ccmasProgrammeId) {
    throw new Error("E-Learning catalog missing — `npm run db:elearning:seed` (run by index.ts) must succeed first.");
  }

  // ---- Profiles ------------------------------------------------------------------------------
  const studentProfiles: { key: keyof SeededUsers; level: number; matric: string }[] = [
    { key: "student", level: LEVEL, matric: "DEV/EEE/0001" },
    { key: "studentPendingAdviser", level: LEVEL, matric: "DEV/EEE/0002" },
    { key: "studentPendingHod", level: LEVEL, matric: "DEV/EEE/0003" },
    // Marketplace-focused student accounts get a profile too (at 200 Level, outside the adviser's queue) so the
    // E-Learning card on their dashboard works instead of hitting "no student profile".
    { key: "buyer", level: 200, matric: "DEV/EEE/0101" },
    { key: "plugOwner", level: 200, matric: "DEV/EEE/0102" },
    { key: "vendorOwner", level: 200, matric: "DEV/EEE/0103" },
    { key: "deliverer", level: 200, matric: "DEV/EEE/0104" },
    { key: "admin", level: 200, matric: "DEV/EEE/0105" },
  ];
  for (const p of studentProfiles) {
    const data = { departmentId: department.id, programmeId: programme.id, level: p.level, matricNumber: p.matric, admissionSessionId: session.id };
    await db.studentProfile.upsert({ where: { userId: users[p.key].id }, update: data, create: { userId: users[p.key].id, ...data } });
  }

  const facultyIds = { faculty: users.faculty.id, adviser: users.adviser.id };
  for (const [key, userId] of Object.entries(facultyIds)) {
    const staffId = key === "faculty" ? "DEV-STAFF-001" : "DEV-STAFF-002";
    await db.facultyProfile.upsert({ where: { userId }, update: { departmentId: department.id, staffId }, create: { userId, departmentId: department.id, staffId } });
  }

  const hodHolder = await db.hodProfile.findUnique({ where: { departmentId: department.id } });
  if (hodHolder && hodHolder.userId !== users.hod.id) {
    console.warn(`  ! ${department.name} already has a HOD in this database — hod.demo was not attached to it.`);
  } else {
    await db.hodProfile.upsert({ where: { userId: users.hod.id }, update: { departmentId: department.id }, create: { userId: users.hod.id, departmentId: department.id } });
  }
  await db.dapuProfile.upsert({ where: { userId: users.dapu.id }, update: {}, create: { userId: users.dapu.id } });
  console.log(`  ✔ profiles: ${studentProfiles.length} students, 2 faculty, HOD (${department.code}), DAPU`);

  // ---- Published course structure ------------------------------------------------------------
  const curriculumId = devId(`curriculum:${programme.code}:${session.name}:${semester.sequence}`);
  const ours = await db.curriculum.findUnique({ where: { id: curriculumId } });
  const other = ours ? null : await db.curriculum.findFirst({ where: { programmeId: programme.id, academicSessionId: session.id, semesterId: semester.id } });
  if (other) {
    console.warn(`  ! A ${programme.code} course structure for ${session.name} ${semester.name} already exists — skipped seeding courses, offerings and registrations.`);
    return;
  }
  const now = new Date();
  const curriculum = await db.curriculum.upsert({
    where: { id: curriculumId },
    update: { status: "PUBLISHED" },
    create: {
      id: curriculumId,
      programmeId: programme.id,
      academicSessionId: session.id,
      semesterId: semester.id,
      name: `${programme.name} — ${session.name} ${semester.name}`,
      version: 1,
      status: "PUBLISHED",
      createdByUserId: users.dapu.id,
      savedAt: now,
      passedToHodAt: now,
      approvedByUserId: users.hod.id,
      approvedAt: now,
      publishedAt: now,
    },
  });

  const ccmasRows = await db.cCMASProgrammeCourse.findMany({
    where: { programmeId: programme.ccmasProgrammeId, level: LEVEL, course: { code: { in: COURSE_CODES } } },
    include: { course: true },
  });
  const byCode = new Map(ccmasRows.map((r) => [r.course.code, r]));
  const missing = COURSE_CODES.filter((c) => !byCode.has(c));
  if (missing.length) throw new Error(`CCMAS EEE ${LEVEL}-level courses not found: ${missing.join(", ")} — re-run \`npm run db:ccmas:import\`.`);

  const courseIds: string[] = [];
  for (const [index, code] of COURSE_CODES.entries()) {
    const row = byCode.get(code)!;
    // Same shape services/e-learning/dapu/curriculum/save-course-selection.ts creates from a CCMAS row.
    const course = await db.course.upsert({
      where: { code },
      update: {},
      create: { code, title: row.titleAsListed, creditUnits: row.creditUnits, description: row.description },
    });
    courseIds.push(course.id);
    const courseType = row.statusLetter === "E" ? "ELECTIVE" : row.statusLetter === "O" ? "OPTIONAL" : "CORE";
    const curriculumCourse = await db.curriculumCourse.upsert({
      where: { curriculumId_courseId: { curriculumId: curriculum.id, courseId: course.id } },
      update: { level: LEVEL, creditUnits: row.creditUnits, courseType, source: "CCMAS", ccmasProgrammeCourseId: row.id },
      create: { curriculumId: curriculum.id, courseId: course.id, level: LEVEL, creditUnits: row.creditUnits, courseType, source: "CCMAS", ccmasProgrammeCourseId: row.id, createdByUserId: users.dapu.id },
    });

    // Offering + lecturers (the HOD's "assign lecturers" step): faculty.demo coordinates every course;
    // adviser.demo also lectures the first three.
    const offering = await db.courseOffering.upsert({ where: { curriculumCourseId: curriculumCourse.id }, update: {}, create: { curriculumCourseId: curriculumCourse.id } });
    const lecturers: { facultyUserId: string; role: "COORDINATOR" | "LECTURER" }[] = [{ facultyUserId: users.faculty.id, role: "COORDINATOR" }];
    if (index < 3) lecturers.push({ facultyUserId: users.adviser.id, role: "LECTURER" });
    for (const l of lecturers) {
      await db.courseOfferingLecturer.upsert({
        where: { courseOfferingId_facultyUserId: { courseOfferingId: offering.id, facultyUserId: l.facultyUserId } },
        update: { role: l.role },
        create: { courseOfferingId: offering.id, ...l },
      });
    }
    for (const dayOfWeek of index % 2 === 0 ? (["MONDAY", "WEDNESDAY"] as const) : (["TUESDAY", "THURSDAY"] as const)) {
      await db.courseOfferingDay.upsert({ where: { courseOfferingId_dayOfWeek: { courseOfferingId: offering.id, dayOfWeek } }, update: {}, create: { courseOfferingId: offering.id, dayOfWeek } });
    }
  }
  console.log(`  ✔ published ${programme.code} ${LEVEL}-level course structure (${COURSE_CODES.length} courses) with offerings + lecturers`);

  // ---- Level Adviser (EEE, 300 Level, current session) -----------------------------------------
  const existingAssignment = await db.levelAdvisorAssignment.findUnique({
    where: { programmeId_level_academicSessionId: { programmeId: programme.id, level: LEVEL, academicSessionId: session.id } },
  });
  if (existingAssignment && existingAssignment.facultyUserId !== users.adviser.id) {
    console.warn(`  ! ${programme.code} ${LEVEL} Level already has a Level Adviser in this database — adviser.demo was not assigned.`);
  } else {
    const assignment =
      existingAssignment ??
      (await db.levelAdvisorAssignment.create({
        data: { facultyUserId: users.adviser.id, programmeId: programme.id, level: LEVEL, academicSessionId: session.id, createdByUserId: users.hod.id },
      }));
    // Kept in step exactly like services/e-learning/hod/level-advisors.ts does (a DB CHECK requires both together).
    await db.facultyProfile.update({ where: { userId: users.adviser.id }, data: { isLevelAdviser: true, levelAdvisorId: assignment.id, levelAdviserOf: LEVEL } });
    console.log(`  ✔ adviser.demo is Level Adviser for ${programme.code} ${LEVEL} Level`);
  }

  // ---- Course registrations ------------------------------------------------------------------
  const registered = courseIds.slice(0, REGISTERED_COUNT);
  const registrations = [
    { key: "student" as const, status: "APPROVED" as const },
    { key: "studentPendingAdviser" as const, status: "PENDING_LEVEL_ADVISOR" as const },
    { key: "studentPendingHod" as const, status: "PENDING_HOD" as const },
  ];
  for (const r of registrations) {
    const data = { status: r.status, submittedAt: now, decidedAt: r.status === "APPROVED" ? now : null, decisionNote: null };
    const registration = await db.courseRegistration.upsert({
      where: { studentUserId_academicSessionId_semesterId: { studentUserId: users[r.key].id, academicSessionId: session.id, semesterId: semester.id } },
      update: data,
      create: { studentUserId: users[r.key].id, academicSessionId: session.id, semesterId: semester.id, ...data },
    });
    for (const courseId of registered) {
      await db.courseRegistrationItem.upsert({
        where: { courseRegistrationId_courseId: { courseRegistrationId: registration.id, courseId } },
        update: {},
        create: { courseRegistrationId: registration.id, courseId },
      });
    }
  }
  console.log("  ✔ course registrations: student (APPROVED), student2 (PENDING_LEVEL_ADVISOR), student3 (PENDING_HOD)");
}
