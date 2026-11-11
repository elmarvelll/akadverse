// services/e-learning/student/stewart/rate-limit.ts
//
// A small per-student sliding-window limit on Stewart requests, to stop a runaway client (or a script) from turning
// one account into unbounded model spend. In-memory, so it is per server instance — a first line of defence, not a
// billing control; see the "Outstanding issues" section of the changelog.

import { tooManyRequests } from "@/lib/service-error";

const hits = new Map<string, number[]>();

export function enforceRateLimit(key: string, { limit, windowMs }: { limit: number; windowMs: number }, now: number = Date.now()) {
  const recent = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
  if (recent.length >= limit) {
    hits.set(key, recent);
    throw tooManyRequests("You're sending requests to Stewart very quickly. Please wait a moment and try again.");
  }
  recent.push(now);
  hits.set(key, recent);
  if (hits.size > 5000) {
    for (const [k, times] of hits) if (times.every((t) => now - t >= windowMs)) hits.delete(k);
  }
}
