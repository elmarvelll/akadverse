// Browser profiles are machine-local state, not source code. Never print their contents.
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";

const paths = execFileSync("git", ["ls-files", "-z"], { encoding: "utf8" }).split("\0").filter(Boolean);
// Ignore worktree deletions so the cleanup can be checked before committing it.
const profiles = paths.filter(path => path.split("/").some(part => /^browser-profile(?:-|$)/.test(part)) && existsSync(path));
if (profiles.length) {
  console.error(`Found ${profiles.length} tracked browser-profile files. Remove these generated artifacts from Git; keep any needed local copy outside source control.`);
  for (const path of profiles.slice(0, 10)) console.error(path);
  process.exitCode = 1;
} else {
  console.log("No tracked browser profiles.");
}
