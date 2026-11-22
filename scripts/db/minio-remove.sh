#!/usr/bin/env bash
# minio-remove.sh — remove S3/MinIO buckets and everything in them (worktree:destroy).
#
# Same endpoint and signed calls as minio-provision.sh (s3.sh). Exits non-zero when
# the endpoint is unreachable or a bucket is still present afterwards.
#
# Usage:  minio-remove.sh <bucket> [<bucket> ...]
set -euo pipefail

[ "$#" -gt 0 ] || { echo "minio-remove: no buckets given" >&2; exit 1; }

# shellcheck source=scripts/db/s3.sh
. "$(dirname "$0")/s3.sh"

if ! s3_ready; then
  echo "  MinIO: ${ENDPOINT} not usable — buckets NOT removed: $*" >&2
  exit 1
fi

failed=0
for bucket in "$@"; do
  if ! s3_bucket_exists "$bucket"; then
    echo "  MinIO: ${bucket} was already absent"
    continue
  fi
  s3_empty_bucket "$bucket" || true
  s3 DELETE "/${bucket}"
  if s3_bucket_exists "$bucket"; then
    echo "  MinIO: could NOT remove ${bucket} (still present)" >&2
    failed=1
  else
    echo "  MinIO: removed ${bucket}"
  fi
done
exit "$failed"
