// DEV-003 — closed set of @concern values.
//
// Concerns are cross-cutting PROPERTIES — not role (@kind), not membership
// (@partOf), not dependency (@uses). They are the fourth axis, and they are the
// point of the knowledge graph: meaning emerges from the INTERSECTION of edges.
// "The thing that redacts user PII for GDPR" is not a bespoke tag — it's
//   @kind handler @partOf feature:users @concern pii @concern retention
// converging. Prefer multiple broad-true concern tags over one narrow one.
//
// Discipline: broad but CLOSED vocab, applied LIBERALLY — but every concern
// must be genuinely true and load-bearing for the file (a file that merely
// reads a name is not @concern pii; a file whose job involves identifying data
// is). Many true edges = rich graph; many marginal edges = noise.

export const CONCERNS = [
  'pii', // handles personally-identifying data (redaction, anonymization, export)
  'security', // a security boundary / sensitive surface (authz checks, signing, validation of untrusted input)
  'secrets', // handles secrets / encryption-at-rest / key material
  'money', // billing, payments, entitlements with cost implications
  'tenant-isolation', // enforces or depends on org/space data isolation
  'retention', // data lifecycle: retention, archival, deletion, GDPR erase
  'idempotency', // must be safe to run more than once (jobs, reconcilers, webhooks)
  'hot-path', // performance-sensitive (per-request, high-frequency)
  'public-surface', // reachable unauthenticated / externally exposed
  'audit', // produces or depends on the audit trail
] as const;

export type Concern = (typeof CONCERNS)[number];

export const isConcern = (value: string): value is Concern => (CONCERNS as readonly string[]).includes(value);
