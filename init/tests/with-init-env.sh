#!/bin/bash
set -e

# Pull real API credentials from Infisical and project config,
# export them, then exec the trailing command.
#
# Usage (composed in package.json):
#   bash init/tests/with-init-env.sh bun test init/tasks/tests/
#
# To also wipe existing fixtures first:
#   CLEAR_FIXTURES=1 bash init/tests/with-init-env.sh bun test init/tasks/tests/

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$SCRIPT_DIR/../.."
FIXTURES_DIR="$SCRIPT_DIR/fixtures"

# Source .env.init for USE_INTERNAL_CONFIG and other init-specific vars
if [ -f "$ROOT_DIR/.env.init" ]; then
    set -a
    source "$ROOT_DIR/.env.init"
    set +a
fi

# Clear fixtures if requested
if [ "$CLEAR_FIXTURES" = "1" ]; then
    echo "Clearing existing fixtures..."
    find "$FIXTURES_DIR" -name "*.json" -delete 2>/dev/null || true
    echo "Done."
fi

# Resolve Infisical project ID from config
CONFIG_FILE=$(bash "$ROOT_DIR/scripts/deployment/locate-config.sh" 2>/dev/null || echo "project.config.ts")
PROJECT_ID=$(cd "$ROOT_DIR" && bun -e "import {projectConfig} from './$CONFIG_FILE'; console.log(projectConfig.infisical.projectId)" 2>/dev/null)

if [ -z "$PROJECT_ID" ]; then
    echo "Error: Could not resolve Infisical project ID from config"
    exit 1
fi

echo "Pulling credentials from Infisical (project: $PROJECT_ID)..."

get_secret() {
    infisical secrets get "$1" --env="${2:-root}" --path="${3:-/}" --projectId="$PROJECT_ID" --plain 2>/dev/null || echo ""
}

# Pull secrets
export PLANETSCALE_TOKEN_ID=$(get_secret PLANETSCALE_TOKEN_ID)
export PLANETSCALE_TOKEN=$(get_secret PLANETSCALE_TOKEN)
export RAILWAY_WORKSPACE_TOKEN=$(get_secret RAILWAY_WORKSPACE_TOKEN)
export VERCEL_API_TOKEN=$(get_secret VERCEL_API_TOKEN)
export VERCEL_TEAM_ID=$(get_secret VERCEL_TEAM_ID)

# Get Infisical org ID from JWT
INFISICAL_ORG_ID=""
TOKEN=$(infisical user get token 2>/dev/null || echo "")
if [ -n "$TOKEN" ]; then
    INFISICAL_ORG_ID=$(echo "$TOKEN" | cut -d. -f2 | base64 -d 2>/dev/null | python3 -c "import sys,json; print(json.load(sys.stdin).get('organizationId',''))" 2>/dev/null || echo "")
fi
export INFISICAL_PROJECT_ID="$PROJECT_ID"
export INFISICAL_ORG_ID

# Pull IDs from project config
eval "$(cd "$ROOT_DIR" && bun -e "
import {projectConfig} from './$CONFIG_FILE';
const r = projectConfig.railway;
const v = projectConfig.vercel;
const ps = projectConfig.planetscale;
const lines = [
  'export RAILWAY_PROJECT_ID=' + JSON.stringify(r.projectId),
  'export RAILWAY_WORKSPACE_ID=' + JSON.stringify(r.workspaceId),
  'export RAILWAY_PROD_ENVIRONMENT_ID=' + JSON.stringify(r.prodEnvironmentId),
  'export RAILWAY_STAGING_ENVIRONMENT_ID=' + JSON.stringify(r.stagingEnvironmentId),
  'export RAILWAY_PROD_API_SERVICE_ID=' + JSON.stringify(r.prodApiServiceId),
  'export RAILWAY_STAGING_API_SERVICE_ID=' + JSON.stringify(r.stagingApiServiceId),
  'export RAILWAY_PROD_WORKER_SERVICE_ID=' + JSON.stringify(r.prodWorkerServiceId),
  'export RAILWAY_STAGING_WORKER_SERVICE_ID=' + JSON.stringify(r.stagingWorkerServiceId),
  'export RAILWAY_PROD_REDIS_SERVICE_ID=' + JSON.stringify(r.prodRedisServiceId),
  'export RAILWAY_STAGING_REDIS_SERVICE_ID=' + JSON.stringify(r.stagingRedisServiceId),
  'export RAILWAY_PROD_REDIS_VOLUME_ID=' + JSON.stringify(r.prodRedisVolumeId),
  'export RAILWAY_STAGING_REDIS_VOLUME_ID=' + JSON.stringify(r.stagingRedisVolumeId),
  'export VERCEL_TEAM_ID=' + JSON.stringify(v.teamId),
  'export VERCEL_TEAM_NAME=' + JSON.stringify(v.teamName),
  'export PLANETSCALE_ORG=' + JSON.stringify(ps.organization),
  'export PLANETSCALE_REGION=' + JSON.stringify(ps.region),
];
for (const l of lines) console.log(l);
" 2>/dev/null)"

echo "Credentials loaded. Running: $@"
exec "$@"
