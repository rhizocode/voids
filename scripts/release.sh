#!/usr/bin/env bash
#
# release.sh — build a Voids image stamped with the version from the git tag.
#
# The git tag is the single source of truth for the version. This script derives
# it with `git describe`, exports it as APP_VERSION, and builds the image so that:
#   - Vite bakes it into the web bundle at build time (__APP_VERSION__), and
#   - the server reports it at runtime via GET /api/version.
#
# Usage:
#   scripts/release.sh                # build using the current git-derived version
#   scripts/release.sh --print        # just print the derived version and exit
#
# Cutting a new release is the usual npm flow, then this script:
#   pnpm version 0.3.0 && git push --follow-tags && scripts/release.sh
set -euo pipefail

cd "$(dirname "$0")/.."

# Exact tag when HEAD is tagged (e.g. "v0.2.0"); otherwise "<tag>-<n>-g<sha>", and
# "-dirty" appended when the working tree has uncommitted changes. --always falls
# back to a bare short SHA if no tag exists yet.
APP_VERSION="$(git describe --tags --always --dirty)"
export APP_VERSION

if [[ "${1:-}" == "--print" ]]; then
  echo "$APP_VERSION"
  exit 0
fi

if [[ "$APP_VERSION" == *-dirty ]]; then
  echo "warning: working tree is dirty — building $APP_VERSION (not a clean release)" >&2
fi

echo "Building Voids image with APP_VERSION=$APP_VERSION"
docker compose build
echo "Done. Run 'docker compose up -d' to start it."
