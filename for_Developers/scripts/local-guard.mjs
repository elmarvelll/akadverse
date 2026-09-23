// for_Developers/scripts/local-guard.mjs
//
// The one safety check every for_Developers command runs before touching a database: load `.env`, then refuse to
// continue unless EVERY database URL points at this machine. This is what makes `npm run db:local:reset` and
// `npm run db:local:seed` impossible to run against staging/production by accident (a copied production .env,
// a wrong terminal, etc.).

import { existsSync } from "node:fs";

const DATABASE_VARS = ["DATABASE_URL", "DIRECT_URL", "ELEARNING_DATABASE_URL", "ELEARNING_DIRECT_URL"];
const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1", "[::1]", "host.docker.internal"]);

export function loadDotEnv() {
  if (!existsSync(".env")) {
    fail("No .env file found at the repository root.\n  Create it with:  cp for_Developers/.env.example .env\n  (run commands from the repository root)");
  }
  // Values already set in the shell win over .env, matching Prisma/Next.js behaviour.
  process.loadEnvFile(".env");
}

export function assertLocalDatabases() {
  if (process.env.NODE_ENV === "production" || process.env.VERCEL) {
    fail("NODE_ENV=production / VERCEL is set. The for_Developers database commands only run in local development.");
  }
  for (const name of DATABASE_VARS) {
    const value = process.env[name];
    if (!value) fail(`${name} is not set in .env. Copy it from for_Developers/.env.example.`);
    let host;
    try {
      host = new URL(value).hostname;
    } catch {
      fail(`${name} is not a valid database URL.`);
    }
    if (!LOCAL_HOSTS.has(host)) {
      fail(
        `${name} points at "${host}", which is not this machine.\n` +
          "  These commands can DELETE and overwrite data, so they only run against a local database.\n" +
          "  Use the local URLs from for_Developers/.env.example. Never point local tooling at staging or production."
      );
    }
  }
}

function fail(message) {
  console.error(`\n✖ ${message}\n`);
  process.exit(1);
}
