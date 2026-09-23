// src/app/e-learning/dapu/course-structure/page.tsx
//
// DAPU Course Structure — where DAPU decides which courses students offer:
//   pick context -> select CCMAS courses -> Select Elective Course -> Save Courses
//   -> Review Saved Courses (Continue Editing / Publish to HOD).
// Nothing is stored until Save Courses (no draft). Everything shown comes from the database.

import Link from "next/link";
import { requireElearningRole, requireDapuProfile } from "@/services/e-learning/shared/auth";
import { getAcademicTree, listCcmasProgrammes } from "@/services/e-learning/dapu/ccmas-reference";
import { listSessions } from "@/services/e-learning/dapu/academic-calendar";
import { getStructureView } from "@/services/e-learning/dapu/curriculum/get-structure-view";
import { listElectiveCandidates } from "@/services/e-learning/dapu/curriculum/list-elective-candidates";
import { ServiceError } from "@/lib/service-error";
import StructurePicker from "./StructurePicker";
import StructureEditor from "./StructureEditor";
import { linkProgrammeAction, saveCoursesAction } from "./actions";
import SubmitButton from "@/app/e-learning/_components/SubmitButton";

type Params = { college?: string; department?: string; programme?: string; level?: string; session?: string; semester?: string; ok?: string; error?: string };

const card = "rounded-2xl border border-gray-200 bg-white p-4 sm:p-5";
const input = "w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white text-gray-900";
const STATUS_LABEL: Record<string, string> = { SAVED: "Saved", RETURNED: "Returned by HOD", PENDING_HOD: "Pending HOD", APPROVED: "Approved", PUBLISHED: "Published" };

export default async function CourseStructurePage({ searchParams }: { searchParams: Promise<Params> }) {
  await requireElearningRole(["dapu"]).then(requireDapuProfile);
  const q = await searchParams;
  const [tree, sessions] = await Promise.all([getAcademicTree(), listSessions()]);
  const initial = { collegeId: q.college ?? "", departmentId: q.department ?? "", programmeId: q.programme ?? "", level: q.level ?? "", sessionId: q.session ?? "", semesterId: q.semester ?? "" };
  const complete = Object.values(initial).every(Boolean);

  // A tampered URL (mismatched ids) is reported, not trusted.
  let view: Awaited<ReturnType<typeof getStructureView>> | null = null;
  let contextError: string | null = null;
  if (complete) {
    try {
      view = await getStructureView({ collegeId: initial.collegeId, departmentId: initial.departmentId, programmeId: initial.programmeId, level: Number(initial.level), academicSessionId: initial.sessionId, semesterId: initial.semesterId });
    } catch (e) {
      if (!(e instanceof ServiceError)) throw e;
      contextError = e.message;
    }
  }

  const ccmasProgrammes = view && !view.programme.ccmasProgrammeId ? await listCcmasProgrammes() : [];
  const electives = view ? await listElectiveCandidates() : [];
  const context = { college: initial.collegeId, department: initial.departmentId, programme: initial.programmeId, level: initial.level, session: initial.sessionId, semester: initial.semesterId };
  const hidden = Object.entries(context).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />);
  const status = view?.curriculum?.status;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Course Structure</h1>
        <p className="text-sm text-gray-800 mt-1">Choose the academic context, select the courses students will offer, then Save Courses.</p>
      </div>

      {q.ok && <div role="status" className="rounded-xl border border-green-300 bg-green-50 px-4 py-3 text-sm text-green-900">{q.ok}</div>}
      {(q.error || contextError) && <div role="alert" className="rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-900">{q.error ?? contextError}</div>}

      <section className={card}>
        <h2 className="text-sm font-semibold text-gray-900 mb-3">1 · Academic context</h2>
        <StructurePicker tree={tree} sessions={sessions.map((s) => ({ id: s.id, name: s.name, semesters: s.semesters.map((m) => ({ id: m.id, name: m.name, sequence: m.sequence })) }))} initial={initial} />
      </section>

      {!view && !contextError && <div className={`${card} text-center text-sm text-gray-800`}>Select a college, department, programme, level, session and semester to begin.</div>}

      {view && (
        <>
          <section className={`${card} flex flex-wrap items-center justify-between gap-3`}>
            <div>
              <p className="text-base font-bold text-gray-900">{view.programme.name} ({view.programme.code}) · {initial.level} Level</p>
              <p className="text-sm text-gray-900">{view.session.name} · {view.semester.name} · {view.programme.department.name}</p>
            </div>
            <span className="rounded-full bg-blue-100 text-blue-900 px-3 py-1 text-xs font-bold uppercase tracking-wide">{status ? STATUS_LABEL[status] ?? status : "Nothing saved yet"}</span>
          </section>

          {status === "RETURNED" && view.curriculum?.hodNote && (
            <div className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900"><strong>Returned by the HOD:</strong> {view.curriculum.hodNote} — make your changes and Save Courses again.</div>
          )}
          {status === "PUBLISHED" && (
            <div className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950">
              <strong>This structure is published to students.</strong> If you change it and save, it goes back to the HOD for re-approval, students stop seeing it until then, and the {initial.level} Level students&apos; registrations for this semester are cleared so they register again.
            </div>
          )}
          {!view.editable && (
            <div className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              This course structure is <strong>{STATUS_LABEL[status!] ?? status}</strong> and can no longer be changed here.{" "}
              <Link className="underline font-semibold" href={`/e-learning/dapu/course-structure/review?curriculum=${view.curriculum!.id}`}>Open it in Review Saved Courses</Link>
            </div>
          )}

          {!view.programme.ccmasProgrammeId && (
            <section className="rounded-2xl border border-amber-300 bg-amber-50 p-4 sm:p-5 space-y-3">
              <p className="text-sm text-amber-900"><strong>{view.programme.name}</strong> isn&apos;t linked to a CCMAS programme yet, so no CCMAS courses can be shown. Programmes are never matched by name — choose the one that corresponds.</p>
              {ccmasProgrammes.length === 0 ? <p className="text-sm text-amber-900">No CCMAS records have been imported yet.</p> : (
                <form action={linkProgrammeAction} className="flex flex-col sm:flex-row gap-2">
                  {hidden}
                  <select name="ccmasProgrammeId" required className={`${input} flex-1 min-w-0`}>
                    <option value="">Select the CCMAS programme…</option>
                    {ccmasProgrammes.map((c) => <option key={c.id} value={c.id}>{c.name}{c.code ? ` (${c.code})` : ""}</option>)}
                  </select>
                  <SubmitButton className="px-4 py-2 rounded-lg bg-blue-700 text-white text-sm font-semibold hover:bg-blue-800">Link programme</SubmitButton>
                </form>
              )}
            </section>
          )}
          {view.programme.ccmasProgrammeId && <p className="text-xs text-gray-800">CCMAS programme: <strong>{view.programme.ccmasProgramme?.name}</strong>. CCMAS is reference data — selecting a course adds it to <em>your</em> structure only.</p>}
          {/* key: a different context/saved state remounts the editor with fresh initial selections */}
          <StructureEditor
            key={`${initial.programmeId}-${initial.level}-${initial.semesterId}-${view.curriculum?.savedAt?.toISOString() ?? "new"}`}
            courses={view.ccmasCourses}
            electives={electives}
            initialElectiveIds={view.selectedElectiveIds}
            editable={view.editable}
            reopensPublished={status === "PUBLISHED"}
            action={saveCoursesAction}
            context={context}
          />
        </>
      )}
    </div>
  );
}
