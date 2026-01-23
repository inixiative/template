#!/bin/bash
# doppler-env.sh - Load environment variables from Doppler
# Usage: ./scripts/deployment/doppler-env.sh <environment> [command...]
# Example: ./scripts/deployment/doppler-env.sh develop npm run start

set -e

ENVIRONMENT=$1
shift # Remove first argument, rest is the command to run

if [ -z "$ENVIRONMENT" ]; then
    echo "Error: Environment required" >&2
    echo "Usage: $0 <environment> [command...]" >&2
    echo "Environments: local, test, develop, staging, production" >&2
    exit 1
fi

# Map environment names to Doppler configs
case "$ENVIRONMENT" in
    production)
        DOPPLER_CONFIG="production"
        ;;
    local)
        # Local uses develop config from Doppler
        DOPPLER_CONFIG="develop"
        ;;
    develop|staging|sandbox)
        DOPPLER_CONFIG="$ENVIRONMENT"
        ;;
    test)
        # Test doesn't use Doppler - just pass through
        if [ $# -gt 0 ]; then
            exec "$@"
        else
            exit 0
        fi
        ;;
    *)
        echo "Unknown environment: $ENVIRONMENT" >&2
        exit 1
        ;;
esac

# Check if we have a DOPPLER_TOKEN (for CI/CD)
if [ -n "$DOPPLER_TOKEN" ]; then
    echo "📦 Using Doppler service token" >&2
fi

# Use Doppler if available and configured
if [ -n "$DOPPLER_CONFIG" ] && command -v doppler &> /dev/null; then
    if doppler configure get project &> /dev/null; then
        echo "📦 Loading from Doppler config: $DOPPLER_CONFIG" >&2
        if [ $# -gt 0 ]; then
            # Run command with Doppler
            exec doppler run --project inixiative --config "$DOPPLER_CONFIG" -- "$@"
        else
            # Export Doppler vars for composition (when sourced)
            doppler secrets download --project inixiative --config "$DOPPLER_CONFIG" --no-file --format env
        fi
    else
        echo "⚠️  Warning: Doppler not configured for this project" >&2
        if [ $# -gt 0 ]; then
            exec "$@"
        fi
    fi
else
    # No Doppler needed or available
    if [ $# -gt 0 ]; then
        exec "$@"
    fi
fi
