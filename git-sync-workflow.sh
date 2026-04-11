#!/usr/bin/env bash
set -u

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

fail() {
  echo -e "${RED}Error:${NC} $1" >&2
  exit 1
}

run_capture() {
  # Runs command, captures stdout+stderr, stores exit code in RC and output in OUT
  OUT=""
  if OUT=$("$@" 2>&1); then
    RC=0
  else
    RC=$?
  fi
}

echo -e "${YELLOW}=== Safe Git Workflow Start ===${NC}"

git rev-parse --is-inside-work-tree >/dev/null 2>&1 || fail "Not inside a git repository"

CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD)
echo "Current branch: ${CURRENT_BRANCH}"

echo "Fetching latest refs..."
git fetch origin --prune >/dev/null 2>&1 || fail "Failed to fetch from origin"

# Detect remote default branch: origin/HEAD -> origin/<branch>
TEAM_BRANCH_REMOTE=""
run_capture git symbolic-ref refs/remotes/origin/HEAD
if [ "$RC" -eq 0 ] && [ -n "$OUT" ]; then
  TEAM_BRANCH_REMOTE=$(echo "$OUT" | sed 's@^refs/remotes/@@')
fi

if [ -z "$TEAM_BRANCH_REMOTE" ]; then
  if git show-ref --verify --quiet refs/remotes/origin/main; then
    TEAM_BRANCH_REMOTE="origin/main"
  elif git show-ref --verify --quiet refs/remotes/origin/master; then
    TEAM_BRANCH_REMOTE="origin/master"
  else
    fail "Could not determine team branch (origin/HEAD, origin/main, origin/master not found)"
  fi
fi

TEAM_BRANCH_LOCAL=${TEAM_BRANCH_REMOTE#origin/}
echo "Team branch: ${TEAM_BRANCH_LOCAL} (${TEAM_BRANCH_REMOTE})"

TIMESTAMP=$(date '+%Y%m%d-%H%M%S')
WIP_BRANCH="wip/${CURRENT_BRANCH}-sync-20260412-${TIMESTAMP##*-}"
STASH_MSG="WIP before team sync ${TIMESTAMP}"

echo "Creating stash (including untracked files)..."
run_capture git stash push -u -m "$STASH_MSG"
if [ "$RC" -ne 0 ]; then
  fail "Stash failed: $OUT"
fi

STASH_REF=""
if echo "$OUT" | grep -qi "No local changes to save"; then
  echo "No local changes were present to stash."
else
  STASH_REF="stash@{0}"
  echo "Stash created: ${STASH_REF} (${STASH_MSG})"
fi

echo "Creating/switching to new branch: ${WIP_BRANCH}"
git checkout -b "$WIP_BRANCH" >/dev/null 2>&1 || fail "Could not create branch ${WIP_BRANCH}"

if [ -n "$STASH_REF" ]; then
  echo "Restoring stashed changes onto ${WIP_BRANCH}..."
  run_capture git stash pop
  if [ "$RC" -ne 0 ]; then
    # stash pop returns non-zero on conflicts; stop and let user resolve safely.
    echo -e "${RED}Stash pop resulted in conflicts.${NC}"
    echo "$OUT"
    echo ""
    echo "Resolve conflicts, then run:"
    echo "  git add <resolved-files>"
    echo "  git commit -m \"WIP: local changes before team sync\""
    exit 2
  fi
fi

COMMIT_HASH=""
if [ -n "$(git status --porcelain)" ]; then
  echo "Committing restored local changes..."
  git add -A
  git commit -m "WIP: local changes before team sync" >/dev/null 2>&1 || fail "Commit failed"
  COMMIT_HASH=$(git rev-parse --short HEAD)
  echo "Commit created: ${COMMIT_HASH}"
else
  echo "No local changes to commit on ${WIP_BRANCH}."
fi

echo "Switching to team branch ${TEAM_BRANCH_LOCAL} and pulling with rebase..."
if git show-ref --verify --quiet "refs/heads/${TEAM_BRANCH_LOCAL}"; then
  git checkout "${TEAM_BRANCH_LOCAL}" >/dev/null 2>&1 || fail "Could not switch to ${TEAM_BRANCH_LOCAL}"
else
  git checkout -b "${TEAM_BRANCH_LOCAL}" --track "${TEAM_BRANCH_REMOTE}" >/dev/null 2>&1 || fail "Could not create tracking branch ${TEAM_BRANCH_LOCAL}"
fi

run_capture git pull --rebase origin "$TEAM_BRANCH_LOCAL"
if [ "$RC" -ne 0 ]; then
  echo -e "${RED}Pull --rebase failed.${NC}"
  echo "$OUT"
  echo ""
  echo "Safest next step:"
  echo "  git rebase --abort"
  echo "  git checkout ${WIP_BRANCH}"
  exit 3
fi
echo -e "${GREEN}Pull --rebase successful.${NC}"

echo "Switching back to ${WIP_BRANCH} and merging ${TEAM_BRANCH_LOCAL}..."
git checkout "$WIP_BRANCH" >/dev/null 2>&1 || fail "Could not switch back to ${WIP_BRANCH}"

run_capture git merge "$TEAM_BRANCH_LOCAL"
if [ "$RC" -ne 0 ]; then
  CONFLICTS=$(git diff --name-only --diff-filter=U)
  if [ -n "$CONFLICTS" ]; then
    echo -e "${RED}Merge conflicts detected.${NC}"
    echo "$CONFLICTS"
    echo ""
    echo "Resolve conflicts, then run:"
    echo "  git add <resolved-files>"
    echo "  git commit"
    echo "  git push -u origin ${WIP_BRANCH}"
    exit 4
  fi

  echo -e "${RED}Merge failed.${NC}"
  echo "$OUT"
  exit 5
fi
echo -e "${GREEN}Merge successful.${NC}"

echo "Pushing ${WIP_BRANCH} to origin..."
run_capture git push -u origin "$WIP_BRANCH"
if [ "$RC" -ne 0 ]; then
  echo -e "${RED}Push failed.${NC}"
  echo "$OUT"
  echo ""
  echo "Likely auth/network issue. Retry:"
  echo "  git push -u origin ${WIP_BRANCH}"
  exit 6
fi
echo -e "${GREEN}Push successful.${NC}"

echo ""
echo -e "${YELLOW}=== Workflow Report ===${NC}"
echo "Current branch before starting: ${CURRENT_BRANCH}"
echo "Team branch used: ${TEAM_BRANCH_LOCAL}"
echo "Stash created: ${STASH_REF:-none}"
echo "New branch: ${WIP_BRANCH}"
echo "Commit created: ${COMMIT_HASH:-none}"
echo "Pull result: success"
echo "Merge result: success"
echo "Push result: success"
echo -e "${GREEN}All done.${NC}"