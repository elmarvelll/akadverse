// scripts/cleanup-fake-academy-data.ts
//
// Removes the operational test data created by the pre-CCMAS dev seed, so the
// real CCMAS -> Course Structure -> HOD -> Student Registration flow can be
// tested from a clean state. Never touches CCMAS reference data, colleges,
// departments, programmes, sessions, semesters, profiles, time frames, rules,
// or anything created through the real workflow.
//
// "Fake" is derived from relationships, not names:
//   * a curriculum is fake iff it was created by the seed (createdByUserId = "seed");
//   * a Course is fake iff it is used by at least one curriculum and EVERY
//     curriculum using it is fake, and no real (non-seed) curriculum uses it;
//   * anything that only points at fake Courses (legacy registration items,
//     results, assignments, timetable entries, offerings, student registrations)
//     is fake test workflow data.
// A registration that also holds a real course is kept (only its fake items go).
//
// Dry run by default:   npx tsx --env-file=.env scripts/cleanup-fake-academy-data.ts
// Apply:                npx tsx --env-file=.env scripts/cleanup-fake-academy-data.ts --apply

import { elearningDb as db } from "../src/lib/db/elearning";
import { prisma as core } from "../src/lib/prisma";

const apply = process.argv.includes("--apply");

async function snapshot() {
  return {
    ccmasDocuments: await db.cCMASDocument.count(),
    ccmasProgrammes: await db.cCMASProgramme.count(),
    ccmasCourses: await db.cCMASCourse.count(),
    ccmasProgrammeCourses: await db.cCMASProgrammeCourse.count(),
    colleges: await db.college.count(),
    departments: await db.department.count(),
    programmes: await db.programme.count(),
    sessions: await db.academicSession.count(),
    semesters: await db.semester.count(),
    studentProfiles: await db.studentProfile.count(),
    academicRules: await db.academicRule.count(),
    timeFrames: await db.academicTimeFrame.count(),
  };
}

async function main() {
  const before = await snapshot();

  const fakeCurricula = await db.curriculum.findMany({ where: { createdByUserId: "seed" }, select: { id: true } });
  const fakeCurriculumIds = fakeCurricula.map((c) => c.id);

  // Courses used ONLY by fake curricula.
  const candidates = await db.course.findMany({
    where: { curriculumCourses: { some: { curriculumId: { in: fakeCurriculumIds } } } },
    select: { id: true, code: true, title: true, curriculumCourses: { select: { curriculumId: true } } },
  });
  const fakeCourses = candidates.filter((c) => c.curriculumCourses.every((cc) => fakeCurriculumIds.includes(cc.curriculumId)));
  const keptShared = candidates.filter((c) => !fakeCourses.includes(c));
  const fakeCourseIds = fakeCourses.map((c) => c.id);

  const [results, items, assignments, timetable, resources, syllabi, offerings] = await Promise.all([
    db.result.findMany({ where: { courseId: { in: fakeCourseIds } }, select: { id: true } }),
    db.courseRegistrationItem.findMany({ where: { courseId: { in: fakeCourseIds } }, select: { id: true, courseRegistrationId: true } }),
    db.courseAssignment.findMany({ where: { courseId: { in: fakeCourseIds } }, select: { id: true } }),
    db.timetableEntry.findMany({ where: { courseId: { in: fakeCourseIds } }, select: { id: true } }),
    db.learningResource.findMany({ where: { courseId: { in: fakeCourseIds } }, select: { id: true } }),
    db.syllabus.findMany({ where: { courseId: { in: fakeCourseIds } }, select: { id: true } }),
    db.courseOffering.findMany({ where: { curriculumCourse: { curriculumId: { in: fakeCurriculumIds } } }, select: { id: true } }),
  ]);
  const offeringIds = offerings.map((o) => o.id);

  // Legacy registrations: delete the whole registration only if it holds nothing but fake items.
  const regIds = [...new Set(items.map((i) => i.courseRegistrationId))];
  const regsWithReal = await db.courseRegistrationItem.findMany({
    where: { courseRegistrationId: { in: regIds }, courseId: { notIn: fakeCourseIds } },
    select: { courseRegistrationId: true },
  });
  const keepRegIds = new Set(regsWithReal.map((r) => r.courseRegistrationId));
  const deleteRegIds = regIds.filter((id) => !keepRegIds.has(id));

  // Notifications that point at a course structure that no longer exists.
  const notifs = await core.notification.findMany({ where: { scope: "ELEARNING" }, select: { id: true, link: true, type: true } });
  const orphanNotifIds: string[] = [];
  for (const n of notifs) {
    const m = n.link?.match(/\/hod\/curriculum\/([^/?]+)/);
    if (m && !(await db.curriculum.findUnique({ where: { id: m[1] }, select: { id: true } }))) orphanNotifIds.push(n.id);
  }

  const plan = {
    curricula: fakeCurriculumIds.length,
    courses: fakeCourses.map((c) => `${c.code} "${c.title}"`),
    courseKeptBecauseShared: keptShared.map((c) => c.code),
    results: results.length,
    legacyRegistrationItems: items.length,
    legacyRegistrations: deleteRegIds.length,
    courseAssignments: assignments.length,
    timetableEntries: timetable.length,
    learningResources: resources.length,
    syllabi: syllabi.length,
    courseOfferings: offeringIds.length,
    studentCourseRegistrations: await db.studentCourseRegistration.count({ where: { courseOfferingId: { in: offeringIds } } }),
    orphanNotifications: orphanNotifIds.length,
  };
  console.log(apply ? "APPLYING cleanup plan:" : "DRY RUN — cleanup plan:", JSON.stringify(plan, null, 2));
  if (!apply) return;

  // Children first, in one transaction: partial cleanup can't happen.
  await db.$transaction([
    db.studentCourseRegistration.deleteMany({ where: { courseOfferingId: { in: offeringIds } } }),
    db.courseOfferingLecturer.deleteMany({ where: { courseOfferingId: { in: offeringIds } } }),
    db.courseOfferingDay.deleteMany({ where: { courseOfferingId: { in: offeringIds } } }),
    db.courseOffering.deleteMany({ where: { id: { in: offeringIds } } }),
    db.result.deleteMany({ where: { courseId: { in: fakeCourseIds } } }),
    db.courseRegistrationItem.deleteMany({ where: { courseId: { in: fakeCourseIds } } }),
    db.courseRegistration.deleteMany({ where: { id: { in: deleteRegIds } } }),
    db.courseAssignment.deleteMany({ where: { courseId: { in: fakeCourseIds } } }),
    db.timetableEntry.deleteMany({ where: { courseId: { in: fakeCourseIds } } }),
    db.learningResource.deleteMany({ where: { courseId: { in: fakeCourseIds } } }),
    db.syllabus.deleteMany({ where: { courseId: { in: fakeCourseIds } } }),
    db.curriculum.deleteMany({ where: { id: { in: fakeCurriculumIds } } }), // CurriculumCourse cascades
    db.course.deleteMany({ where: { id: { in: fakeCourseIds } } }),
  ]);
  if (orphanNotifIds.length) await core.notification.deleteMany({ where: { id: { in: orphanNotifIds } } });

  const after = await snapshot();
  const untouched = Object.keys(before).every((k) => before[k as keyof typeof before] === after[k as keyof typeof after]);
  console.log("Preserved-record counts before → after:", before, "→", after);
  console.log(untouched ? "OK: CCMAS, academic structure, profiles, rules and time frames unchanged." : "WARNING: a preserved count changed!");
  if (!untouched) process.exit(1);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await db.$disconnect(); });
