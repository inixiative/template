# s3.sh — sourced by minio-provision.sh and minio-remove.sh: signed S3 calls with curl.
#
# Talks to the published STORAGE_ENDPOINT directly with SigV4 (curl --aws-sigv4,
# curl >= 7.75), so no MinIO client image is needed: minio/mc and minio/minio
# are no longer pullable from Docker Hub, and any S3-compatible server on the
# endpoint works the same.
ENDPOINT="${STORAGE_ENDPOINT:-http://localhost:9000}"
KEY="${STORAGE_ACCESS_KEY_ID:-minioadmin}"
SECRET="${STORAGE_SECRET_ACCESS_KEY:-minioadmin}"
REGION="${STORAGE_REGION:-us-east-1}"

# s3 <method> <path> — sets S3_BODY (the response body) and S3_STATUS (the HTTP status, 000 when
# the endpoint did not answer). Variables, not stdout: a command substitution would lose S3_STATUS.
s3() {
  local out
  local method=(-X "$1")
  # -X HEAD would wait for a body that never comes.
  [ "$1" = HEAD ] && method=(--head)
  out="$(curl -sS "${method[@]}" --aws-sigv4 "aws:amz:${REGION}:s3" --user "${KEY}:${SECRET}" \
    -w '\n%{http_code}' "${ENDPOINT%/}$2" 2>/dev/null)" || { S3_BODY=""; S3_STATUS=000; return 0; }
  S3_STATUS="${out##*$'\n'}"
  S3_BODY="${out%$'\n'*}"
}

# s3_ready — the endpoint answers a signed ListBuckets within 30 seconds. Returns 1 when nothing
# answered, 2 when it answered with an error (bad credentials, wrong region): that is never retried.
s3_ready() {
  if ! curl --help all 2>/dev/null | grep -q -- '--aws-sigv4'; then
    echo "  MinIO: this curl has no --aws-sigv4 (needs curl >= 7.75)." >&2
    return 2
  fi
  for _ in $(seq 1 30); do
    s3 GET /
    [ "$S3_STATUS" = 200 ] && return 0
    if [ "$S3_STATUS" != 000 ]; then
      echo "  MinIO: ${ENDPOINT} refused the signed request (HTTP ${S3_STATUS} $(s3_error_code))." >&2
      return 2
    fi
    sleep 1
  done
  return 1
}

# s3_error_code — the <Code> of the last S3 error response (e.g. SignatureDoesNotMatch).
s3_error_code() {
  printf '%s' "$S3_BODY" | sed -n 's/.*<Code>\([^<]*\)<\/Code>.*/\1/p' | head -n 1
}

# s3_bucket_exists <bucket>
s3_bucket_exists() {
  s3 HEAD "/$1"
  [ "$S3_STATUS" = 200 ]
}

# s3_empty_bucket <bucket> — deletes every object, a page (up to 1000 keys) at a time.
# encoding-type=url returns each key percent-encoded (spaces as '+'), so it goes into the DELETE
# path as is, whatever bytes it holds.
s3_empty_bucket() {
  local key previous=""
  for _ in $(seq 1 1000); do
    s3 GET "/$1?list-type=2&encoding-type=url"
    [ "$S3_STATUS" = 200 ] || return 1
    case "$S3_BODY" in *"<Key>"*) ;; *) return 0 ;; esac
    # The same page twice: its deletes failed, so stop rather than spin.
    [ "$S3_BODY" = "$previous" ] && return 1
    previous="$S3_BODY"
    while IFS= read -r key; do
      s3 DELETE "/$1/${key//+/%20}"
    done < <(printf '%s' "$S3_BODY" | grep -o '<Key>[^<]*</Key>' | sed -e 's/^<Key>//' -e 's#</Key>$##')
  done
  return 1
}
