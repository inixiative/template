#!/bin/bash
set -e

ENV=$1
APP=${2:-}
shift
[ -n "$APP" ] && shift

if [ -z "$ENV" ]; then
    echo "Usage: $0 <env> [app] [command...]"
    exit 1
fi

case "$ENV" in
    local|test)
        [ $# -gt 0 ] && exec "$@"
        exit 0
        ;;
    dev|staging|sandbox|prod)
        if [ -n "$APP" ]; then
            DOPPLER_CONFIG="${ENV}_${APP}"
        else
            DOPPLER_CONFIG="$ENV"
        fi
        ;;
    *)
        echo "Unknown env: $ENV"
        exit 1
        ;;
esac

if command -v doppler &> /dev/null && doppler configure get project &> /dev/null 2>&1; then
    [ $# -gt 0 ] && exec doppler run --config "$DOPPLER_CONFIG" -- "$@"
    doppler secrets download --config "$DOPPLER_CONFIG" --no-file --format env
else
    [ $# -gt 0 ] && exec "$@"
fi
