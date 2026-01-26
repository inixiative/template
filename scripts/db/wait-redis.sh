#!/bin/bash
set -e

timeout=30
while ! docker exec template-redis redis-cli ping 2>/dev/null | grep -q PONG; do
  sleep 1
  ((timeout--))
  [ $timeout -le 0 ] && { echo "Error: Redis timeout"; exit 1; }
done
