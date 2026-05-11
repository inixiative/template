# @template/sdk

Auto-generated TypeScript SDK for the apps/api OpenAPI surface. Hey-api
(`@hey-api/openapi-ts`) reads `openapi.gen.json` and emits typed clients,
schemas, and React-Query helpers into `src/`.

## Why this is a standalone package

It's not consumed by only one workspace — both `packages/ui` (browser
React-Query usage) and worker processes (any new app that needs to
call apps/api's internal routes) can use it. Extracting it out of
`packages/ui` removed the awkward "Node worker imports from a UI
package" coupling and gave us a clean place for SDK-only generation
config.

It's also intentionally publishable. There's nothing template-specific
or internal here — just types + a thin client that wraps `fetch`. If a
downstream project wants external consumers (third-party integrations,
customer SDKs, public docs) the package is already shaped for that.
See [Future: publishing publicly](#future-publishing-publicly).

## Refreshing the spec + regenerating

Spec lives in `openapi.gen.json` (committed). Two ways to refresh:

```bash
# From apps/api (writes spec + copies to packages/sdk/openapi.gen.json)
bun run --cwd apps/api generate:openapi

# Then regenerate the SDK from the new spec
bun run --cwd packages/sdk generate:sdk
```

Or run the chained script that does both:

```bash
bash scripts/generate-sdk.sh
```

Generated files (`src/*.gen.ts`, `src/client/*`, `src/core/*`,
`src/@tanstack/*`) are committed — turbo cache assumes they're checked
in so apps don't have to regen on `bun install`.

## Future: publishing publicly

Not needed by default, but the package is structured for it. Notes for
when a downstream project wants to publish:

- **Internal-vs-public route split** is the hard part. `/api/internal/*`
  routes (shared-secret auth, used by workers) must NOT ship in a
  public SDK. Either filter by the `internal: true` route tag at
  generation time, or emit two separate spec snapshots
  (`openapi.public.gen.json` + `openapi.internal.gen.json`) and
  generate two SDK outputs (`@<org>/sdk` + `@<org>/sdk/internal`).
- **Auth model for external users** is OAuth + bearer tokens via the
  existing `/api/v1/...` routes, NOT `INTERNAL_SHARED_SECRET`.
- **Publish flow**: drop `"private": true`, add `"publishConfig": {
  "access": "public" }`, add `prepublishOnly` that re-runs
  `generate:sdk` against a pinned apps/api version.
- **Package name**: pick the npm org first before doing any of the
  above.
