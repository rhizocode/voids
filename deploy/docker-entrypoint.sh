#!/bin/sh
# Entrypoint: align the runtime user with the host so the bind-mounted data
# volume is writable, then drop privileges and exec the server.
#
# On unRAID (and most NAS setups) the host directory mapped to /data is owned by
# a fixed uid:gid (unRAID defaults to 99:100). A container that runs as a
# hardcoded user can't create the SQLite file there. We start as root, take
# ownership of DATA_DIR for the requested PUID:PGID, then `gosu` down to it.
#
# PUID/PGID default to 1000 (the historical `node` user) so existing `docker run`
# setups keep working unchanged.
set -e

DATA_DIR="${DATA_DIR:-/data}"
PUID="${PUID:-1000}"
PGID="${PGID:-1000}"

# If we're not root we can't chown or drop privileges — assume the orchestrator
# already arranged a correct, writable user (e.g. `docker run --user`).
if [ "$(id -u)" = "0" ]; then
  mkdir -p "$DATA_DIR"
  # Best-effort: a read-only or already-correct mount shouldn't be fatal.
  chown -R "$PUID:$PGID" "$DATA_DIR" 2>/dev/null || true
  exec gosu "$PUID:$PGID" "$@"
fi

exec "$@"
