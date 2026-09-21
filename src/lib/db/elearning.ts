// src/lib/db/elearning.ts
//
// E-Learning Prisma Client singleton — the ONLY place E-Learning code
// should import a PrismaClient from. Backed by ELEARNING_DATABASE_URL, a
// separate Postgres database from the Marketplace one (src/lib/prisma.ts /
// DATABASE_URL) — see prisma/elearning/schema.prisma's header comment for
// why.
//
// Deliberately imports from "@/generated/prisma-elearning" (the custom
// generator output configured in that schema), not "@prisma/client" — the
// latter is the Marketplace client. Mixing the two up would silently point
// E-Learning queries at the wrong database's generated types.
//
// Same hot-reload-safe singleton pattern as src/lib/prisma.ts: stash the
// instance on globalThis outside production so Next.js dev's module
// reloads reuse one client/connection pool instead of leaking a new one on
// every save.

import { PrismaClient } from "@/generated/prisma-elearning";

const globalForElearningPrisma = globalThis as unknown as {
  elearningPrisma: PrismaClient | undefined;
};

export const elearningDb = globalForElearningPrisma.elearningPrisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForElearningPrisma.elearningPrisma = elearningDb;
}
