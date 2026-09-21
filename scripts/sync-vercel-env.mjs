#!/usr/bin/env node
// Synchronizes the variables in a LOCAL env file (default .env.local) with a Vercel environment, using the Vercel CLI.
// Called by scripts/sync-vercel-env.sh, which performs the safety checks first (file exists, not tracked by Git, CLI installed,
// logged in, project linked). Run it through that wrapper:  npm run sync:vercel-env
//
//   args:  <production|preview|development> <env file> [--dry-run] [--yes]
//   env:   FORCE=1            skip the confirmation prompt (automation)
//          DRY_RUN=1          print the plan only (same as --dry-run)
//          EXCLUDE=A,B        never touch these names
//          ALLOW_LOCALHOST=1  allow values that point at localhost (refused by default for production/preview)
//
// What it does, per variable in the local file:
//   - not on Vercel yet  -> ADD     (vercel env add)
//   - already on Vercel  -> UPDATE  (vercel env update — an in-place update, never delete + re-add)
//   - on Vercel but not in the local file -> PRESERVED, untouched. Nothing is ever deleted.
//
// Security: the file is parsed with Node's built-in dotenv parser (util.parseEnv) — it is never executed or `source`d. Values are held
// in memory only and handed to the CLI on STDIN (never on a command line); only variable NAMES are ever printed, and any error
// text has values redacted. The Vercel API cannot return sensitive values, so "unchanged" can't be detected: every variable that
// exists on both sides is re-written.

import fs from "node:fs";
import readline from "node:readline/promises";
import { parseEnv } from "node:util";
import { spawnSync } from "node:child_process";

const [environment = "production", envFile = ".env.local", ...flags] = process.argv.slice(2);
const DRY_RUN = flags.includes("--dry-run") || process.env.DRY_RUN === "1";
const FORCE = process.env.FORCE === "1" || flags.includes("--yes");
const ALLOW_LOCALHOST = process.env.ALLOW_LOCALHOST === "1";
const EXCLUDE = new Set((process.env.EXCLUDE ?? "").split(",").map((s) => s.trim()).filter(Boolean));

const LABEL = { production: "Production", preview: "Preview", development: "Development" }[environment];
if (!LABEL) { console.error(`Unknown environment "${environment}". Use production, preview or development.`); process.exit(2); }

// Names Vercel/the platform own or that must never be copied from a laptop (e.g. VERCEL_OIDC_TOKEN, NODE_ENV=development).
const RESERVED = /^(VERCEL($|_)|NODE_ENV$|NEXT_RUNTIME$|CI$|PORT$|HOME$|PATH$|TURBO_|NX_)/;

const cli = (args, input) => spawnSync("vercel", args, { input, encoding: "utf8", maxBuffer: 16 * 1024 * 1024 });
const redact = (text, value) => {
  let t = String(text ?? "");
  if (value && value.length >= 4) t = t.split(value).join("[redacted]");
  return t;
};
const lastLine = (r, value) => redact((r.stderr || r.stdout || "").split("\n").map((l) => l.trim()).filter(Boolean).pop() ?? "unknown error", value).slice(0, 220);

// ---- 1. the local file (parsed, never executed) -------------------------------------------------------------------------------
let local;
try { local = parseEnv(fs.readFileSync(envFile, "utf8")); } catch { console.error(`${envFile} could not be read.\nNo changes were made.`); process.exit(1); }
const localNames = Object.keys(local);

const reserved = [], empty = [], excluded = [], localhostRefused = [];
const syncable = [];
for (const name of localNames) {
  if (RESERVED.test(name)) reserved.push(name);
  else if (EXCLUDE.has(name)) excluded.push(name);
  else if (!local[name]) empty.push(name);
  else if (environment !== "development" && !ALLOW_LOCALHOST && /localhost|127\.0\.0\.1|0\.0\.0\.0/.test(local[name])) localhostRefused.push(name);
  else syncable.push(name);
}

// ---- 2. what is on Vercel right now (names only) ------------------------------------------------------------------------------
const listing = cli(["env", "ls", "--json"]);
if (listing.status !== 0) { console.error(`Could not read the variable list from Vercel: ${lastLine(listing)}\nNo changes were made.`); process.exit(1); }
let onVercel;
try {
  const envs = JSON.parse(listing.stdout).envs ?? [];
  // only the key + target are read; nothing else from the response is kept
  onVercel = new Set(envs.filter((e) => [].concat(e.target ?? []).includes(environment)).map((e) => e.key));
} catch { console.error("Vercel returned a list this script couldn't read.\nNo changes were made."); process.exit(1); }

const toAdd = syncable.filter((n) => !onVercel.has(n));
const toUpdate = syncable.filter((n) => onVercel.has(n));
const preserved = [...onVercel].filter((n) => !syncable.includes(n) && !localNames.includes(n));
const sessionPooler = syncable.filter((n) => /pooler\.supabase\.com:5432/.test(local[n]));

// ---- 3. the plan (names only) ------------------------------------------------------------------------------------------------
const list = (title, names, mark) => { if (names.length) { console.log(`\n${title}`); names.forEach((n) => console.log(`  ${mark} ${n}`)); } };
console.log(`Environment: ${environment}`);
console.log(`Source file: ${envFile}  (${localNames.length} variable${localNames.length === 1 ? "" : "s"} found, ${syncable.length} to synchronize)`);
list("Variables to add:", toAdd, "✓");
list("Variables to update:", toUpdate, "↻");
if (preserved.length) { console.log(`\nVariables on Vercel but not in ${envFile} (preserved, never deleted): ${preserved.length}`); preserved.forEach((n) => console.log(`  • ${n}`)); }
list(`Skipped — reserved/system name (never synced):`, reserved, "–");
list("Skipped — empty value:", empty, "–");
list("Skipped — excluded via EXCLUDE:", excluded, "–");
list("REFUSED — value points at localhost (set ALLOW_LOCALHOST=1 to override):", localhostRefused, "✗");
if (sessionPooler.length) {
  console.log("\nWarning — these look like a Supabase SESSION-mode pooler URL (port 5432). That is fine for migrations, but for a runtime");
  console.log("database URL on Vercel use the transaction pooler (port 6543, ?pgbouncer=true&connection_limit=…), or you may run out of connections:");
  sessionPooler.forEach((n) => console.log(`  ! ${n}`));
}

if (syncable.length === 0) {
  console.log(`\nNothing to synchronize: ${envFile} has no variables that can be pushed.`);
  if (envFile === ".env.local" && fs.existsSync(".env") && Object.keys(parseEnv(fs.readFileSync(".env", "utf8"))).some((n) => !RESERVED.test(n))) {
    console.log("Your variables appear to live in .env instead. To sync that file:\n  ENV_FILE=.env npm run sync:vercel-env");
  }
  console.log("No changes were made.");
  process.exit(0);
}

console.log(`\nAbout to synchronize ${syncable.length} variable${syncable.length === 1 ? "" : "s"} to Vercel ${LABEL}.`);
console.log(`${toAdd.length} will be added.  ${toUpdate.length} will be updated.  ${preserved.length} existing Vercel variable${preserved.length === 1 ? "" : "s"} will be preserved.`);
if (DRY_RUN) { console.log("\nDry run: no changes were made."); process.exit(0); }

if (!FORCE) {
  if (!process.stdin.isTTY) { console.error("\nNot an interactive terminal and FORCE=1 is not set. No changes were made."); process.exit(1); }
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const answer = (await rl.question("\nContinue? [y/N] ")).trim().toLowerCase();
  rl.close();
  if (answer !== "y" && answer !== "yes") { console.log("Cancelled. No changes were made."); process.exit(0); }
}

// ---- 4. apply — stop at the first failure so nothing is left half-understood -----------------------------------------------------------
const isPublic = (n) => n.startsWith("NEXT_PUBLIC_"); // public by design: inlined into the browser bundle, so not sensitive
const sensitive = environment !== "development"; // Vercel only offers Sensitive for Production/Preview
const addFlags = (n) => (sensitive && !isPublic(n) ? ["--sensitive"] : ["--no-sensitive"]);
const updateFlags = (n) => (sensitive && !isPublic(n) ? ["--sensitive"] : []); // update keeps the existing type unless asked to harden it

const done = [];
for (const name of [...toAdd, ...toUpdate]) {
  const adding = toAdd.includes(name);
  const value = local[name];
  let r = cli(adding ? ["env", "add", name, environment, ...addFlags(name), "--yes"] : ["env", "update", name, environment, ...updateFlags(name), "--yes"], value);
  let how = adding ? "added" : "updated";
  if (r.status !== 0 && adding && /already exists/i.test(`${r.stderr}${r.stdout}`)) { // the list can lag/paginate: fall back to an in-place update
    r = cli(["env", "update", name, environment, ...updateFlags(name), "--yes"], value);
    how = "updated";
  }
  if (r.status !== 0) {
    console.error(`\nFAILED on ${name}: ${lastLine(r, value)}`);
    console.error(`Stopped. Already applied (${done.length}): ${done.map((d) => d.name).join(", ") || "none"}.`);
    const rest = [...toAdd, ...toUpdate].filter((n) => !done.some((d) => d.name === n) && n !== name);
    console.error(`Not applied (${rest.length + 1}): ${[name, ...rest].join(", ")}.\nFix the problem and run the command again — it is safe to repeat.`);
    process.exit(1);
  }
  done.push({ name, how });
  console.log(`  ${how === "added" ? "✓ added  " : "↻ updated"} ${name}`);
}

console.log(`\nEnvironment variables successfully synchronized with Vercel ${LABEL}.`);
console.log(`${done.filter((d) => d.how === "added").length} added, ${done.filter((d) => d.how === "updated").length} updated, ${preserved.length} preserved. No variable was deleted.`);
console.log("\nIMPORTANT:\nEnvironment variable changes apply to NEW deployments only.");
console.log(`\nDeploy again for the updated variables to be available:\n  vercel${environment === "production" ? " --prod" : ""}`);
console.log("This project also deploys from Git: pushing the relevant branch/commit triggers a deployment according to your Vercel project settings.");
