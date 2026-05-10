#!/bin/bash
# Runs once on first postgres container creation. The main DB ($POSTGRES_DB,
# wired from docker-compose's ${PROJECT_NAME}) is auto-created by the postgres
# entrypoint — we only need to add the matching test DB next to it.
#
# Project-name-agnostic: works for template (template_test) and any fork
# (e.g. tribe → tribe_test) without per-project edits.
set -e

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-EOSQL
  CREATE DATABASE "${POSTGRES_DB}_test";
EOSQL
