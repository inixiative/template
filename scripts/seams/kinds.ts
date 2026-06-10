// DEV-003 — closed set of @kind values (a file's architectural role).
// `@kind` answers "what is this?". One per file. Mostly derivable from path
// (see deriveFromPath); declared/overloaded only where path can't classify it.

export const KINDS = [
  'controller', // request handler in modules/*/controllers
  'route', // route definition in modules/*/routes
  'route-template', // readRoute/createRoute/… in lib/routeTemplates
  'middleware', // middleware/*
  'hook', // mutation-lifecycle hooks in hooks/*
  'job', // BullMQ job handler in jobs/handlers
  'app-event-handler', // appEvents/handlers/*
  'service', // domain logic in modules/*/services and internal module parts
  'schema', // request/response schemas in modules/*/schemas
  'validation', // modules/*/validations
  'integration', // external-service integration
  'factory', // test factory (packages/db/src/test/factories)
  'constructor', // a make*() factory that produces a category of thing; pair with @constructs
  'primitive', // a reusable building block's own implementation
  'infrastructure', // connection/client to an external dependency (redis, s3…)
  'utils', // generic helper; also the catch-all when path can't classify
  'entrypoint', // the way into a seam (ws/index, app bootstrap)
  'config', // configuration / env wiring
  'seed', // db seed
] as const;

export type Kind = (typeof KINDS)[number];

export const isKind = (value: string): value is Kind => (KINDS as readonly string[]).includes(value);
