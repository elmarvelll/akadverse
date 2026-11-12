// for_Developers/scripts/local-db.mjs
//
// Creates / resets the schema of BOTH local databases. Refuses to run unless every database URL in .env is local
// (see local-guard.mjs).
//
//   node for_Developers/scripts/local-db.mjs setup   (npm run db:local:setup)
//     Core:       prisma migrate deploy       — applies prisma/migrations (never creates new ones)
//     E-Learning: prisma db push + constraints.sql  — this schema has no migrations folder; this is how it's deployed
//
//   node for_Developers/scripts/local-db.mjs reset   (npm run db:local:reset)
//     Drops ALL data in both local databases, then does the same as `setup`. Run the seed afterwards.

import { spawnSync } from "node:child_process";
import { assertLocalDatabases, loadDotEnv } from "./local-guard.mjs";

const ELEARNING_SCHEMA = "prisma/elearning/schema.prisma";
const command = process.argv[2];

if (command !== "setup" && command !== "reset") {
  console.error("Usage: node for_Developers/scripts/local-db.mjs <setup|reset>");
  process.exit(1);
}

loadDotEnv();
assertLocalDatabases();

if (command === "reset") {
  console.log("\n▶ Resetting the LOCAL Core database (all data is deleted)…");
  prisma(["migrate", "reset", "--force", "--skip-seed", "--skip-generate"]);
  console.log("\n▶ Resetting the LOCAL E-Learning database (all data is deleted)…");
  prisma(["db", "push", "--force-reset", "--skip-generate", `--schema=${ELEARNING_SCHEMA}`]);
} else {
  console.log("\n▶ Applying Core database migrations (prisma/migrations)…");
  prisma(["migrate", "deploy"]);
  console.log("\n▶ Creating/updating the E-Learning database schema…");
  prisma(["db", "push", "--skip-generate", `--schema=${ELEARNING_SCHEMA}`]);
}

console.log("\n▶ Applying E-Learning database constraints (prisma/elearning/constraints.sql)…");
prisma(["db", "execute", `--schema=${ELEARNING_SCHEMA}`, "--file", "prisma/elearning/constraints.sql"]);

console.log(`\n✔ Local databases ready. Next: npm run db:local:seed\n`);

function prisma(args) {
  const result = spawnSync("npx", ["prisma", ...args], { stdio: "inherit", shell: process.platform === "win32" });
  if (result.status !== 0) {
    console.error(`\n✖ \`prisma ${args.join(" ")}\` failed — see the output above and for_Developers/TROUBLESHOOTING.md.\n`);
    process.exit(result.status ?? 1);
  }
}
