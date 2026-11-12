"use server";

// src/app/e-learning/_components/classroom/actions.ts
//
// Server Actions for the live class. Like the other E-Learning actions they RETURN errors instead of throwing
// (thrown errors are masked in production), re-derive the session every time, and treat the sessionId/questionId from
// the client as routing only: the service layer re-checks the caller really teaches / is registered for this class.

import { requireElearningRole } from "@/services/e-learning/shared/auth";
import { startClass, endClass } from "@/services/e-learning/classroom/sessions";
import { askQuestion, toggleVote, resolveQuestion } from "@/services/e-learning/classroom/questions";
import { startPoll, closePoll, respondToPoll } from "@/services/e-learning/classroom/polls";
import { ServiceError } from "@/lib/service-error";

type Result<T = object> = ({ ok: true } & T) | { ok: false; error: string };

async function guard<T extends object>(role: "faculty" | "student", fn: (userId: string) => Promise<T | void>): Promise<Result<T>> {
  try {
    const session = await requireElearningRole([role]);
    return { ok: true, ...((await fn(session.user.id)) ?? {}) } as Result<T>;
  } catch (e) {
    if (e instanceof ServiceError) return { ok: false, error: e.message };
    console.error("[classroom]", e);
    return { ok: false, error: "Something went wrong. Please try again." };
  }
}

export async function startClassAction(offeringId: string) {
  return guard("faculty", async (id) => ({ sessionId: (await startClass(id, offeringId)).id }));
}
export async function endClassAction(sessionId: string) {
  return guard("faculty", (id) => endClass(id, sessionId));
}
export async function startPollAction(sessionId: string) {
  return guard("faculty", (id) => startPoll(id, sessionId));
}
export async function closePollAction(sessionId: string, pollId: string) {
  return guard("faculty", (id) => closePoll(id, sessionId, pollId));
}
export async function resolveQuestionAction(sessionId: string, questionId: string, status: "ANSWERED" | "DISMISSED") {
  return guard("faculty", (id) => resolveQuestion(id, sessionId, questionId, status));
}

export async function askQuestionAction(sessionId: string, body: string) {
  return guard("student", (id) => askQuestion(id, sessionId, body));
}
export async function toggleVoteAction(sessionId: string, questionId: string) {
  return guard("student", (id) => toggleVote(id, sessionId, questionId));
}
export async function respondToPollAction(sessionId: string, pollId: string, answer: "YES" | "NO") {
  return guard("student", (id) => respondToPoll(id, sessionId, pollId, answer));
}
