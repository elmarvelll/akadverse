// src/lib/prisma.ts
//
// Prisma Client singleton.
//
// Why this exists: in Next.js dev mode, files are hot-reloaded on every save.
// If we did `export const prisma = new PrismaClient()` directly, every reload
// would create a brand new PrismaClient (and a brand new pool of DB
// connections) without closing the old ones, eventually exhausting MySQL's
// max_connections. To avoid that, we stash a single instance on the Node.js
// global object and reuse it across reloads. In production this file is only
// evaluated once anyway, so the global stashing is a no-op there.

import { PrismaClient } from "@prisma/client";

// Extend the NodeJS global type so TypeScript knows about our custom
// `prismaGlobal` property (globalThis is otherwise untyped for this).
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

// Reuse the existing client if one was already created on a previous
// hot-reload; otherwise create a fresh one.
export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient(
    // Temporary diagnostic, gated behind an env var so it's zero-cost by
    // default: with DB_TIMING_DEBUG=1, logs each query's engine-reported
    // execution duration (e.duration) — time actually spent running
    // against Postgres, which is distinct from and excludes time spent
    // queueing for a free connection out of DATABASE_URL's
    // connection_limit pool. Compare this against the wall-clock timing
    // logged around a specific await (e.g.
    // src/app/api/marketplace/notifications/stream/route.ts's poll) to
    // see how much of any slow request was pool contention versus the
    // query itself. Safe to remove once pool sizing is confirmed correct
    // — see docs/marketplace/decisions/notification-poll-connection-safety.md.
    process.env.DB_TIMING_DEBUG === "1" ? { log: [{ emit: "event", level: "query" }] } : undefined
  );

if (process.env.DB_TIMING_DEBUG === "1") {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (prisma as any).$on("query", (e: { query: string; duration: number }) => {
    console.log(`[db-timing] ${e.duration}ms :: ${e.query.slice(0, 120)}`);
  });
}

// Only cache the instance on `global` outside of production, since in
// production the module is loaded once per server process anyway.
if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
