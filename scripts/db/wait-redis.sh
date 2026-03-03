#!/bin/bash
set -e

PROJECT_NAME=${PROJECT_NAME:-template}

timeout=30
while ! docker exec ${PROJECT_NAME}_redis redis-cli ping 2>/dev/null | grep -q PONG; do
  sleep 1
  ((timeout--))
  [ $timeout -le 0 ] && { echo "Error: Redis timeout"; exit 1; }
done
