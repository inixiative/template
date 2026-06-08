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

# FOOTGUN (do not "fix" by erroring when infisical is missing — that breaks
# every build): the `command -v infisical` guard is load-bearing. Vercel/Railway/
# CI builds run this (e.g. generate:sdk via `with local api`) with NO infisical
# CLI and rely on injected env / .env files. If the CLI is absent we MUST skip to
# .env composition, never exit non-zero.
# When the CLI IS present + a projectId is configured (local dev), infisical is the
# source of truth: don't silently fall back to .env, and fail loudly if the dev
# isn't logged in (probe below) rather than running against missing secrets.
if [ "$ENV" != "test" ] && command -v infisical &> /dev/null; then
    PROJECT_ID=$(bash "$SCRIPT_DIR/read-project-config.sh" infisical.projectId)

    if [ -n "$PROJECT_ID" ]; then
        STAGING_ENABLED=$(bash "$SCRIPT_DIR/read-project-config.sh" features.staging.enabled)

        INFISICAL_ENV="$ENV"
        if [ "$ENV" = "local" ] || [ "$ENV" = "pr" ]; then
            # When staging isn't configured, local/pr inherit from prod secrets
            # (that's all there is). When staging IS configured, they pull from
            # staging so devs don't accidentally read prod.
            if [ "$STAGING_ENABLED" = "true" ]; then
                INFISICAL_ENV="staging"
            else
                INFISICAL_ENV="prod"
            fi
        fi

        # Probe auth with a no-op so a logged-out shell gets a clear error
        # instead of infisical's cryptic interactive-login failure.
        if ! infisical run --projectId="$PROJECT_ID" --env="$INFISICAL_ENV" --path="/$APP" -- true </dev/null >/dev/null 2>&1; then
            echo "ERROR: not authenticated with Infisical (env '$INFISICAL_ENV', path '/$APP')." >&2
            echo "Run 'infisical login' and try again." >&2
            exit 1
        fi

        # Infisical injects first, then run_with_env_overrides sources .env
        # files which overwrite any Infisical-set vars by the same name.
        export -f run_with_env_overrides
        exec infisical run --projectId="$PROJECT_ID" --env="$INFISICAL_ENV" --path="/$APP" --include-imports -- bash -c 'run_with_env_overrides "$@"' bash "$@"
    fi
fi

# Test env, or a project that doesn't use Infisical (no projectId): just .env files.
run_with_env_overrides "$@"
