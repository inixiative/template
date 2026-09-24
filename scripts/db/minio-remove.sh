set -euo pipefail

[ "$#" -gt 0 ] || { echo "minio-remove: no buckets given" >&2; exit 1; }

ENDPOINT="${STORAGE_ENDPOINT:-http://localhost:9000}"
KEY="${STORAGE_ACCESS_KEY_ID:-minioadmin}"
SECRET="${STORAGE_SECRET_ACCESS_KEY:-minioadmin}"

if command -v docker >/dev/null 2>&1; then
  DOCKER="docker"
elif [ -x /Applications/Docker.app/Contents/Resources/bin/docker ]; then
  DOCKER="/Applications/Docker.app/Contents/Resources/bin/docker"
else
  echo "  MinIO: docker binary not found — buckets NOT removed: $*" >&2
  exit 1
fi

HOST_ENDPOINT="$(echo "$ENDPOINT" | sed -E 's#://(localhost|127\.0\.0\.1)#://host.docker.internal#')"
SCHEME="${HOST_ENDPOINT%%://*}"
HOSTPORT="${HOST_ENDPOINT#*://}"

mc() {
  "$DOCKER" run --rm --add-host=host.docker.internal:host-gateway \
    -e MC_HOST_local="${SCHEME}://${KEY}:${SECRET}@${HOSTPORT}" \
    minio/mc:latest "$@"
}

if ! mc ls local >/dev/null 2>&1; then
  echo "  MinIO: ${ENDPOINT} not reachable — buckets NOT removed: $*" >&2
  exit 1
fi

bucket_exists() {
  mc ls "local/${1}" >/dev/null 2>&1
}

failed=0
for bucket in "$@"; do
  if ! bucket_exists "$bucket"; then
    echo "  MinIO: ${bucket} was already absent"
    continue
  fi
  mc rb --force "local/${bucket}" >/dev/null 2>&1 || true
  if bucket_exists "$bucket"; then
    echo "  MinIO: could NOT remove ${bucket} (still present)" >&2
    failed=1
  else
    echo "  MinIO: removed ${bucket}"
  fi
done
exit "$failed"
