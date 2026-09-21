// src/app/e-learning/faculty/results/[courseId]/page.tsx
//
// Result entry grid for one assigned course (AGENTS.md §19): Test 1,
// Test 2, Exam, Full CA per student, with the computed total/grade shown
// live from the last save, then a single "Submit Results" that moves every
// DRAFT row to SUBMITTED (AGENTS.md §32).

import { notFound as notFoundPage } from "next/navigation";
import { requireElearningRole } from "@/services/e-learning/shared/auth";
import { getCurrentAcademicContext } from "@/services/e-learning/shared/academic-calendar";
import { assertAssignedToCourse } from "@/services/e-learning/faculty/assigned-courses";
import { getStudentsForCourse } from "@/services/e-learning/faculty/students";
import { ensureResultRows, getResultsForCourse } from "@/services/e-learning/faculty/results";
import { elearningDb } from "@/lib/db/elearning";
import { updateResultAction, submitResultsAction } from "./actions";
import SubmitButton from "@/app/e-learning/_components/SubmitButton";

export default async function FacultyResultsEntryPage({ params }: { params: Promise<{ courseId: string }> }) {
  const { courseId } = await params;
  const session = await requireElearningRole(["faculty"]);
  const academicContext = await getCurrentAcademicContext();

  if (!academicContext?.session || !academicContext.semester) {
    return <p className="text-sm text-gray-500">No current academic session/semester is set yet.</p>;
  }

  const course = await elearningDb.course.findUnique({ where: { id: courseId } });
  if (!course) notFoundPage();

  await assertAssignedToCourse(session.user.id, courseId, academicContext.session.id, academicContext.semester.id);
  await ensureResultRows(courseId, academicContext.session.id, academicContext.semester.id, session.user.id);

  const [students, results] = await Promise.all([
    getStudentsForCourse(courseId, academicContext.session.id, academicContext.semester.id),
    getResultsForCourse(courseId, academicContext.session.id, academicContext.semester.id),
  ]);
  const resultByStudent = new Map(results.map((r) => [r.studentUserId, r]));
  const anyDraft = results.some((r) => r.status === "DRAFT");
  const anySubmittedOrLater = results.some((r) => r.status !== "DRAFT");

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-medium text-blue-600 uppercase tracking-wide mb-1">{course!.code}</p>
        <h1 className="text-2xl font-bold text-gray-900">{course!.title} — Results</h1>
      </div>

      {anySubmittedOrLater && !anyDraft && (
        <div className="rounded-2xl border border-blue-100 bg-blue-50 p-4 text-sm text-blue-800">
          All results for this course have been submitted and are no longer editable here.
        </div>
      )}

      {students.length === 0 ? (
        <div className="rounded-2xl border border-gray-100 bg-white p-8 text-center text-sm text-gray-500">
          No approved registrations for this course yet.
        </div>
      ) : (
        <div className="rounded-2xl border border-gray-100 bg-white overflow-x-auto">
          <table className="w-full text-sm min-w-[640px]">
            <thead className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wide">
              <tr>
                <th className="text-left font-medium px-4 py-3">Student</th>
                <th className="text-left font-medium px-4 py-3">Test 1</th>
                <th className="text-left font-medium px-4 py-3">Test 2</th>
                <th className="text-left font-medium px-4 py-3">Exam</th>
                <th className="text-left font-medium px-4 py-3">Full CA override</th>
                <th className="text-left font-medium px-4 py-3">Total / Grade</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {students.map((student) => {
                const result = resultByStudent.get(student.userId);
                const editable = result?.status === "DRAFT";
                return (
                  <tr key={student.userId}>
                    <td className="px-4 py-2.5 text-gray-800">
                      {student.name}
                      <div className="text-xs text-gray-400">{student.matricNumber ?? "—"}</div>
                    </td>
                    <td className="px-2 py-2.5" colSpan={4}>
                      <form action={updateResultAction} className="flex flex-wrap items-center gap-2">
                        <input type="hidden" name="courseId" value={courseId} />
                        <input type="hidden" name="resultId" value={result?.id ?? ""} />
                        <input
                          type="number"
                          name="test1"
                          defaultValue={result?.test1 ?? ""}
                          disabled={!editable}
                          placeholder="Test 1"
                          className="w-20 border border-gray-200 rounded-lg px-2 py-1.5 text-sm disabled:bg-gray-50"
                        />
                        <input
                          type="number"
                          name="test2"
                          defaultValue={result?.test2 ?? ""}
                          disabled={!editable}
                          placeholder="Test 2"
                          className="w-20 border border-gray-200 rounded-lg px-2 py-1.5 text-sm disabled:bg-gray-50"
                        />
                        <input
                          type="number"
                          name="exam"
                          defaultValue={result?.exam ?? ""}
                          disabled={!editable}
                          placeholder="Exam"
                          className="w-20 border border-gray-200 rounded-lg px-2 py-1.5 text-sm disabled:bg-gray-50"
                        />
                        <input
                          type="number"
                          name="fullCAOverride"
                          disabled={!editable}
                          placeholder="Override"
                          className="w-24 border border-gray-200 rounded-lg px-2 py-1.5 text-sm disabled:bg-gray-50"
                        />
                        <SubmitButton
                         
                          disabled={!editable}
                          className="text-xs font-medium text-blue-600 hover:underline disabled:opacity-40 disabled:no-underline"
                        >
                          Save
                        </SubmitButton>
                      </form>
                    </td>
                    <td className="px-4 py-2.5 text-gray-800">
                      {result?.totalScore ?? "—"} {result?.grade ? `(${result.grade})` : ""}
                    </td>
                    <td className="px-4 py-2.5 text-xs text-gray-400">{result?.status}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {anyDraft && (
        <form action={submitResultsAction}>
          <input type="hidden" name="courseId" value={courseId} />
          <SubmitButton
           
            className="px-5 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 transition"
          >
            Submit Results
          </SubmitButton>
        </form>
      )}
    </div>
  );
}
