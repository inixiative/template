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

# Use Infisical for cloud environments (dev, staging, sandbox, prod)
# Use .env files for local/test environments
if [ "$ENV" != "local" ] && [ "$ENV" != "test" ]; then
    # Check if Infisical is configured
    if command -v infisical &> /dev/null && [ -f "$ROOT_DIR/.infisical.json" ]; then
        # Get domain from config if self-hosted
        DOMAIN_FLAG=""
        if grep -q '"domain"' "$ROOT_DIR/.infisical.json"; then
            DOMAIN=$(jq -r '.domain // empty' "$ROOT_DIR/.infisical.json")
            if [ -n "$DOMAIN" ] && [ "$DOMAIN" != "https://app.infisical.com" ]; then
                DOMAIN_FLAG="--domain=$DOMAIN"
            fi
        fi

        # Run with Infisical
        exec infisical run --env="$ENV" $DOMAIN_FLAG -- "$@"
    fi
fi

# Fallback to .env files (local, test, or when Infisical not configured)
bash -c '
    [ -f "$ROOT_DIR/.env.$ENV" ] && { set -a; source "$ROOT_DIR/.env.$ENV"; set +a; }
    [ -f "$APP_DIR/.env.$ENV" ] && { set -a; source "$APP_DIR/.env.$ENV"; set +a; }
    exec "$@"
' bash "$@"
