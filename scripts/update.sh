#!/usr/bin/env bash
set -euo pipefail

# ============================================================================
# Imboni — update a running deployment to the latest code
# ============================================================================
# Usage, on the VPS:
#
#     cd /opt/imboni
#     bash scripts/update.sh
#
# Options:
#     BRANCH=main          which branch to deploy
#     SKIP_BACKUP=1        skip the pre-deploy dump (don't)
#     PRUNE=0              keep dangling images instead of reclaiming the disk
#
# This is deliberately NOT deploy.sh. deploy.sh installs Docker, writes
# .env.prod and provisions the first school — all first-run work that must not
# happen again. This only moves a running stack to newer code.
# ============================================================================

DEPLOY_DIR="${DEPLOY_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}"
BRANCH="${BRANCH:-main}"
SKIP_BACKUP="${SKIP_BACKUP:-0}"
PRUNE="${PRUNE:-1}"

cd "${DEPLOY_DIR}"

# Every compose command needs --env-file AND both -f files. Miss any of them
# and compose silently falls back to the DEVELOPMENT config: no TLS, no
# restart policy, no backup mount, DEBUG defaults. Wrapping it in one function
# is the only reliable way to not get this wrong at 2am.
compose() {
    docker compose \
        --env-file .env.prod \
        -f docker-compose.yml \
        -f docker-compose.prod.yml \
        "$@"
}

say() { printf '\n[update] %s\n' "$*"; }

# ---------------------------------------------------------------------------
# 0. Refuse to run against a half-configured directory
# ---------------------------------------------------------------------------
[[ -f .env.prod ]] || { echo "[update] No .env.prod here. Wrong directory, or the stack was never deployed." >&2; exit 1; }

PREVIOUS="$(git rev-parse HEAD)"
say "Currently deployed: ${PREVIOUS:0:8} ($(git log -1 --format=%s))"

# ---------------------------------------------------------------------------
# 1. Fetch, and stop if the working tree has been edited by hand
# ---------------------------------------------------------------------------
# `git pull` on a dirty tree either refuses halfway or quietly merges somebody's
# emergency hotfix into a merge commit nobody reviews. Check first and say what
# is dirty, so the person deciding is the person who made the edit.
if [[ -n "$(git status --porcelain --untracked-files=no)" ]]; then
    echo "[update] Tracked files have local edits:" >&2
    git status --short --untracked-files=no >&2
    echo "[update] Commit, stash or discard them, then re-run." >&2
    exit 1
fi

say "Fetching origin/${BRANCH}..."
git fetch origin "${BRANCH}"

# --ff-only, never a merge. A merge here creates a commit that exists on this
# server and nowhere else, and the next update then conflicts against it.
git checkout "${BRANCH}"
git merge --ff-only "origin/${BRANCH}"

TARGET="$(git rev-parse HEAD)"
if [[ "${TARGET}" == "${PREVIOUS}" ]]; then
    say "Already up to date. Nothing to deploy."
    exit 0
fi
say "Deploying: ${TARGET:0:8} ($(git log -1 --format=%s))"
git log --oneline "${PREVIOUS}..${TARGET}" | sed 's/^/           /'

# ---------------------------------------------------------------------------
# 2. Back up BEFORE the new code touches the database
# ---------------------------------------------------------------------------
# Order matters. The backend applies migrations in its entrypoint the moment it
# starts, so once the new container is up the schema has already changed — a
# dump taken after that point cannot undo anything. This has to happen while
# the OLD container is still the one running.
#
# It writes to /app/backups, bind-mounted to ./backups on the host, so it
# survives the rebuild. If that mount is ever removed, the dump lands in the
# container's writable layer and `up --build` throws it away — silently, since
# pg_dump exits 0 either way.
if [[ "${SKIP_BACKUP}" != "1" ]]; then
    if [[ -n "$(compose ps -q backend 2>/dev/null)" ]]; then
        say "Backing up the database..."
        # No `|| true`. A failed backup is a reason to stop, not a warning to
        # scroll past on the way to migrating production.
        compose exec -T backend python manage.py backup_database
        say "Backup written to ${DEPLOY_DIR}/backups/"
    else
        echo "[update] backend is not running, so there is nothing to back up." >&2
        echo "[update] Re-run with SKIP_BACKUP=1 if that is expected." >&2
        exit 1
    fi
fi

# ---------------------------------------------------------------------------
# 3. Build first, switch second
# ---------------------------------------------------------------------------
# `up -d --build` does both in one step, which means a build failure happens
# with the old containers already stopped: the site is down for as long as it
# takes to work out what broke. Building first keeps the current version
# serving traffic until there is something to replace it with.
say "Building images (the site stays up during this)..."
compose build

say "Starting the new containers..."
compose up -d --remove-orphans

# ---------------------------------------------------------------------------
# 4. Wait for the backend, which is also waiting for the migrations
# ---------------------------------------------------------------------------
# "healthy" is not a formality here: the healthcheck only passes once uvicorn
# is listening, and the entrypoint does not exec uvicorn until migrate_schemas
# has finished for the shared schema AND every school. So this loop is
# literally waiting for the migrations, and worker/beat are waiting on it too.
say "Waiting for the backend (this is the migrations running)..."
CID="$(compose ps -q backend)"
for i in $(seq 1 90); do
    STATUS="$(docker inspect --format='{{.State.Health.Status}}' "${CID}" 2>/dev/null || echo starting)"
    [[ "${STATUS}" == "healthy" ]] && { say "Backend healthy — migrations applied."; break; }
    if [[ "${STATUS}" == "unhealthy" || $i -eq 90 ]]; then
        echo "[update] Backend did not come up (${STATUS}). Last 60 lines:" >&2
        compose logs --tail 60 backend >&2
        echo "" >&2
        echo "[update] To roll back:  git checkout ${PREVIOUS} && bash scripts/update.sh" >&2
        echo "[update] The pre-deploy dump is in ${DEPLOY_DIR}/backups/" >&2
        exit 1
    fi
    sleep 5
done

# ---------------------------------------------------------------------------
# 5. Reclaim the disk
# ---------------------------------------------------------------------------
# Every rebuild leaves the previous image layers dangling, and an Oracle free
# tier boot volume fills up faster than anyone expects. Dangling only — never
# `-a`, which would delete the images of any container that happens to be
# stopped right now.
if [[ "${PRUNE}" != "0" ]]; then
    say "Reclaiming disk from old image layers..."
    docker image prune -f | tail -1
fi

# ---------------------------------------------------------------------------
# 6. Report
# ---------------------------------------------------------------------------
say "Status:"
compose ps

cat <<EOF

[update] Done. ${PREVIOUS:0:8} -> ${TARGET:0:8}

  Roll back : git checkout ${PREVIOUS} && bash scripts/update.sh
  Backups   : ${DEPLOY_DIR}/backups/
  Logs      : cd ${DEPLOY_DIR} && docker compose --env-file .env.prod \\
                -f docker-compose.yml -f docker-compose.prod.yml logs -f

  Tell anyone already on the site to hard-refresh (Ctrl+Shift+R). The PWA
  service worker serves the previous build from cache until it does, so
  "nothing changed" is the expected first report after every deploy.
EOF
