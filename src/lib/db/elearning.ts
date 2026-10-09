// src/lib/db/elearning.ts
//
// E-Learning Prisma Client singleton — the ONLY place E-Learning code
// should import a PrismaClient from. Backed by ELEARNING_DATABASE_URL, a
// separate Postgres database from the Marketplace one (src/lib/prisma.ts /
// DATABASE_URL) — see prisma/elearning/schema.prisma's header comment for
// why.
//
// Deliberately loads "@/generated/prisma-elearning" (the custom generator
// output configured in that schema), not "@prisma/client" — the latter is
// the Marketplace client. Mixing the two up would silently point E-Learning
// queries at the wrong database's generated types.
//
// WHY IT'S LOADED WITH A NATIVE require INSTEAD OF A STATIC import: the
// Marketplace client lives in node_modules, so Next treats it as a server
// external (`@prisma/client` is on Next's built-in serverExternalPackages
// list) and Node loads it at runtime. This client's output is under src/, so
// a static import made Turbopack BUNDLE it — and statically analysing the
// generated index.js/runtime (their `path.join(process.cwd(), <dynamic>)`
// engine lookup and dotenv's `fs.existsSync(<dynamic>)`) traced the whole
// repository into every function that touched E-Learning. Loading it
// natively here gives it the same treatment as the Marketplace client: it
// runs from its real directory, and the files it needs at runtime are
// traced explicitly via next.config.ts's outputFileTracingIncludes (keep
// that list in sync if this path changes). The path is resolved from
// process.cwd() — the project root under `next build`/`next start`, on
// Vercel, and for the `tsx` scripts run via npm — which is the same
// assumption the generated client itself already makes when bundled.
// Only types come from a static import, so every caller's types are
// unchanged.
//
// Same hot-reload-safe singleton pattern as src/lib/prisma.ts: stash the
// instance on globalThis outside production so Next.js dev's module
// reloads reuse one client/connection pool instead of leaking a new one on
// every save.

import { createRequire } from "node:module";
import path from "node:path";
import type * as ElearningClient from "@/generated/prisma-elearning";

const requireFromProjectRoot = createRequire(path.join(process.cwd(), "package.json"));
const { PrismaClient } = requireFromProjectRoot(
  /* turbopackIgnore: true */ "./src/generated/prisma-elearning",
) as typeof ElearningClient;

const globalForElearningPrisma = globalThis as unknown as {
  elearningPrisma: ElearningClient.PrismaClient | undefined;
};

export const elearningDb = globalForElearningPrisma.elearningPrisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForElearningPrisma.elearningPrisma = elearningDb;
}
