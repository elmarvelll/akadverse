# Reverse these source changes without rolling back user data

No rollback has been applied. Stop the local server before applying a source rollback; rebuild and check afterward.

Run a check only:

powershell.exe -NoProfile -ExecutionPolicy Bypass -File "C:\Productivity Layer\checkpoints\habit-refinements-2026-11-07\rollback.ps1"

Add -UIOnly to restrict the check to changed TSX/CSS files. Add -Apply to actually perform the selected source rollback. The default is check-only. The execution-policy option is limited to the spawned PowerShell process.

The script validates absolute targets stay in the original project and checks current/backup SHA-256 hashes before any changes. It refuses to overwrite later work. Before copies include all unrelated prior work. CHANGED-FILES.md and manifest.json list the exact update. Source-only new files are removed only on an explicit full-source apply, after validation. Browser evidence/profile files are not touched.

## Data compatibility

Never restore old localStorage to undo this implementation: that would erase new outcomes. Existing task/schedule/habit keys and IDs were preserved. Corrections now carry validated outcomeChanges chains and current outcome fields, with original audits retained. Old strict readers can reject corrected records because they do not understand that chain.

After users have saved corrections, prefer -UIOnly -Apply, which keeps the compatible TypeScript model, repositories and service logic. It reverses the UI without erasing records. Run type/build checks and reconcile any later changes. Full old-source reversal may require a forward compatibility patch before those old readers can open corrected records; keep current data rather than downgrading or resetting it. Restoring an old data snapshot is not part of this script or the recommended rollback.
