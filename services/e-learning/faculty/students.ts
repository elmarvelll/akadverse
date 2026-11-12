// services/e-learning/faculty/students.ts
//
// The roster for one of a faculty member's assigned courses (AGENTS.md
// §18's "View students") — every student whose APPROVED registration for
// the current session/semester includes this course.

import { elearningDb } from "@/lib/db/elearning";
import { resolveIdentities, fullName } from "@/services/e-learning/shared/identity";

export interface RosterStudent {
  userId: string;
  name: string;
  matricNumber: string | null;
  level: number;
}

export async function getStudentsForCourse(courseId: string, academicSessionId: string, semesterId: string): Promise<RosterStudent[]> {
  const items = await elearningDb.courseRegistrationItem.findMany({
    where: {
      courseId,
      courseRegistration: {
        academicSessionId,
        semesterId,
        status: "APPROVED",
      },
    },
    include: { courseRegistration: true },
  });

  const studentUserIds = items.map((item) => item.courseRegistration.studentUserId);
  if (studentUserIds.length === 0) return [];

  const [profiles, identities] = await Promise.all([
    elearningDb.studentProfile.findMany({ where: { userId: { in: studentUserIds } } }),
    resolveIdentities(studentUserIds),
  ]);
  const profileByUserId = new Map(profiles.map((p) => [p.userId, p]));

  return studentUserIds.map((userId) => ({
    userId,
    name: fullName(identities.get(userId)),
    matricNumber: profileByUserId.get(userId)?.matricNumber ?? null,
    level: profileByUserId.get(userId)?.level ?? 0,
  }));
}
