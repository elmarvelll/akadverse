#!/usr/bin/env bash
# Synchronize a LOCAL env file (default: .env.local) with a Vercel environment, from your laptop, using the Vercel CLI.
#
#   npm run sync:vercel-env                          # production, from .env.local
#   ./scripts/sync-vercel-env.sh preview             # preview
#   ./scripts/sync-vercel-env.sh development
#   npm run sync:vercel-env -- --dry-run             # show the plan (names only), change nothing
#   FORCE=1 ./scripts/sync-vercel-env.sh production  # no confirmation prompt (automation)
#   ENV_FILE=.env ./scripts/sync-vercel-env.sh       # use a different local file
#   EXCLUDE=NAME1,NAME2 ...                          # never touch these variables
#
# This script only runs the SAFETY CHECKS. Parsing the env file (Node's built-in dotenv parser — the file is never `source`d or
# executed), the diff and the push are done by scripts/sync-vercel-env.mjs. Values are never printed; nothing on Vercel is deleted.
# Nothing is deployed: new variables apply to your NEXT deployment.

set -euo pipefail
cd "$(dirname "$0")/.."

ENVIRONMENT="${1:-production}"
ENV_FILE="${ENV_FILE:-.env.local}"

fail() { printf '%s\n' "$*" >&2; exit 1; }

case "$ENVIRONMENT" in
  production|preview|development) ;;
  *) fail "Unknown environment \"$ENVIRONMENT\". Use: production | preview | development" ;;
esac

# 1. the local file
[ -f "$ENV_FILE" ] || fail "$ENV_FILE was not found.
No changes were made."

# 2. Git safety: the secrets file must be untracked AND ignored
if git rev-parse --git-dir >/dev/null 2>&1; then
  if git ls-files --error-unmatch -- "$ENV_FILE" >/dev/null 2>&1; then
    fail "STOP: $ENV_FILE is tracked by Git, so its secrets may already be in your repository history.
Nothing was changed. Untrack it yourself (git rm --cached $ENV_FILE), rotate any exposed secrets, then run this again."
  fi
  git check-ignore -q -- "$ENV_FILE" || fail "STOP: $ENV_FILE is not covered by .gitignore, so it could be committed by accident.
Add it to .gitignore first. No changes were made."
fi

# 3. Vercel CLI
command -v vercel >/dev/null 2>&1 || fail "The Vercel CLI is not installed.
Install it with:  npm install -g vercel
No changes were made."

# 4. authenticated
ACCOUNT="$(vercel whoami 2>/dev/null | tail -n 1 || true)"
[ -n "$ACCOUNT" ] || fail "You are not logged in to Vercel (or Vercel could not be reached).
Run:  vercel login
No changes were made."

# 5. linked to a project — never guess or auto-link
if [ ! -f .vercel/project.json ] && [ ! -f .vercel/repo.json ]; then
  fail "This folder is not linked to a Vercel project, and this script will not guess which project to change.
Run:  vercel link      (choose the AkadVerse project yourself)
No changes were made."
fi
PROJECT="$(node -e 'try{const r=require("./.vercel/repo.json");console.log(r.projects.map(p=>p.name).join(", "))}catch{try{require("./.vercel/project.json");console.log("(linked via .vercel/project.json)")}catch{}}' 2>/dev/null || true)"

printf 'Vercel account: %s\nLinked project: %s\n\n' "$ACCOUNT" "${PROJECT:-unknown}"

# 6. plan + confirm + push (values never printed)
shift $(( $# > 0 ? 1 : 0 ))
exec node scripts/sync-vercel-env.mjs "$ENVIRONMENT" "$ENV_FILE" "$@"
