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
export const prisma = globalForPrisma.prisma ?? new PrismaClient();

// Only cache the instance on `global` outside of production, since in
// production the module is loaded once per server process anyway.
if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
