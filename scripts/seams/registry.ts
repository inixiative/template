// DEV-003 — the seam registry: the single source of valid seams.
//
// `@partOf` and `@uses` targets are `class:name` strings whose `name` must exist
// here. The registry is the controlled vocabulary (typo'd `feature:emial` fails
// CI) and the home for per-seam metadata that does NOT belong on files —
// status / doc / ticket are properties of the feature or primitive, not of any
// one file that happens to be part of it.
//
// Naming: class prefix is lowercase (feature/primitive/infrastructure/registry);
// the seam name is camelCase (no kebab — matches the codebase convention).
//
// class meanings:
//   feature        — user-facing capability (maps to a FEATURES.md section / ticket)
//   primitive      — reusable building block features are made of
//   infrastructure — a connection/dependency consumed via @uses
//   registry       — a declarative config table (the registry pattern)
//
// `ambient: true` marks ubiquitous infrastructure (the db client, the request
// context) touched incidentally by ~every file — NOT tagged via @uses (load-
// bearing only). It exists here so the reverse index can resolve it when needed.

export type SeamClass = 'feature' | 'primitive' | 'infrastructure' | 'registry';
export type Status = 'complete' | 'partial' | 'scaffold' | 'planned';

export type SeamEntry = {
  status: Status;
  doc?: string; // path under docs/claude/
  ticket?: string; // ticket id
  ambient?: true; // ubiquitous infra — not surfaced via @uses
  note?: string;
};

// Keyed `class:name` (name is camelCase). STARTER SET — validate/extend before bulk tagging.
export const SEAMS: Record<string, SeamEntry> = {
  // ── features ────────────────────────────────────────────────────────────
  'feature:auth': { status: 'complete', doc: 'AUTH.md' },
  'feature:authProvider': { status: 'complete', doc: 'AUTH.md' },
  'feature:tokens': { status: 'complete', doc: 'AUTH.md' },
  'feature:impersonation': { status: 'complete', doc: 'AUTH.md' },
  'feature:tenancy': { status: 'complete', note: 'organizations + spaces + memberships' },
  'feature:users': { status: 'complete', note: 'user mgmt, profile, verification, GDPR redaction' },
  'feature:inquiry': { status: 'complete', ticket: 'FEAT-001' },
  'feature:contact': { status: 'complete' },
  'feature:customer': { status: 'partial', note: 'CustomerRef schema/queries; no full API/UI' },
  'feature:email': { status: 'partial', ticket: 'COMM-001', doc: 'COMMUNICATIONS.md' },
  'feature:webhooks': { status: 'complete' },
  'feature:auditLogs': { status: 'complete', ticket: 'FEAT-005', doc: 'HOOKS.md' },
  'feature:encryption': { status: 'partial', ticket: 'FEAT-013', note: '1/23 models; rotation blocked on CICD' },
  'feature:tags': { status: 'complete' },
  'feature:admin': { status: 'complete' },

  // ── primitives ──────────────────────────────────────────────────────────
  'primitive:authz': { status: 'complete', doc: 'PERMISSIONS.md', note: 'rebac/permix — authorization' },
  'primitive:appEvents': { status: 'complete', doc: 'APP_EVENTS.md' },
  'primitive:jobs': { status: 'complete', doc: 'JOBS.md' },
  'primitive:hooks': { status: 'complete', doc: 'HOOKS.md' },
  'primitive:mutationLifecycle': { status: 'complete', doc: 'HOOKS.md' },
  'primitive:falsePolymorphism': { status: 'complete', doc: 'DATABASE.md' },
  'primitive:adapter': { status: 'complete', doc: 'ADAPTERS.md' },
  'primitive:routeTemplates': { status: 'complete', doc: 'API_ROUTES.md' },
  'primitive:caching': { status: 'complete', doc: 'REDIS.md' },
  'primitive:websockets': { status: 'partial', ticket: 'INFRA-004', doc: 'APP_EVENTS.md', note: 'subscribe authz pending' },
  'primitive:storage': { status: 'partial', ticket: 'FEAT-009', doc: 'ADAPTERS.md', note: 'adapter built, no file module' },
  'primitive:batch': { status: 'complete', doc: 'BATCH.md' },
  'primitive:orderedList': { status: 'complete', doc: 'HOOKS.md' },
  'primitive:filtering': { status: 'complete', doc: 'API_ROUTES.md' },
  'primitive:pagination': { status: 'complete', doc: 'API_ROUTES.md' },
  'primitive:hydration': { status: 'complete', doc: 'DATABASE.md' },
  'primitive:typedIds': { status: 'complete', doc: 'DATABASE.md' },
  'primitive:errors': { status: 'complete', doc: 'API_ROUTES.md' },
  'primitive:jsonRules': { status: 'complete', note: '@inixiative/json-rules; used by authz, filtering' },

  // ── registries (the registry pattern — declarative config tables) ─────────
  'registry:falsePolymorphism': { status: 'complete', doc: 'DATABASE.md' },
  'registry:softDelete': { status: 'complete', doc: 'DATABASE.md' },
  'registry:auditEnabled': { status: 'complete', ticket: 'FEAT-005' },
  'registry:encryption': { status: 'partial', ticket: 'FEAT-013' },
  'registry:orderedList': { status: 'complete', doc: 'HOOKS.md' },
  'registry:webhookEnabled': { status: 'complete' },
  'registry:redactFields': { status: 'complete' },
  'registry:cacheKeys': { status: 'complete', doc: 'REDIS.md' },
  'registry:seams': { status: 'partial', ticket: 'DEV-003', note: 'this system' },

  // ── infrastructure ──────────────────────────────────────────────────────
  // postgres = the database itself (ambient — everything queries it).
  // prisma   = deep ORM coupling (client, extensions, runtime introspection) — selective, tagged.
  'infrastructure:postgres': { status: 'complete', ambient: true, note: 'the DB — ambient via context, not @uses-tagged' },
  'infrastructure:prisma': { status: 'complete', doc: 'DATABASE.md', note: 'deep ORM coupling only (client/extensions), not incidental queries' },
  'infrastructure:redis': { status: 'complete', doc: 'REDIS.md' },
  'infrastructure:bullmq': { status: 'complete', doc: 'JOBS.md' },
  'infrastructure:s3': { status: 'partial', note: 'storage adapter target' },
  'infrastructure:otel': { status: 'partial', doc: 'LOGGING.md' },
  'infrastructure:infisical': { status: 'complete', doc: 'ENVIRONMENTS.md' },
};

const SEAM_CLASSES: Record<SeamClass, true> = { feature: true, primitive: true, infrastructure: true, registry: true };

export const isSeam = (target: string): boolean => target in SEAMS;
export const seamClass = (target: string): SeamClass | null => {
  const prefix = target.split(':')[0];
  return prefix in SEAM_CLASSES ? (prefix as SeamClass) : null;
};
