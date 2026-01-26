#!/bin/bash

API_URL="${API_URL:-http://localhost:8000}"
MAX_ATTEMPTS=30
ATTEMPT=0

echo "Waiting for API at $API_URL/health..."

until curl -sf "$API_URL/health" > /dev/null 2>&1; do
  ATTEMPT=$((ATTEMPT + 1))
  if [ $ATTEMPT -ge $MAX_ATTEMPTS ]; then
    echo "API did not start after $MAX_ATTEMPTS attempts"
    exit 1
  fi
  echo "  Attempt $ATTEMPT/$MAX_ATTEMPTS..."
  sleep 1
done

echo "API is ready!"
