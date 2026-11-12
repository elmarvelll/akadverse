// services/e-learning/classroom/state.ts
//
// One snapshot of everything a class page needs besides the video itself: whether it's still
// live, the question queue, and the current "Do you understand?" poll. Clients poll this every
// few seconds (Vercel can't hold a websocket open), so it stays cheap: three small queries.
// The shape differs by role: the lecturer sees who asked and the poll tallies; a student sees
// anonymous questions, vote counts, and only their own poll answer.

import { elearningDb } from "@/lib/db/elearning";
import { requireClassroomRole, type ClassroomParticipant } from "@/services/e-learning/classroom/access";
import { resolveIdentities, fullName } from "@/services/e-learning/shared/identity";

export interface ClassroomQuestionView {
  id: string;
  body: string;
  votes: number;
  mine: boolean;
  votedByMe: boolean;
  // Teacher view only.
  askedBy?: string;
  createdAt: string;
}

export interface ClassroomPollView {
  id: string;
  open: boolean;
  // Student view.
  myAnswer?: "YES" | "NO" | null;
  // Teacher view.
  yes?: number;
  no?: number;
}

export interface ClassroomState {
  live: boolean;
  questions: ClassroomQuestionView[];
  poll: ClassroomPollView | null;
}

export async function getClassroomState(user: ClassroomParticipant, sessionId: string): Promise<ClassroomState> {
  const { classroom, role } = await requireClassroomRole(user, sessionId);
  if (classroom.status !== "LIVE") return { live: false, questions: [], poll: null };

  const [questions, poll] = await Promise.all([
    elearningDb.classroomQuestion.findMany({
      where: { sessionId, status: "OPEN" },
      include: { votes: { select: { studentUserId: true } } },
      orderBy: { createdAt: "asc" },
    }),
    elearningDb.classroomPoll.findFirst({
      // The lecturer keeps seeing the latest result after closing it; students only ever see an open one.
      where: { sessionId, ...(role === "student" ? { status: "OPEN" as const } : {}) },
      include: { responses: { select: { studentUserId: true, answer: true } } },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const names = role === "teacher" ? await resolveIdentities(questions.map((q) => q.studentUserId)) : null;

  return {
    live: true,
    questions: questions
      .map((q) => ({
        id: q.id,
        body: q.body,
        votes: q.votes.length,
        mine: q.studentUserId === user.id,
        votedByMe: q.votes.some((v) => v.studentUserId === user.id),
        ...(names ? { askedBy: fullName(names.get(q.studentUserId)) } : {}),
        createdAt: q.createdAt.toISOString(),
      }))
      // Most "me too"s first so the lecturer tackles what the class is stuck on; ties keep arrival order.
      .sort((a, b) => b.votes - a.votes || a.createdAt.localeCompare(b.createdAt)),
    poll: poll
      ? {
          id: poll.id,
          open: poll.status === "OPEN",
          ...(role === "student"
            ? { myAnswer: poll.responses.find((r) => r.studentUserId === user.id)?.answer ?? null }
            : { yes: poll.responses.filter((r) => r.answer === "YES").length, no: poll.responses.filter((r) => r.answer === "NO").length }),
        }
      : null,
  };
}
