// for_Developers/seed/index.ts
//
// The development seed — `npm run db:local:seed`. See for_Developers/seed/README.md.
//
//   1. Loads .env and refuses to run unless every database URL is local (../scripts/local-guard.mjs).
//   2. Runs the project's EXISTING seed chain unchanged:
//        npm run db:ccmas:import    (NUC/CCMAS reference data from the committed JSON)
//        npm run db:elearning:seed  (colleges, departments, programmes, current session/semesters)
//   3. Adds the development accounts (users.ts), E-Learning workflow data (e-learning.ts) and Marketplace data
//      (marketplace.ts).
//
// Safe to run repeatedly: every step is idempotent.

import { spawnSync } from "node:child_process";
// Plain .mjs so local-db.mjs can share it without tsx (tsconfig's allowJs types it).
import { assertLocalDatabases, loadDotEnv } from "../scripts/local-guard.mjs";

async function main() {
  loadDotEnv();
  assertLocalDatabases();

  console.log("\n▶ Step 1/4 — CCMAS reference data (npm run db:ccmas:import)");
  run(["run", "db:ccmas:import"]);

  console.log("\n▶ Step 2/4 — E-Learning catalog (npm run db:elearning:seed)");
  console.log("  (Lines below mentioning \"marvelousifezue31\" refer to the project owner's personal test account — ignore them.)");
  run(["run", "db:elearning:seed"]);

  // Imported only after the guard has passed, so no database client is ever created against a non-local URL.
  const { prisma } = await import("../../src/lib/prisma");
  const { elearningDb } = await import("../../src/lib/db/elearning");
  const { seedUsers } = await import("./users");
  const { seedElearning } = await import("./e-learning");
  const { seedMarketplace } = await import("./marketplace");

  try {
    console.log("\n▶ Step 3/4 — Development accounts + E-Learning data");
    const users = await seedUsers(prisma);
    await seedElearning(elearningDb, users);

    console.log("\n▶ Step 4/4 — Marketplace data");
    await seedMarketplace(prisma, users);
  } finally {
    await prisma.$disconnect();
    await elearningDb.$disconnect();
  }

  console.log("\n✔ Development data ready. Log in with the accounts in for_Developers/TEST_CREDENTIALS.md\n");
}

function run(args: string[]) {
  const result = spawnSync("npm", args, { stdio: "inherit", shell: process.platform === "win32" });
  if (result.status !== 0) throw new Error(`\`npm ${args.join(" ")}\` failed — see the output above.`);
}

main().catch((err) => {
  console.error("\n✖ Seed failed:", err instanceof Error ? err.message : err);
  console.error("  See for_Developers/TROUBLESHOOTING.md → \"Seed failure\".\n");
  process.exitCode = 1;
});
