#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="${1:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)}"
cd "$ROOT_DIR"

# Route definitions write parameters the OpenAPI way, {id}. @hono/zod-openapi
# turns them into Hono's :id when it registers the route; a :id written here
# skips that and lands in the spec, the SDK and every reader of the spec.
#
# Hono's own runtime paths (app.get('/x/:id'), c.req.routePath) stay :id.
#
# {id} is the only parameter for now. A route that needs another one (e.g. a
# parent's id for COPPA / parental-consent routes) widens ALLOWED_PARAMS here
# in the same change, after checking every reader of the spec handles it.
ALLOWED_PARAMS="id"
VIOLATIONS=""
if [[ -d apps/api ]]; then
  VIOLATIONS=$(
    {
      grep -rEn "path: *['\"\`][^'\"\`]*/:[A-Za-z_]" apps/api --include='*.ts' --exclude-dir=node_modules 2>/dev/null || true
      if [[ -d apps/api/src/lib/routeTemplates ]]; then
        grep -rEn "(['\"\`]|/):[A-Za-z_]" apps/api/src/lib/routeTemplates --include='*.ts' --exclude='*.test.ts' 2>/dev/null || true
      fi
    } | sort -u
  )
fi

if [[ -n "$VIOLATIONS" ]]; then
  echo "Found :param segments in route definitions:"
  echo "Write {param} — @hono/zod-openapi converts it to :param for Hono and keeps"
  echo "{param} in the OpenAPI spec."
  echo ""
  echo "$VIOLATIONS"
  exit 1
fi

OTHER_PARAMS=""
if [[ -d apps/api ]]; then
  OTHER_PARAMS=$(
    {
      grep -rEn "path: *['\"\`][^'\"\`]*/\{[A-Za-z_]+\}" apps/api --include='*.ts' --exclude-dir=node_modules 2>/dev/null || true
      if [[ -d apps/api/src/lib/routeTemplates ]]; then
        grep -rEn "(['\"\`]|/)\{[A-Za-z_]+\}" apps/api/src/lib/routeTemplates --include='*.ts' --exclude='*.test.ts' 2>/dev/null || true
      fi
    } | sort -u | awk -v allowed="$ALLOWED_PARAMS" '
      {
        line = $0
        n = split(allowed, names, " ")
        for (i = 1; i <= n; i++) gsub("\\{" names[i] "\\}", "", line)
        if (line ~ /[\x27"`\/]\{[A-Za-z_]+\}/) print $0
      }'
  )
fi

if [[ -n "$OTHER_PARAMS" ]]; then
  echo "Found route parameters other than {$ALLOWED_PARAMS}:"
  echo "Only {$ALLOWED_PARAMS} is allowed for now; widen ALLOWED_PARAMS in this rule"
  echo "in the change that needs another parameter."
  echo ""
  echo "$OTHER_PARAMS"
  exit 1
fi

echo "No :param segments or parameters other than {$ALLOWED_PARAMS} in route definitions."
