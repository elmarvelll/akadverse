// src/app/e-learning/faculty/classroom/[sessionId]/page.tsx
//
// The lecturer's live room. Access (assigned to this class's offering) is checked here before anything renders; the
// token route and every action re-check it independently.

import { requireElearningRole } from "@/services/e-learning/shared/auth";
import { requireClassroomRole } from "@/services/e-learning/classroom/access";
import { loadOffering } from "@/services/e-learning/shared/course-materials/offering-access";
import TeacherRoom, { Ended } from "@/app/e-learning/_components/classroom/TeacherRoom";

export default async function FacultyClassroomRoomPage({ params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = await params;
  const session = await requireElearningRole(["faculty"]);
  const { classroom } = await requireClassroomRole({ id: session.user.id, role: "faculty" }, sessionId);
  const backHref = "/e-learning/faculty/classroom";
  if (classroom.status !== "LIVE") return <Ended backHref={backHref} message="This class has ended." />;

  const { course } = (await loadOffering(classroom.courseOfferingId)).curriculumCourse;
  return <TeacherRoom sessionId={sessionId} courseLabel={`${course.code} · ${course.title}`} backHref={backHref} />;
}
