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

# Compose env in this order:
#   1. Infisical secrets for this env+app (base layer — if configured)
#   2. .env.$ENV at root            ← overwrites Infisical
#   3. apps/$APP/.env.$ENV          ← overwrites root .env.$ENV
#
# Infisical is the source of truth for cloud secrets; .env files are local
# overrides that take precedence so a developer can point at local Docker
# (DATABASE_URL=...localhost:5432...) without changing what staging/prod
# in Infisical points at. Test env skips Infisical entirely.

# Helper that runs the user's command with .env.$ENV files overlaid on top
# of whatever env it inherits (which already includes any Infisical injection).
run_with_env_overrides() {
    bash -c '
        set -a
        [ -f "$ROOT_DIR/.env.$ENV" ] && source "$ROOT_DIR/.env.$ENV"
        [ -f "$APP_DIR/.env.$ENV" ] && source "$APP_DIR/.env.$ENV"
        set +a
        exec "$@"
    ' bash "$@"
}

if [ "$ENV" != "test" ]; then
    if command -v infisical &> /dev/null; then
        CONFIG_FILE=$(bash "$SCRIPT_DIR/locate-config.sh")
        PROJECT_ID=$(cd "$ROOT_DIR" && bun -e "import {projectConfig} from './$CONFIG_FILE'; console.log(projectConfig.infisical.projectId)" 2>/dev/null)

        if [ -n "$PROJECT_ID" ]; then
            INFISICAL_ENV="$ENV"
            if [ "$ENV" = "local" ] || [ "$ENV" = "pr" ]; then
                INFISICAL_ENV="staging"
            fi

            # Infisical injects first, then run_with_env_overrides sources .env
            # files which overwrite any Infisical-set vars by the same name.
            export -f run_with_env_overrides
            exec infisical run --projectId="$PROJECT_ID" --env="$INFISICAL_ENV" --path="/$APP" --include-imports -- bash -c 'run_with_env_overrides "$@"' bash "$@"
        fi
    fi
fi

# No Infisical (test env, or not configured): just .env files.
run_with_env_overrides "$@"
