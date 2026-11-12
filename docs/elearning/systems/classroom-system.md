# Classroom (live class)

A faculty member streams a live class for one of their course offerings; registered students watch, ask questions, and answer a "Do you understand?" check. **MVP: stream + questions only.** Student and Faculty roles only; HOD/DAPU/Dean/VC have no Classroom.

## Who can do what

| | Lecturer (assigned to the offering) | Student (APPROVED registration for the course this session/semester) |
|---|---|---|
| Start / end class | yes | no |
| Present (camera, mic, screen share) | yes | no, enforced by the LiveKit token grant |
| "Do you understand?" poll | start / close, sees Yes/No counts | answers once (can change until closed) |
| Questions | sees who asked, marks Answered/Dismissed | raise hand + type a question (text), "me too" on others' |

Access reuses existing checks: `requireLecturer` (assigned to the offering) and `assertStudentRegistered` (same rule as opening a course document). `services/e-learning/classroom/access.ts` is the single place that resolves a caller's role in a class; ids from the client are routing only.

## How it works

- **Video**: LiveKit (WebRTC). `GET /api/e-learning/classroom/[sessionId]/token` mints a join token whose grant is set server-side from the caller's role: students get `canSubscribe` only (not even `canPublishData`). The room name is the `ClassroomSession.id`. Needs `LIVEKIT_URL`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`.
- **Questions and polls** are our own state in the E-Learning DB (`ClassroomQuestion`, `ClassroomQuestionVote`, `ClassroomPoll`, `ClassroomPollResponse`), not LiveKit data messages, so a refresh or reconnect never loses the queue or an open poll. Clients poll `GET /api/e-learning/classroom/[sessionId]/state` every 3s (paused while the tab is hidden); Vercel can't hold a websocket. Worst-case latency for a poll pop-up is about 3s.
- **One LIVE class per offering.** Starting while one is live rejoins it. A class still LIVE after 12h is treated as abandoned when the next one starts. Ending closes any open poll. It does **not** delete the LiveKit room: a server-side delete tears every connection down mid-session, which livekit-client logs as "data channel closed unexpectedly" errors in every browser. Each client leaves cleanly instead (the lecturer navigates away; students' next state poll sees the class ended and unmounts the room), the token route refuses ended classes, and LiveKit closes the empty room itself.
- Limits: 300-character questions; at most 3 open questions per student.

## Routes

`/e-learning/{faculty,student}/classroom` (list), `/e-learning/{faculty,student}/classroom/[sessionId]` (room). Sidebar entry "Classroom" for both roles (`nav-config.ts`). Services: `services/e-learning/classroom/`. UI: `src/app/e-learning/_components/classroom/`.

## Not in the MVP (deliberately)

- Live translation, recording/transcripts (LiveKit Egress/Agents is the natural path).
- Audio questions (a lecturer-grants-mic flow would use per-participant publish permissions).
- A student-to-lecturer message outside class.
- Attendance, class history/past sessions list, scheduled classes tied to the timetable.
- Student-visible answered questions; answered/dismissed ones simply leave the queue.
