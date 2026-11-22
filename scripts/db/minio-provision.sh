#!/usr/bin/env bash
# minio-provision.sh — idempotently ensure S3/MinIO buckets exist.
#
# Targets the *published* STORAGE_ENDPOINT (default http://localhost:9000) with
# signed S3 calls (s3.sh), NOT a per-project compose network. That matters
# because the dev model shares one minio across the main checkout and its
# worktrees (and can even be a sibling project's container) — so "which compose
# network" is the wrong question; "what's on the endpoint the app actually
# uses" is the right one.
#
# Usage:  minio-provision.sh <bucket> [<bucket> ...]
#   Reads STORAGE_ENDPOINT / STORAGE_ACCESS_KEY_ID / STORAGE_SECRET_ACCESS_KEY /
#   STORAGE_REGION from the environment (sensible local defaults if unset).
set -euo pipefail

[ "$#" -gt 0 ] || { echo "minio-provision: no buckets given" >&2; exit 1; }

# shellcheck source=scripts/db/s3.sh
. "$(dirname "$0")/s3.sh"

ready=0
s3_ready || ready=$?
if [ "$ready" -eq 1 ]; then
  echo "  MinIO: ${ENDPOINT} not reachable — skipping bucket provisioning." >&2
  exit 0
fi
[ "$ready" -eq 0 ] || { echo "  MinIO: buckets NOT created: $*" >&2; exit 1; }

failed=0
for bucket in "$@"; do
  s3 PUT "/${bucket}"
  [ "$S3_STATUS" = 200 ] && continue
  # Already ours. Any other 409 (BucketAlreadyExists: someone else's) is a failure.
  [ "$S3_STATUS" = 409 ] && [ "$(s3_error_code)" = BucketAlreadyOwnedByYou ] && continue
  echo "  MinIO: could NOT create ${bucket} (HTTP ${S3_STATUS} $(s3_error_code))" >&2
  failed=1
done
[ "$failed" -eq 0 ] && echo "  MinIO: ensured ${#} bucket(s) on ${ENDPOINT} — $*"
exit "$failed"
