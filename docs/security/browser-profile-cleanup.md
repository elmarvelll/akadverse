# Browser-profile and branch-work cleanup

The failed Secret Scan included browser state committed in `766da6dc3ebf09c20665923809a19623e16bf69e`, rather than application source alone. Two checkpoint browser-profile directories contained 1,379 tracked files. The reviewed Figma profile also contained nonempty cookie, saved-login and browsing-history databases. No credential values were printed during review.

The cleanup removes both browser profiles from the working tree and the next commit. Private local copies are retained under the ignored `.local/branch-work/` archive. `.gitignore` and `.vercelignore` prevent them from being added/uploaded accidentally. The Secret Scan workflow rejects tracked browser-profile files before running Gitleaks. Gitleaks rules and redaction remain enabled; no blanket checkpoint exclusion or historical finding baseline is introduced.

This does not erase already-published Git history. The repository owner should review the affected browser accounts, invalidate exposed sessions, and change affected saved passwords as appropriate. Encrypted browser databases are not proof that the published material is harmless. Do not paste browser data, scanner reports containing secrets, or the private archive into issues or pull requests.

A new push/PR scan tests its configured commit range. Re-running the old failing job will still inspect the old commits and report the artifacts. A complete historical scan likewise continues to report those historical files until they are removed from history. Repository-wide history removal requires coordinated maintenance across affected branches/tags and forks; it is not performed by this cleanup and must not be replaced with a broad scanner allowlist.

The integration branch also contained untracked AI-analysis/voice files whose corresponding tracked schema, actions, and test helpers were still in the existing stash. Those additions are preserved, not deleted, in `.local/branch-work/productivity-isolation-1adb46b4/files/`. The archive includes a SHA-256 manifest, an exported supporting stash patch, and restoration notes. The original stash is unchanged. Restore that work only alongside its matching schema/actions on the appropriate branch; do not restore private browser profiles to Git tracking.

`npm run dev` now invokes `predev` to regenerate both Prisma clients. This prevents a branch switch from leaving the runtime with missing model delegates. Generation does not modify any database.

## Verification

- Full guarded local PostgreSQL regression suite: **287 passed, 0 failed**.
- TypeScript: passed after isolating the incomplete branch additions.
- Root ESLint: **0 errors**, seven preexisting unused-variable warnings.
- Both Prisma client generations (`npm run predev`): passed without database changes.
- Gitleaks 8.30.1: downloaded from the official release and checksum-verified. The pending cleanup commit was assembled in an isolated local review repository without changing this branch or its index. Its new-commit scan passed with zero findings. A deliberately fake GitHub-token canary was detected and redacted; credential rules remain enabled.
- Artifact guard: rejects a tracked browser-profile fixture and accepts its removal. The workflow YAML parses correctly.
- Historical diagnostic scans still report the deleted browser artifacts in the old commit; this is not claimed to be a clean full-history audit. The user-provided CI run reported 198 findings; the local selected-history reproduction found 111. Neither count establishes that those are live AkadVerse service credentials.
- One existing auth test was made environment-independent: its fresh production subprocess now explicitly disables Google credentials instead of allowing Prisma's dotenv loading to re-enable Google from the developer's real `.env`.

No real branch commit, force-push, remote schema migration, or GitHub Actions rerun was performed. Commit all profile deletions together with the cleanup configuration before pushing; pushing only the guard while retaining the profiles will correctly fail CI.
