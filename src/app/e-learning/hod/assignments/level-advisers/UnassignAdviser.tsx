"use client";
import { unassignLevelAdvisorAction } from "./actions";
import SubmitButton from "@/app/e-learning/_components/SubmitButton";
export default function UnassignAdviser({ assignmentId, facultyUserId, facultyName, sessionId, programmeFilter, levelFilter }: { assignmentId: string; facultyUserId: string; facultyName: string; sessionId: string; programmeFilter: string; levelFilter: string }) {
 return <form action={unassignLevelAdvisorAction} onSubmit={event => { if (!window.confirm(`Unassign ${facultyName} as Level Adviser? Their lecturer account and course assignments will remain unchanged.`)) event.preventDefault(); }} className="mt-3">
  <input type="hidden" name="assignmentId" value={assignmentId}/><input type="hidden" name="expectedFacultyUserId" value={facultyUserId}/><input type="hidden" name="session" value={sessionId}/><input type="hidden" name="fProgramme" value={programmeFilter}/><input type="hidden" name="fLevel" value={levelFilter}/>
  <SubmitButton className="rounded-lg border border-red-300 bg-white px-4 py-2 text-sm font-semibold text-red-800 hover:bg-red-50">Unassign Adviser</SubmitButton>
 </form>;
}
