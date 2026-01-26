#!/bin/bash
set -e

ENV=$1
APP=$2
shift 2

if [ -z "$ENV" ] || [ -z "$APP" ]; then
    echo "Usage: $0 <env> <app> [command...]"
    echo "Envs: local, test, dev, staging, sandbox, prod"
    echo "Apps: api, web, admin, superadmin"
    exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$SCRIPT_DIR/../.."
APP_DIR="$ROOT_DIR/apps/$APP"

export ROOT_DIR APP_DIR ENV APP

cd "$APP_DIR"

exec "$SCRIPT_DIR/doppler-env.sh" "$ENV" "$APP" \
    bash -c '
        [ -f "$ROOT_DIR/.env.$ENV" ] && { set -a; source "$ROOT_DIR/.env.$ENV"; set +a; }
        [ -f "$APP_DIR/.env.$ENV" ] && { set -a; source "$APP_DIR/.env.$ENV"; set +a; }
        exec "$@"
    ' bash "$@"
