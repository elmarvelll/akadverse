import { it } from "node:test";
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const guard = path.resolve("scripts/check-browser-artifacts.mjs");
function check(files: string[], deleted = false) {
  const root = mkdtempSync(path.join(tmpdir(), "akadverse-browser-guard-"));
  try {
    execFileSync("git", ["init", "--quiet", root]);
    for (const file of files) {
      const target = path.join(root, file);
      mkdirSync(path.dirname(target), { recursive: true });
      writeFileSync(target, "Test fixture only.\n");
    }
    execFileSync("git", ["-C", root, "add", "."]);
    if (deleted) for (const file of files) rmSync(path.join(root, file));
    return spawnSync(process.execPath, [guard], { cwd: root, encoding: "utf8" });
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

it("allows tracked browser-profile documentation filenames", () => {
  const result = check(["docs/security/browser-profile-cleanup.md", "browser-profile-notes.md"]);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /No tracked browser profiles/);
});
it("rejects files inside tracked browser-profile directories", () => {
  const result = check(["checkpoints/test/browser-profile/Default/Cookies"]);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /Found 1 tracked browser-profile files/);
});
it("rejects suffixed browser-profile directories", () => {
  const result = check(["browser-profile-test/Default/Preferences"]);
  assert.equal(result.status, 1);
});
it("allows browser artifacts removed from the working tree", () => {
  const result = check(["checkpoints/test/browser-profile/Default/Cookies"], true);
  assert.equal(result.status, 0, result.stderr);
});
