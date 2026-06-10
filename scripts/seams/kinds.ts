// DEV-003 — closed set of @kind values (a file's architectural role).
// `@kind` answers "what is this?". One per file. Mostly derivable from path
// (see deriveFromPath); declared/overloaded only where path can't classify it.
//
// Role and seam are orthogonal: a db mutation-lifecycle "hook" is a
// `@kind handler @partOf primitive:mutation-lifecycle`, never a fused kind.
// `hook` here means a React hook (frontend) — the universal meaning.

export const KINDS = [
  // ── backend / shared ────────────────────────────────────────────────────
  'controller', // request handler in modules/*/controllers
  'route', // route definition in modules/*/routes
  'routeTemplate', // readRoute/createRoute/… in lib/routeTemplates
  'middleware', // middleware/*
  'handler', // handler — pair with @partOf (jobs, app-events, db mutation hooks)
  'helper', // small focused helper bound to a seam (vs generic `utils`)
  'service', // domain logic in modules/*/services and internal module parts
  'schema', // request/response schemas in modules/*/schemas
  'validator', // modules/*/validations
  'transformer', // value/shape transformers (serialize, normalize, project)
  'integration', // external-service integration
  'factory', // test factory (packages/db/src/test/factories)
  'constructor', // make*() factory producing a category of thing; pair with @constructs
  'registry', // a declarative config table (the registry pattern)
  'primitive', // a reusable building block's own implementation
  'infrastructure', // connection/client to an external dependency (redis, prisma, s3…)
  'entrypoint', // the way into a seam (ws/index, app bootstrap)
  'config', // configuration / env wiring
  'seed', // db seed
  'utils', // generic helper; also the catch-all when path can't classify

  // ── frontend ──────────────────────────────────────────────────────────────
  'component', // reusable React component (packages/ui/src/components, app components)
  'page', // page/view component (packages/ui/src/pages, apps/*/app routes)
  'hook', // React hook (use*) — packages/ui/src/hooks
  'store', // zustand store/slice (packages/ui/src/store)
] as const;

export type Kind = (typeof KINDS)[number];

export const isKind = (value: string): value is Kind => (KINDS as readonly string[]).includes(value);
