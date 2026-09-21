// Compares your LOCAL .env with the environment variables that already exist on Vercel, and pushes every variable that is in
// .env but MISSING on Vercel to the Vercel PRODUCTION environment. It never prints a value.
//
//   node scripts/vercel-env-sync.mjs             DRY RUN (default): lists what is new and what would be pushed. Changes nothing.
//   node scripts/vercel-env-sync.mjs --apply     Push the new variables to Production.
//   node scripts/vercel-env-sync.mjs --apply --preview     ...to Production AND Preview (branch deployments).
//   node scripts/vercel-env-sync.mjs --raw       Don't rewrite ELEARNING_DATABASE_URL for serverless (push it exactly as in .env).
//
// "On Vercel" is read LIVE from `vercel env ls` (the truth). The pulled snapshot `.env.vercel`, if present, is only compared for
// information. Only variables MISSING from Production are added — existing ones are never overwritten (use the Vercel dashboard or
// `vercel env update NAME production` for that).
//
// Safety rules:
//   - values go to `vercel env add` on STDIN (never a command line, never logged); only variable NAMES are printed;
//   - everything is stored as Sensitive, except NEXT_PUBLIC_* (public by design: they are inlined into the browser bundle);
//   - a value that points at localhost / 127.0.0.1 is refused, an empty value is skipped;
//   - system variables (VERCEL*, NODE_ENV, ...) are ignored;
//   - ELEARNING_DATABASE_URL is rewritten for serverless unless --raw: Supabase transaction pooler (port 6543) with pgbouncer=true and
//     a small connection_limit. The session-mode pooler on 5432 that works locally runs out of connections under Vercel.
//   - `.env` itself is never modified, committed or read at runtime by the app; it is only read here, on your machine.
//   - Vercel applies new/changed variables to NEW deployments only: redeploy afterwards.

import fs from "node:fs";
import { spawnSync } from "node:child_process";

const APPLY = process.argv.includes("--apply");
const PREVIEW = process.argv.includes("--preview");
const RAW = process.argv.includes("--raw");
const targets = PREVIEW ? ["production", "preview"] : ["production"];

const parse = (text) => {
  const out = {};
  for (const line of text.split("\n")) {
    const m = line.match(/^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (m) out[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
  }
  return out;
};

const local = parse(fs.readFileSync(".env", "utf8"));
const snapshot = fs.existsSync(".env.vercel") ? parse(fs.readFileSync(".env.vercel", "utf8")) : null;

// Live list from Vercel: name -> environments it exists in.
const ls = spawnSync("vercel", ["env", "ls"], { encoding: "utf8" });
if (ls.status !== 0) { console.error("Could not list Vercel variables. Is the CLI installed and logged in (`vercel whoami`)?"); process.exit(1); }
const live = new Map();
for (const line of ls.stdout.split("\n")) {
  const m = line.match(/^\s([A-Za-z_][A-Za-z0-9_]*)\s+\S+\s+(.*?)\s{2,}/) ?? line.match(/^\s([A-Za-z_][A-Za-z0-9_]*)\s+\S+\s+(Production|Preview|Development)[^\n]*/);
  if (m) live.set(m[1], line);
}
const inProduction = (name) => /Production/.test(live.get(name) ?? "");

const SYSTEM = /^(VERCEL|NODE_ENV$|NEXT_RUNTIME$|TURBO_|CI$|PORT$|HOME$|PATH$)/;
const isPublic = (name) => name.startsWith("NEXT_PUBLIC_");

// Serverless-safe form of the E-Learning runtime URL.
function pooled(url) {
  const u = new URL(url);
  if (!/pooler\.supabase\.com$/.test(u.hostname)) return { value: url, note: "not a Supabase pooler host — pushed unchanged, check pooling yourself" };
  u.port = "6543"; // transaction pooler
  if (!u.searchParams.has("pgbouncer")) u.searchParams.set("pgbouncer", "true");
  if (!u.searchParams.has("connection_limit")) u.searchParams.set("connection_limit", "3");
  if (!u.searchParams.has("pool_timeout")) u.searchParams.set("pool_timeout", "20");
  return { value: u.toString(), note: "rewritten for serverless: transaction pooler (6543), pgbouncer=true, connection_limit=3" };
}

console.log(`${APPLY ? "APPLY" : "DRY RUN"} — targets: ${targets.join(", ")}`);
console.log(`local .env: ${Object.keys(local).length} variables | on Vercel (live): ${live.size} variables${snapshot ? ` | .env.vercel snapshot: ${Object.keys(snapshot).length}` : ""}\n`);

const fresh = Object.keys(local).filter((n) => !SYSTEM.test(n) && !inProduction(n));
const alreadyThere = Object.keys(local).filter((n) => !SYSTEM.test(n) && inProduction(n));
console.log(`already on Vercel Production (left untouched): ${alreadyThere.length}`);
if (snapshot) {
  const staleSnap = Object.keys(snapshot).filter((n) => !live.has(n));
  if (staleSnap.length) console.log(`(note: .env.vercel lists ${staleSnap.length} name(s) that are not on Vercel any more: ${staleSnap.join(", ")})`);
}
console.log(`\nNEW — in .env but missing from Vercel Production: ${fresh.length}\n`);
console.log("NAME".padEnd(36) + "TYPE".padEnd(12) + "ACTION");

let pushed = 0, failed = 0, refused = 0;
for (const name of fresh) {
  let value = local[name], note = "";
  if (!value) { console.log(name.padEnd(36) + "-".padEnd(12) + "SKIPPED (empty in .env)"); continue; }
  if (name === "ELEARNING_DATABASE_URL" && !RAW) ({ value, note } = pooled(value));
  if (/localhost|127\.0\.0\.1/.test(value)) { refused++; console.log(name.padEnd(36) + "-".padEnd(12) + "REFUSED (points at localhost — set the real value in the Vercel dashboard)"); continue; }
  const type = isPublic(name) ? "public" : "sensitive";
  console.log(name.padEnd(36) + type.padEnd(12) + (APPLY ? "pushing…" : "would ADD") + (note ? `   [${note}]` : ""));
  if (!APPLY) continue;
  for (const target of targets) {
    const args = ["env", "add", name, target, isPublic(name) ? "--no-sensitive" : "--sensitive", "--yes"];
    const r = spawnSync("vercel", args, { input: value, encoding: "utf8" });
    if (r.status === 0) { pushed++; console.log(`   -> ${target}: added`); }
    else { failed++; console.log(`   -> ${target}: FAILED (${((r.stderr || r.stdout || "").split("\n").map((l) => l.trim()).filter(Boolean).pop() ?? "unknown error").slice(0, 160)})`); }
  }
}

console.log(`\nNEVER changed by this script: variables that already exist on Vercel (including NEXTAUTH_URL and NEXTAUTH_SECRET — see the note below).`);
console.log("NOTE: NEXTAUTH_SECRET on Vercel is unchanged. If you rotated it locally, production still has the OLD value; update it with");
console.log("      `vercel env update NEXTAUTH_SECRET production` (this signs every production user out).");
if (APPLY) {
  console.log(`\nResult: ${pushed} added, ${failed} failed, ${refused} refused.`);
  console.log("Vercel only applies changed variables to NEW deployments: redeploy (dashboard -> Deployments -> Redeploy, or push a commit).");
} else console.log("\nDry run only. Re-run with --apply to push.");
process.exit(failed ? 1 : 0);
