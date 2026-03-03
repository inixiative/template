#!/bin/bash
set -e

PROJECT_NAME=${PROJECT_NAME:-template}

timeout=30
while ! docker exec ${PROJECT_NAME}_postgres pg_isready -U postgres -q 2>/dev/null; do
  sleep 1
  ((timeout--))
  [ $timeout -le 0 ] && { echo "Error: PostgreSQL timeout"; exit 1; }
done
