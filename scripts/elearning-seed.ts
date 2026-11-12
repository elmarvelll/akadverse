// scripts/elearning-seed.ts
//
// Dev-only convenience: seeds enough E-Learning catalog data (faculty/
// department/programme, and a current academic session+semester — no courses and no registration
// period; those come from the real DAPU workflow) for the
// Student pages to actually show something instead of every empty state.
//
// Run with: npm run db:elearning:seed
//
// If a marvelousifezue31@stu.cu.edu.ng / @faculty.cu.edu.ng account
// already exists in the Core database (see AGENTS.md §7 and
// src/app/api/register/route.ts's DEV_TEST_LOCAL_PART), this also wires up
// a StudentProfile/FacultyProfile for it so you can sign in and see real
// data immediately. If those accounts don't exist yet, it just seeds the
// catalog and prints what to sign up as.
//
// Not part of the app's runtime — reads the Core database only to resolve
// those two accounts' ids (the same "genuine identity lookup" exception as
// services/e-learning/shared/identity.ts), never imported from application code.

import { prisma as coreDb } from "../src/lib/prisma";
import { elearningDb } from "../src/lib/db/elearning";

async function main() {
  // ---- Colleges (spec §6) — the database is the source of truth. -------------
  const collegeSeeds = [
    { code: "CoE", name: "College of Engineering" },
    { code: "CMSS", name: "College of Management and Social Sciences" },
    { code: "CLDS", name: "College of Leadership and Development Studies" },
    { code: "CST", name: "College of Science and Technology" },
  ];
  // Pre-Academy seed data used code "ENG"/"Engineering" — migrate that row in
  // place (keeps its departments' foreign keys) instead of orphaning it.
  const legacyCollege = await elearningDb.college.findUnique({ where: { code: "ENG" } });
  if (legacyCollege) {
    await elearningDb.college.update({ where: { id: legacyCollege.id }, data: { code: "CoE", name: "College of Engineering" } });
  }
  const colleges: Record<string, { id: string; name: string }> = {};
  for (const c of collegeSeeds) {
    colleges[c.code] = await elearningDb.college.upsert({ where: { code: c.code }, update: { name: c.name }, create: c });
  }

  // ---- Departments: only the College of Engineering's known ones (spec §7).
  // Codes are internal labels (the spec supplies names only); they are kept
  // distinct from programme codes on purpose (spec §10).
  const departmentSeeds = [
    { code: "EIENG", name: "Electrical and Information Engineering" },
    { code: "CVENG", name: "Civil Engineering" },
    { code: "MENG", name: "Mechanical Engineering" },
    { code: "PENG", name: "Petroleum Engineering" },
    { code: "CHENG", name: "Chemical Engineering" },
  ];
  const legacyDepartment = await elearningDb.department.findUnique({ where: { code: "EEE" } });
  if (legacyDepartment) {
    await elearningDb.department.update({
      where: { id: legacyDepartment.id },
      data: { code: "EIENG", name: "Electrical and Information Engineering" },
    });
  }
  const departments: Record<string, { id: string; name: string }> = {};
  for (const d of departmentSeeds) {
    departments[d.code] = await elearningDb.department.upsert({
      where: { code: d.code },
      update: { name: d.name, collegeId: colleges.CoE.id },
      create: { ...d, collegeId: colleges.CoE.id },
    });
  }
  const department = departments.EIENG;

  // ---- Programmes: the three real operational ones (spec §9). Nothing is
  // invented for the other departments/colleges.
  // Operational programmes are defined by their CCMAS programme, chosen explicitly by CCMAS
  // *code* (an identifier from the document, never a name match — spec §65). The programme's
  // code AND name are then copied verbatim from the CCMAS database, so this file contains no
  // programme names, and the code shown in the UI is the NUC/CCMAS code.
  // Requires the CCMAS import to have run: `npm run db:ccmas:import`.
  // `legacyCode` only lets a database seeded with the earlier informal codes be migrated in place.
  const programmeLinks = [
    { code: "EEE", legacyCode: "EEE-BENG", ccmasCode: "EEE" },
    { code: "CPE", legacyCode: "EIE", ccmasCode: "CPE" },
    { code: "ICE", legacyCode: "CEN", ccmasCode: "ICE" },
  ];
  const programmes: Record<string, { id: string; name: string }> = {};
  for (const link of programmeLinks) {
    const ccmas = await elearningDb.cCMASProgramme.findFirst({
      where: { code: link.ccmasCode },
      orderBy: { discipline: { document: { importedAt: "desc" } } },
    });
    if (!ccmas) throw new Error(`CCMAS programme with code ${link.ccmasCode} not found — run \`npm run db:ccmas:import\` first.`);
    const old = await elearningDb.programme.findUnique({ where: { code: link.legacyCode } });
    if (old && !(await elearningDb.programme.findUnique({ where: { code: link.code } }))) {
      await elearningDb.programme.update({ where: { id: old.id }, data: { code: link.code } });
    }
    programmes[link.code] = await elearningDb.programme.upsert({
      where: { code: link.code },
      update: { name: ccmas.name, departmentId: department.id, ccmasProgrammeId: ccmas.id },
      create: { code: link.code, name: ccmas.name, departmentId: department.id, ccmasProgrammeId: ccmas.id },
    });
  }
  const programmeSeeds = programmeLinks;
  const programme = programmes.EEE;

  const now = new Date();
  const sessionStart = new Date(now.getFullYear(), 8, 1); // Sept 1
  const sessionEnd = new Date(now.getFullYear() + 1, 6, 31); // next July 31
  const sessionName = `${sessionStart.getFullYear()}/${sessionEnd.getFullYear()}`;

  const academicSession = await elearningDb.academicSession.upsert({
    where: { name: sessionName },
    update: { isCurrent: true },
    create: { name: sessionName, isCurrent: true },
  });
  // Only one session should be current — clear any others (see the
  // model's comment on why this is an app-layer rule, not a DB constraint).
  await elearningDb.academicSession.updateMany({
    where: { id: { not: academicSession.id } },
    data: { isCurrent: false },
  });

  // Semester names are data (spec §18); Alpha is current for dev testing.
  const semester = await elearningDb.semester.upsert({
    where: { academicSessionId_sequence: { academicSessionId: academicSession.id, sequence: 1 } },
    update: { name: "Alpha", isCurrent: true },
    create: {
      academicSessionId: academicSession.id,
      name: "Alpha",
      sequence: 1,
      startDate: sessionStart,
      endDate: new Date(sessionStart.getFullYear() + 1, 0, 31),
      isCurrent: true,
    },
  });
  await elearningDb.semester.upsert({
    where: { academicSessionId_sequence: { academicSessionId: academicSession.id, sequence: 2 } },
    update: { name: "Omega", isCurrent: false },
    create: {
      academicSessionId: academicSession.id,
      name: "Omega",
      sequence: 2,
      startDate: new Date(sessionStart.getFullYear() + 1, 1, 15),
      endDate: sessionEnd,
      isCurrent: false,
    },
  });
  await elearningDb.semester.updateMany({
    where: { id: { not: semester.id } },
    data: { isCurrent: false },
  });

  // No courses or curricula are seeded: operational courses come only from the real
  // workflow (DAPU Course Structure, from CCMAS + DAPU-added courses).
  // 15–24 units per semester — the range stated by NUC CCMAS (Engineering,
  // "Graduation Requirements" item 3); DAPU can change it per programme/level.
  await elearningDb.academicRule.upsert({
    where: { programmeId_level_semesterId: { programmeId: programme.id, level: 300, semesterId: semester.id } },
    update: {},
    create: { programmeId: programme.id, level: 300, semesterId: semester.id, minCreditUnits: 15, maxCreditUnits: 24 },
  });

  // Registration periods are NOT seeded: DAPU owns them (start AND end), and a seed must never create
  // or overwrite one. Students see "Course registration is not currently available" until DAPU sets it.

  console.log(`Seeded: ${colleges.CoE.name} / ${department.name} / ${programmeSeeds.map((x) => x.code).join(", ")}, session ${sessionName} (Alpha/Omega). No courses or registration period seeded.`);

  // Wire up the dev test account's profiles, if they exist yet.
  const studentUser = await coreDb.user.findUnique({ where: { email: "marvelousifezue31@stu.cu.edu.ng" } });
  if (studentUser) {
    await elearningDb.studentProfile.upsert({
      where: { userId: studentUser.id },
      update: {},
      create: {
        userId: studentUser.id,
        departmentId: department.id,
        programmeId: programme.id,
        level: 300,
        admissionSessionId: academicSession.id,
      },
    });
    console.log("Linked StudentProfile for marvelousifezue31@stu.cu.edu.ng (300 Level, EEE).");
  } else {
    console.log("No marvelousifezue31@stu.cu.edu.ng account yet — sign up with local part \"marvelousifezue31\" and account type Student, then re-run this script.");
  }

  const hodUser = await coreDb.user.findUnique({ where: { email: "marvelousifezue31@hodeie.cu.stu.ng" } });
  if (hodUser) {
    await elearningDb.hodProfile.upsert({
      where: { userId: hodUser.id },
      update: {},
      create: { userId: hodUser.id, departmentId: department.id },
    });
    console.log("Linked HodProfile for marvelousifezue31@hodeie.cu.stu.ng (HOD of EEE).");
  } else {
    console.log('No marvelousifezue31@hodeie.cu.stu.ng account yet — sign up with local part "marvelousifezue31" and account type HOD to test that role too.');
  }

  const dapuUser = await coreDb.user.findUnique({ where: { email: "marvelousifezue31@dapu.cu.edu.ng" } });
  if (dapuUser) {
    await elearningDb.dapuProfile.upsert({ where: { userId: dapuUser.id }, update: {}, create: { userId: dapuUser.id } });
    console.log("Linked DapuProfile for marvelousifezue31@dapu.cu.edu.ng.");
  } else {
    console.log('No marvelousifezue31@dapu.cu.edu.ng account yet — sign up with local part "marvelousifezue31" and account type DAPU to test that role too.');
  }

  const facultyUser = await coreDb.user.findUnique({ where: { email: "marvelousifezue31@faculty.cu.edu.ng" } });
  if (facultyUser) {
    await elearningDb.facultyProfile.upsert({
      where: { userId: facultyUser.id },
      update: {},
      create: { userId: facultyUser.id, departmentId: department.id },
    });
    console.log("Linked FacultyProfile for marvelousifezue31@faculty.cu.edu.ng.");
  } else {
    console.log("No marvelousifezue31@faculty.cu.edu.ng account yet — sign up with local part \"marvelousifezue31\" and account type Faculty to test that role too.");
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await elearningDb.$disconnect();
    await coreDb.$disconnect();
  });
