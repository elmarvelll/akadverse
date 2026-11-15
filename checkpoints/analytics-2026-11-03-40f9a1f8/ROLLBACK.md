# Verified analytics rollback

Checkpoint: C:\Productivity Layer\checkpoints\analytics-2026-11-03-40f9a1f8
Application: C:\Productivity Layer\schedule-manager

Git 2.55 is installed, but this directory is not a Git repository. There is no current branch, commit identifier or safe analytics-only commit. No repository was initialized and no commit, push or deployment was performed. Verified file backups are the actual checkpoint.

Before editing application files, four originals were copied byte-for-byte into before/ and SHA-256 verified: src/features/schedule/ScheduleManager.tsx, src/features/tasks/TaskManager.tsx, src/app/globals.css, README.md. Their existing uncommitted contents are preserved in those originals. No secret environment files were copied.

manifest.json records original and post-analytics hashes, seven analytics-created file paths and post-change hashes, plus verification results. review.diff contains the reviewed changes to existing files. New files are five src/features/analytics modules, tests/analytics.test.ts, and ANALYTICS.md. No other existing source files were intentionally modified. Build artifacts are regenerated, not restored.

## Exact reversal procedure

Do not run rollback during implementation. First stop the local npm server and preserve any edits made since this checkpoint.

Run a non-mutating integrity/later-edit check:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "C:\Productivity Layer\checkpoints\analytics-2026-11-03-40f9a1f8\rollback.ps1" -CheckOnly
```

To actually reverse this update later, run the same guarded script without -CheckOnly:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "C:\Productivity Layer\checkpoints\analytics-2026-11-03-40f9a1f8\rollback.ps1"
```

The script verifies all backups and current source hashes before changing anything. It restores exactly the four listed existing files and removes only the seven individually listed analytics-created files that still match their recorded analytics hashes. It does not recursively delete folders. Already restored originals and already removed new files are skipped. Later edits cause a refusal before mutation: merge those changes manually rather than overwriting them with a whole backup file. This is essential because whole-file restoration could otherwise overwrite later unrelated work.

After a successful rollback:

```powershell
Set-Location -LiteralPath "C:\Productivity Layer\schedule-manager"
npm.cmd run build
npm.cmd run typecheck
npm.cmd start
```

No package.json or lockfile changes occurred, so dependency reversal requires no action. No analytics data migration, new storage format, manually stored counters, or record writes occurred; task version-two and schedule version-one data remain readable by the original checkpoint code. No stored-data rollback is necessary.

Verification completed: 71 tests, ESLint, production build and standalone TypeScript checks passed. A -CheckOnly verification is run after finalizing this manifest; actual rollback is not executed. Desktop/mobile visual checks and full browser interaction remain unverified because no browser automation tool is available.
