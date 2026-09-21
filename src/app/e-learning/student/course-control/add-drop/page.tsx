// src/app/e-learning/student/course-control/add-drop/page.tsx
//
// Add/Drop (AGENTS.md §15) — modifying an already-APPROVED registration,
// only within the separate Change of Course timeframe (checked server-side
// by the same actions the Course Registration page uses).

import CourseMeta from "@/app/e-learning/_components/CourseMeta";
import { requireElearningRole, requireStudentProfile } from "@/services/e-learning/shared/auth";
import { getCurrentAcademicContext } from "@/services/e-learning/shared/academic-calendar";
import { findRegistration, getEligibleCourses } from "@/services/e-learning/student/registration";
import { isTimeFrameOpen } from "@/services/e-learning/shared/timeframes";
import { addCourseAction, removeCourseAction } from "../actions";
import SubmitButton from "@/app/e-learning/_components/SubmitButton";

export default async function AddDropPage() {
  const session = await requireElearningRole(["student"]);
  const profile = await requireStudentProfile(session);
  const academicContext = await getCurrentAcademicContext();

  if (!academicContext?.session || !academicContext.semester) {
    return <p className="text-sm text-gray-500">No current academic session/semester is set yet.</p>;
  }

  const registration = await findRegistration(session.user.id, academicContext);

  if (!registration || registration.status !== "APPROVED") {
    return (
      <div className="rounded-2xl border border-gray-100 bg-white p-8 text-center text-sm text-gray-500">
        Add/Drop is only available once your registration for this semester has been approved (currently{" "}
        <strong>{registration ? registration.status.replaceAll("_", " ") : "not registered yet"}</strong>).
      </div>
    );
  }

  const changeWindowOpen = await isTimeFrameOpen("CHANGE_OF_COURSE", academicContext.session.id, academicContext.semester.id);
  const addedCourseIds = registration.items.map((item) => item.courseId);
  const eligibleCourses = await getEligibleCourses(profile, academicContext, addedCourseIds);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Add / Drop Course</h1>
        <p className="text-gray-500 text-sm mt-1">
          {academicContext.session.name} · {academicContext.semester.name}
        </p>
      </div>

      {!changeWindowOpen && (
        <div className="rounded-2xl border border-amber-100 bg-amber-50 p-4 text-sm text-amber-800">
          The change-of-course window isn&apos;t open right now — you can review your current courses below, but
          adding or dropping is disabled until DAPU opens it.
        </div>
      )}

      <div className="rounded-2xl border border-gray-100 bg-white p-5">
        <h2 className="text-sm font-semibold text-gray-900 mb-3">Your Approved Courses</h2>
        {registration.items.length === 0 ? (
          <p className="text-sm text-gray-400">No courses on your registration.</p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {registration.items.map((item) => (
              <li key={item.id} className="py-2.5 flex flex-wrap items-center justify-between gap-3">
                <span className="text-sm text-gray-800">
                  <span className="font-medium">{item.course.code}</span> — {item.course.title} <CourseMeta level={profile.level} units={item.course.creditUnits} />
                </span>
                <form action={removeCourseAction}>
                  <input type="hidden" name="from" value="add-drop" />
                  <input type="hidden" name="itemId" value={item.id} />
                  <SubmitButton
                   
                    disabled={!changeWindowOpen}
                    className="text-xs font-medium text-red-600 hover:underline disabled:opacity-40 disabled:no-underline"
                  >
                    Drop
                  </SubmitButton>
                </form>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="rounded-2xl border border-gray-100 bg-white p-5">
        <h2 className="text-sm font-semibold text-gray-900 mb-3">Add a Course</h2>
        {eligibleCourses.length === 0 ? (
          <p className="text-sm text-gray-400">No more courses available to add.</p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {eligibleCourses.map((course) => (
              <li key={course.id} className="py-2.5 flex flex-wrap items-center justify-between gap-3">
                <span className="text-sm text-gray-800">
                  <span className="font-medium">{course.code}</span> — {course.title} <CourseMeta level={profile.level} units={course.creditUnits} type={course.courseType} />
                </span>
                <form action={addCourseAction}>
                  <input type="hidden" name="from" value="add-drop" />
                  <input type="hidden" name="courseId" value={course.id} />
                  <SubmitButton
                   
                    disabled={!changeWindowOpen}
                    className="text-xs font-medium text-blue-600 hover:underline disabled:opacity-40 disabled:no-underline"
                  >
                    Add
                  </SubmitButton>
                </form>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
