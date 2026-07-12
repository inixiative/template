#!/usr/bin/env bash
# minio-provision.sh — idempotently ensure S3/MinIO buckets exist.
#
# Targets the *published* STORAGE_ENDPOINT (default http://localhost:9000) via
# `mc`, NOT a per-project compose network. That matters because the dev model
# shares one minio on :9000 across the main checkout and its worktrees (and can
# even be a sibling project's container) — so "which compose network" is the
# wrong question; "what's on the endpoint the app actually uses" is the right one.
#
# Usage:  minio-provision.sh <bucket> [<bucket> ...]
#   Reads STORAGE_ENDPOINT / STORAGE_ACCESS_KEY_ID / STORAGE_SECRET_ACCESS_KEY
#   from the environment (sensible local defaults if unset).
set -euo pipefail

[ "$#" -gt 0 ] || { echo "minio-provision: no buckets given" >&2; exit 1; }

ENDPOINT="${STORAGE_ENDPOINT:-http://localhost:9000}"
KEY="${STORAGE_ACCESS_KEY_ID:-minioadmin}"
SECRET="${STORAGE_SECRET_ACCESS_KEY:-minioadmin}"

# Resolve the docker binary — Docker Desktop isn't always symlinked onto PATH
# (matches the resolver in scripts/worktree/create.sh). Without this, the
# readiness probe below fails with command-not-found and misreports the
# endpoint as unreachable.
if command -v docker >/dev/null 2>&1; then
  DOCKER="docker"
elif [ -x /Applications/Docker.app/Contents/Resources/bin/docker ]; then
  DOCKER="/Applications/Docker.app/Contents/Resources/bin/docker"
else
  echo "  MinIO: docker binary not found — skipping bucket provisioning." >&2
  exit 0
fi

# Inside a container, localhost means the container — rewrite to host.docker.internal
# so we reach the host-published minio port (works on Docker Desktop + Linux via
# the --add-host gateway below).
HOST_ENDPOINT="$(echo "$ENDPOINT" | sed -E 's#://(localhost|127\.0\.0\.1)#://host.docker.internal#')"
SCHEME="${HOST_ENDPOINT%%://*}"
HOSTPORT="${HOST_ENDPOINT#*://}"

mc() {
  "$DOCKER" run --rm --add-host=host.docker.internal:host-gateway \
    -e MC_HOST_local="${SCHEME}://${KEY}:${SECRET}@${HOSTPORT}" \
    minio/mc:latest "$@"
}

# Wait for the endpoint to accept requests (mc ls succeeds on an empty server).
ready=0
for _ in $(seq 1 30); do
  if mc ls local >/dev/null 2>&1; then ready=1; break; fi
  sleep 1
done
if [ "$ready" -ne 1 ]; then
  echo "  MinIO: ${ENDPOINT} not reachable — skipping bucket provisioning." >&2
  exit 0
fi

for bucket in "$@"; do
  mc mb --ignore-existing "local/${bucket}" >/dev/null 2>&1 || true
done
echo "  MinIO: ensured ${#} bucket(s) on ${ENDPOINT} — $*"
