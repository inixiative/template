// DEV-003 — the seam registry: the single source of valid seams.
//
// `@partOf` and `@uses` targets are `class:name` strings whose `name` must exist
// here. The registry is the controlled vocabulary (typo'd `feature:emial` fails
// CI) and the home for per-seam metadata that does NOT belong on files —
// status / doc / ticket are properties of the feature or primitive, not of any
// one file that happens to be part of it.
//
// class meanings:
//   feature        — user-facing capability (maps to a FEATURES.md section / ticket)
//   primitive      — reusable building block features are made of
//   infrastructure — a connection/dependency consumed via @uses (never @partOf by consumers)
//
// `ambient: true` marks ubiquitous infrastructure (the db client, the request
// context) that virtually every file touches — these are NOT tagged via @uses,
// or every file would list them and the seam would carry no signal. They exist
// in the registry so the reverse index can still resolve them when relevant.

export type SeamClass = 'feature' | 'primitive' | 'infrastructure';
export type Status = 'complete' | 'partial' | 'scaffold' | 'planned';

export type SeamEntry = {
  status: Status;
  doc?: string; // path under docs/claude/
  ticket?: string; // ticket id
  ambient?: true; // ubiquitous infra — not surfaced via @uses
  note?: string;
};

// Keyed `class:name`. STARTER SET — validate/extend before bulk tagging (DEV-003 Phase 1).
export const SEAMS: Record<string, SeamEntry> = {
  // ── features ────────────────────────────────────────────────────────────
  'feature:auth': { status: 'complete', doc: 'AUTH.md' },
  'feature:auth-provider': { status: 'complete', doc: 'AUTH.md' },
  'feature:tokens': { status: 'complete', doc: 'AUTH.md' },
  'feature:impersonation': { status: 'complete', doc: 'AUTH.md' },
  'feature:organizations': { status: 'complete' },
  'feature:spaces': { status: 'complete' },
  'feature:users': { status: 'complete' },
  'feature:inquiry': { status: 'complete', ticket: 'FEAT-001' },
  'feature:contact': { status: 'complete' },
  'feature:customer': { status: 'partial', note: 'CustomerRef schema/queries; no full API/UI' },
  'feature:email': { status: 'partial', ticket: 'COMM-001', doc: 'COMMUNICATIONS.md' },
  'feature:webhooks': { status: 'complete' },
  'feature:audit-logs': { status: 'complete', ticket: 'FEAT-005', doc: 'HOOKS.md' },
  'feature:encryption': { status: 'partial', ticket: 'FEAT-013', note: '1/23 models; rotation blocked on CICD' },
  'feature:tags': { status: 'complete' },
  'feature:admin': { status: 'complete' },

  // ── primitives ──────────────────────────────────────────────────────────
  'primitive:rebac': { status: 'complete', doc: 'PERMISSIONS.md' },
  'primitive:app-events': { status: 'complete', doc: 'APP_EVENTS.md' },
  'primitive:jobs': { status: 'complete', doc: 'JOBS.md' },
  'primitive:hooks': { status: 'complete', doc: 'HOOKS.md' },
  'primitive:mutation-lifecycle': { status: 'complete', doc: 'HOOKS.md' },
  'primitive:false-polymorphism': { status: 'complete', doc: 'DATABASE.md' },
  'primitive:adapter': { status: 'complete', doc: 'ADAPTERS.md' },
  'primitive:route-templates': { status: 'complete', doc: 'API_ROUTES.md' },
  'primitive:caching': { status: 'complete', doc: 'REDIS.md' },
  'primitive:websockets': { status: 'partial', ticket: 'INFRA-004', doc: 'APP_EVENTS.md', note: 'subscribe authz pending' },
  'primitive:storage': { status: 'partial', ticket: 'FEAT-009', doc: 'ADAPTERS.md', note: 'adapter built, no file module' },
  'primitive:batch': { status: 'complete', doc: 'BATCH.md' },
  'primitive:ordered-list': { status: 'complete', doc: 'HOOKS.md' },
  'primitive:filtering': { status: 'complete', doc: 'API_ROUTES.md' },
  'primitive:pagination': { status: 'complete', doc: 'API_ROUTES.md' },
  'primitive:hydration': { status: 'complete', doc: 'DATABASE.md' },
  'primitive:typed-ids': { status: 'complete', doc: 'DATABASE.md' },
  'primitive:errors': { status: 'complete', doc: 'API_ROUTES.md' },

  // ── infrastructure ──────────────────────────────────────────────────────
  'infrastructure:postgres': { status: 'complete', ambient: true, note: 'db client — ambient, not @uses-tagged' },
  'infrastructure:redis': { status: 'complete', doc: 'REDIS.md' },
  'infrastructure:bullmq': { status: 'complete', doc: 'JOBS.md' },
  'infrastructure:s3': { status: 'partial', note: 'storage adapter target' },
  'infrastructure:otel': { status: 'partial', doc: 'LOGGING.md' },
  'infrastructure:infisical': { status: 'complete', doc: 'ENVIRONMENTS.md' },
};

export const isSeam = (target: string): boolean => target in SEAMS;
export const seamClass = (target: string): SeamClass | null =>
  (target.split(':')[0] as SeamClass) in { feature: 1, primitive: 1, infrastructure: 1 }
    ? (target.split(':')[0] as SeamClass)
    : null;
