# Reverse only this integration update

Stop the local server first. Run `powershell.exe -NoProfile -ExecutionPolicy Bypass -File "C:\Productivity Layer\checkpoints\habit-integrations-2026-11-07\rollback.ps1"` to check hashes. Add `-Apply` to restore the copied source files and remove only the three new source/test files listed in manifest.json. Rebuild and restart afterward.

The script checks every current source hash and every backup hash before changing anything; if any file has since changed, it stops so that those later edits can be reconciled manually. It validates absolute targets stay within the original project root. No localStorage, user records, dependencies, routes or earlier checkpoints are deleted or reset. The before copies include all earlier work, including the today-only To-do fix. No rollback has been applied.
