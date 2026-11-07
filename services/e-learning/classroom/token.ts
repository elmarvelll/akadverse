// services/e-learning/classroom/token.ts
//
// Mints the LiveKit join token. This is the ONLY thing that decides who may publish video:
// the grant is set here, server-side, from the caller's role in this class. A student's
// token can subscribe but not publish (not even data), so "only teachers present" holds
// even against a modified client.
//
// Env (server-only): LIVEKIT_URL (wss://<project>.livekit.cloud), LIVEKIT_API_KEY, LIVEKIT_API_SECRET.

import { AccessToken } from "livekit-server-sdk";
import { ServiceError } from "@/lib/service-error";
import { requireClassroomRole, type ClassroomParticipant } from "@/services/e-learning/classroom/access";
import { resolveIdentity, fullName } from "@/services/e-learning/shared/identity";

export async function createJoinToken(user: ClassroomParticipant, sessionId: string) {
  const { LIVEKIT_URL, LIVEKIT_API_KEY, LIVEKIT_API_SECRET } = process.env;
  if (!LIVEKIT_URL || !LIVEKIT_API_KEY || !LIVEKIT_API_SECRET) {
    throw new ServiceError(503, "Live classes aren't set up on this server yet.");
  }
  const { classroom, role } = await requireClassroomRole(user, sessionId);
  if (classroom.status !== "LIVE") throw new ServiceError(409, "This class has ended.");

  const isTeacher = role === "teacher";
  const at = new AccessToken(LIVEKIT_API_KEY, LIVEKIT_API_SECRET, {
    identity: user.id,
    name: fullName(await resolveIdentity(user.id)),
    ttl: "4h",
  });
  at.addGrant({
    room: sessionId,
    roomJoin: true,
    canSubscribe: true,
    canPublish: isTeacher,
    canPublishData: false,
  });
  return { token: await at.toJwt(), url: LIVEKIT_URL, role };
}
