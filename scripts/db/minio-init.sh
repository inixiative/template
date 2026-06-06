#!/bin/sh
# Runs INSIDE the minio container as the entrypoint. Parallels pg-init.sh:
# config-as-script kept beside the docker-compose service, not inlined as
# multi-line YAML.
#
# Why mkdir is enough: in MinIO's filesystem (standalone) mode, any subdirectory
# of the data dir is exposed as a bucket via the S3 API. So `mkdir -p` is the
# minio equivalent of `CREATE DATABASE IF NOT EXISTS` — idempotent on every boot.
#
# Per-worktree buckets (${PROJECT}-system-wt-<slot>, etc.) are created by
# scripts/worktree/create.sh after the worktree is provisioned — not here.
set -e

mkdir -p \
  "/data/${PROJECT}-system" \
  "/data/${PROJECT}-user" \
  "/data/${PROJECT}-system-test" \
  "/data/${PROJECT}-user-test"

exec minio server /data --console-address ":9001"
