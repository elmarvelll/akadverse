// src/app/e-learning/student/classroom/[sessionId]/page.tsx
//
// A student's live room. Access (an APPROVED registration for the class's course) is checked here before anything
// renders; the token route and every action re-check it independently.

import { requireElearningRole } from "@/services/e-learning/shared/auth";
import { requireClassroomRole } from "@/services/e-learning/classroom/access";
import { loadOffering } from "@/services/e-learning/shared/course-materials/offering-access";
import StudentRoom from "@/app/e-learning/_components/classroom/StudentRoom";
import { Ended } from "@/app/e-learning/_components/classroom/TeacherRoom";

export default async function StudentClassroomRoomPage({ params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = await params;
  const session = await requireElearningRole(["student"]);
  const { classroom } = await requireClassroomRole({ id: session.user.id, role: "student" }, sessionId);
  const backHref = "/e-learning/student/classroom";
  if (classroom.status !== "LIVE") return <Ended backHref={backHref} message="This class has ended." />;

  const { course } = (await loadOffering(classroom.courseOfferingId)).curriculumCourse;
  return <StudentRoom sessionId={sessionId} courseLabel={`${course.code} · ${course.title}`} backHref={backHref} />;
}
