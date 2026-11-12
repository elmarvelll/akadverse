# Decision: DAPU's "Send timetable to HODs" is the same event as approving it

- **Date**: 2026-09-14.
- **Context**: §28 describes Review → Approve → Send to HODs as three DAPU steps, after which the timetable "become[s] available to relevant faculty/students according to their academic scope."
- **Problem**: No distribution/notification artifact is described — nothing says a HOD is notified, or that a separate "sent" flag gates anything beyond "approved."
- **Chosen option**: `TimetableEntry.isApproved` is the only gate. `services/e-learning/faculty/timetable.ts#getFacultyTimetable` reads `isApproved: true` directly — the moment DAPU approves an entry (`/e-learning/dapu/timetable/approve`), it's visible on the relevant faculty's dashboard. `/e-learning/dapu/timetable/send-to-hods` lists what's already approved, as confirmation, not as a further action.
- **Reason**: Same reasoning as [`course-structure-is-catalog-management.md`](course-structure-is-catalog-management.md) — inventing a second boolean (`sentToHods`) with no described trigger, recipient list, or effect beyond "visible" would just be modeling the same fact twice.
- **Consequences**: There is no per-HOD "seen it" or notification record. If a real notification requirement is specified later (an email to each department's HOD when their courses' timetable entries are approved), it hooks onto the existing `approveTimetableEntry` function rather than needing a new state on `TimetableEntry`.
- **Alternatives rejected**: A separate `sentToHods` boolean set by a distinct DAPU action — not built, no described difference in what it would gate versus `isApproved`.
