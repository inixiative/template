#!/bin/bash
set -e

ENV=$1
APP=$2
shift 2

if [ -z "$ENV" ] || [ -z "$APP" ]; then
    echo "Usage: $0 <env> <app> [command...]"
    echo "Envs: local, test, pr, staging, prod"
    echo "Apps: api, web, admin, superadmin"
    exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$SCRIPT_DIR/../.."
APP_DIR="$ROOT_DIR/apps/$APP"

export ROOT_DIR APP_DIR ENV APP

# Use Infisical for all environments except test
# test uses .env.test files
if [ "$ENV" != "test" ]; then
    # Check if Infisical is configured
    if command -v infisical &> /dev/null; then
        # Get projectId from project config using locate-config utility
        CONFIG_FILE=$(bash "$SCRIPT_DIR/locate-config.sh")

        PROJECT_ID=$(cd "$ROOT_DIR" && bun -e "import {projectConfig} from './$CONFIG_FILE'; console.log(projectConfig.infisical.projectId)" 2>/dev/null)

        if [ -n "$PROJECT_ID" ]; then
            # Map local and pr to staging in Infisical
            INFISICAL_ENV="$ENV"
            if [ "$ENV" = "local" ] || [ "$ENV" = "pr" ]; then
                INFISICAL_ENV="staging"
            fi

            # Run with Infisical using path-based structure
            # Fetches from env:/app/ which inherits from:
            #   1. root:/
            #   2. root:/app/
            #   3. env:/
            #   4. env:/app/ (local secrets)
            exec infisical run --projectId="$PROJECT_ID" --env="$INFISICAL_ENV" --path="/$APP" --include-imports -- "$@"
        fi
    fi
fi

# Fallback to .env files (local, test, or when Infisical not configured)
bash -c '
    [ -f "$ROOT_DIR/.env.$ENV" ] && { set -a; source "$ROOT_DIR/.env.$ENV"; set +a; }
    [ -f "$APP_DIR/.env.$ENV" ] && { set -a; source "$APP_DIR/.env.$ENV"; set +a; }
    exec "$@"
' bash "$@"
