// Prepare only an explicitly named, loopback *_test database. Never load deployment environment files here.
import { spawnSync } from "node:child_process";
import { PrismaClient } from "@prisma/client";
import { fileURLToPath } from "node:url";
const prismaCli = fileURLToPath(new URL("../node_modules/prisma/build/index.js", import.meta.url));
const url = process.env.TEST_DATABASE_URL;
if (!url) throw new Error("Set TEST_DATABASE_URL to an existing isolated localhost database ending in _test.");
const parsed = new URL(url);
if (!["localhost", "127.0.0.1", "[::1]"].includes(parsed.hostname) || !parsed.pathname.endsWith("_test")) throw new Error("Refusing a non-local or non-test database.");
function run(args, extra = {}) {
  const result = spawnSync(process.execPath, [prismaCli, ...args], { stdio: "inherit", env: { ...process.env, DATABASE_URL: url, DIRECT_URL: url, ...extra } });
  if (result.status !== 0) process.exit(result.status ?? 1);
}
run(["migrate", "deploy"]);
const db = new PrismaClient({ datasourceUrl: url });
try {
  await db.$executeRawUnsafe('CREATE SCHEMA IF NOT EXISTS marketplace');
  // Exact reference migrations grant to this role. It cannot log in; this script never provisions a production role.
  await db.$executeRawUnsafe("DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'marketplace_app') THEN CREATE ROLE marketplace_app NOLOGIN; END IF; END $$;");
} finally { await db.$disconnect(); }
parsed.searchParams.set("schema", "marketplace");
run(["migrate", "deploy", "--schema", "prisma/marketplace-schema/schema.prisma"], { MARKETPLACE_MIGRATION_DATABASE_URL: parsed.toString() });
