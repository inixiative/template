#!/bin/bash
set -e

timeout=30
while ! docker exec template-postgres pg_isready -U postgres -q 2>/dev/null; do
  sleep 1
  ((timeout--))
  [ $timeout -le 0 ] && { echo "Error: PostgreSQL timeout"; exit 1; }
done
