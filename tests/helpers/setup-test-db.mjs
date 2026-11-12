// tests/helpers/setup-test-db.mjs  (npm run test:db:setup)
//
// Applies prisma/migrations to the LOCAL test database (never creates new
// migrations, never touches the database in .env). Requires the local
// Postgres container: npm run db:local:up.

import { spawnSync } from "node:child_process";

const url = process.env.TEST_DATABASE_URL || "postgresql://akadverse:akadverse_local_only@127.0.0.1:5433/akadverse";
const host = new URL(url).hostname;
if (host !== "127.0.0.1" && host !== "localhost") {
  console.error(`Refusing to migrate a non-local database host (${host}).`);
  process.exit(1);
}

// E-Learning lives in its own database with its own schema, deployed with `db push` + constraints.sql (it has no
// migrations folder) — same as for_Developers/scripts/local-db.mjs does for local development.
const elearningUrl = process.env.TEST_ELEARNING_DATABASE_URL || url.replace(/\/akadverse(\?|$)/, "/akadverse_elearning$1");
if (new URL(elearningUrl).hostname !== host) {
  console.error("Refusing to push the E-Learning schema to a non-local database host.");
  process.exit(1);
}
const ELEARNING_SCHEMA = "prisma/elearning/schema.prisma";

function prisma(args, env) {
  const result = spawnSync("npx", ["prisma", ...args], { stdio: "inherit", shell: process.platform === "win32", env: { ...process.env, ...env } });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

prisma(["migrate", "deploy"], { DATABASE_URL: url, DIRECT_URL: url });
const elearningEnv = { ELEARNING_DATABASE_URL: elearningUrl, ELEARNING_DIRECT_URL: elearningUrl };
prisma(["db", "push", "--skip-generate", `--schema=${ELEARNING_SCHEMA}`], elearningEnv);
prisma(["db", "execute", `--schema=${ELEARNING_SCHEMA}`, "--file", "prisma/elearning/constraints.sql"], elearningEnv);
