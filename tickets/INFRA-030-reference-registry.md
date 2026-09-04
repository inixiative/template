# INFRA-030: Reference registry — the rows a rule names, as edges

**Status**: 👀 Review — built on this branch, then hardened by a 4-agent adversarial pass (races fenced, vocabulary gated, projection keyed); json-rules 2.20.0 `ruleSourceValues` shipped with its own fix round
**Assignee**: Aron
**Priority**: Medium
**Created**: 2026-08-31
**Updated**: 2026-08-31

> Zealot hit this as ZLT-4441 / #2116 (write-only edge table + DB hook, reviewed 2026-08-31 with the
> rulings below) after the ZLT-4331 review proved per-surface tree scanning doesn't scale: a delete
> guard covered two referencing surfaces and missed two more, and a `none` rule over a deleted target
> is vacuously true for the whole tenant. This is the template's version — same primitive,
> Postgres-shaped — with email conditionals as the first surface, and the ruling that email's
> `componentRefs` does **not** ride it.

---

## Problem

A stored rule (`{{#if rule=…}}` in an email body, `Groups.conditions` in Zealot) can name another
row: "recipient is tagged X", "members of segment Y". Nothing recorded that edge, so three questions
were each answered by scanning every rule-bearing column:

- **Delete gate** — "who references X?" before X is soft-deleted. Per-surface scans miss surfaces
  added later, by construction.
- **Ordering** — dependency-ordered reconciliation (topo layers over the reference graph) needs the
  edges per tenant; recomputing them from trees per pass is the cache-invalidation problem.
- **Staleness** — when X is gone anyway (out-of-band write, legacy path), the rule must not be
  evaluated: `any` degrades to false, `none` becomes everyone. Detecting that at evaluation time is
  another tree walk, on the hot path.

Email already solved the first two for one edge type in one domain: `componentRefs String[]` with a
GIN index, derived on save, `degradedComponentRefs` as the broken-refs projection, and the
`emailVersioning` hook walking the reverse edges on every save/soft-delete. That works because the
edge is homogeneous (component → component) and Postgres arrays index. Rules reference rows across
models, and a Json column's contents aren't indexable — so the edges become rows.

## What shipped

### `RuleReference` — false polymorphism on both axes

`packages/db/prisma/schema/ruleReference.prisma`. `ownerModel` + `emailTemplateId` /
`emailComponentId`; `referencedModel` + `tagId` / `organizationId` / `spaceId`; both axes in
`PolymorphismRegistry`, so the `rules` hook enforces exactly-one-FK and the type fields are
immutable. Real relations on both ends, `onDelete: Cascade`. Edge identity is one partial unique per
(owner, referenced) branch pair — the Contact / EmailTemplate convention. No `updatedAt` /
`deletedAt`: append/delete only, a row is never mutated. Tenant scoping is derived through the
owner, never denormalized onto the edge.

Not a bare `(model, id)` string pair (Zealot #2116's first cut). Typed relations are what the
consumers need: `include` on either end, relation-scoped `deletedAt` joins, and a hard delete on
either side removing the edge at the DB.

### Extraction is the lens's — `ruleSourceValues` (json-rules 2.20.0)

`ruleSourceValues(lens, rule)` reports the values a rule compares at each source the lens declares,
keyed by `projectByPath`'s `path` + `field` with the source's model — the caller never spells a
dotted path (the #9/#10 shape, rejected for exactly that). Nested and dotted relation spellings are
one path; quantifier- and operator-blind (`none` / `notIn` name their values as much as `any` /
`in`) except no-value operators; a windowing `filter` is walked at its anchor; an aggregate's own
threshold is not a source value; `path` / `bind`, non-enumerating operator shapes (substring,
pattern, range, window) and unknown operators report `dynamic` — the fail-closed flag. This
registry is the named first consumer that API was waiting for.

`packages/email/src/rules/emailRuleLens.ts` roots the rule context at `recipient → User`. The
narrowing is `mapDefaults`-shaped: a source on each referenceable model's `id` (`Tag`,
`Organization`, `Space` — derived from the `PolymorphismRegistry` axis) answers on every path to
the model, and every FK column duplicating a relation to a referenceable model is derived from
`prismaMap` and omitted from the vocabulary. `ruleReferences(rule)` keeps the id-field sources
(`prismaMap.isId`) as row references; `contentRuleReferences(...contents)` folds every `{{#if}}`
block, branch and nesting (`collectRules` in the condition parser). Adding a referenceable model =
a `RuleReference` FK column + a registry entry (source and omits derive); adding a rule-bearing
column = an entry in `RULE_REFERENCE_SURFACES`.

### Write hook — edges in the save's transaction

`apps/api/src/hooks/ruleReference/hook.ts`, after-timing on the surface models (never `'*'`),
because the edges need the created row's id and the stored body. Key-presence skip (a write that
does not touch `subject` / `mjml` returns before any query); set-diff per owner (survivors keep
their row, removed edges are deleted, added edges `createManyAndReturn`ed); missing or soft-deleted
targets and `dynamic` references are a 422 at save. `syncRuleReferences(model, rows)` is the
callable a backfill loops over.

### Staleness — asked, never stored

There is no staleness column and no staleness hook. "Which of my references are gone" is a
question the referenced rows already answer, so the reader asks them.

`composeTemplate` extracts the references from the content it just expanded and resolves them in
one query: `liveReferences(contentRuleReferences(mjml, subject).references)` returns the reference
keys that still resolve. `interpolate({ liveRefs })` hands that set to `evaluateConditions`, where
a branch naming a row **outside** the set is a rule error, never a match — the template's `onError`
policy (`fail` / `degrade` / `fallback`) decides, the same path a throwing rule takes.

Absence is the answer, which is why the set is of live rows rather than dead ones. Never created,
soft deleted, hard deleted with the edge cascaded away — all three land outside the set and all
three fail closed, without the render needing to tell them apart. Nothing is materialised, so
nothing can drift, and no propagation is needed to keep it true.

The edge table's job is the two questions a row cannot answer about itself: *who references X*
(the referenced FK's index) and *may this save name that row* (the delta gate, fenced by
`db.findForUpdate`).

### Tests

`apps/api/src/hooks/ruleReference/hook.test.ts` (18, DB-backed, full prod hook set — scoper,
preventHardDelete, rules): typed edges per surface and per referenced model, subject as a surface,
set-diff keeps survivors, non-rule writes don't churn, clear, components, 422 on missing /
soft-deleted / dynamic, a soft-delete drops the target from the live set while its edges stand and
a restore brings it back, hard delete cascades, the registry refuses a contradicting FK.
`packages/email/src/rules/ruleReferences.test.ts` (6) and the reference-liveness cases in
`evaluateConditions.test.ts` — live set renders, a key outside it is a rule error, an empty set
fails closed, an omitted set means the caller did not ask. json-rules:
`test/lens.ruleSourceValues.test.ts` (10).

## Adversarial round (same day, 4 agents, live-DB probes)

Every confirmed finding was fixed in-branch and pinned by a test:

- **The extraction surface was a strict subset of the evaluation surface** — FK-column spellings
  (`tagId`, `organizationId`), undeclared relations (`recipient.tags`), and deep paths all
  evaluated at render while registering zero edges: the vacuous-`none` failure this primitive
  exists to kill. Closed structurally, not by whitelist: the narrowing is now `mapDefaults` —
  a source on each referenceable model's `id` answers **wherever the model appears** (json-rules
  2.20.0 resolves `mapDefaults` sources via `walkLensPath`), and every FK column that duplicates a
  relation to a referenceable model is derived from `prismaMap` and omitted from the vocabulary.
  The write hook now runs `checkRuleAgainstLens` on every rule, so an FK spelling or a typo path
  is a 422, and any relation path to a referenceable id is a registered edge.
- **The save race, fenced with `db.findForUpdate`** (extended to take `{ id: { in } }`, where an
  empty list locks nothing rather than the whole table): the save gate locks the referenced rows
  before reading liveness, so a save can no longer commit an edge to a row a concurrent
  transaction is deleting. This is the only lock left — with nothing materialised there is no
  second writer to lose an update against.
- **The gate validates the delta, not the document**: a pre-existing dead reference no longer
  freezes its owner — edits that keep it are allowed and the projection stays truthful; only a
  *newly added* dead reference is a 422. Archived owners need no repair pass on restore, because
  there is no projection to have gone stale while they were away.
- **Render**: rules evaluate over the **nested** `{ sender, recipient, data }` object (dotted
  to-one paths resolve; the one-level flattening could not); a `dynamic` rule is a rule error
  unconditionally, not only when something is already stale; an unterminated `{{#if}}` is
  reported and suppressed instead of shipping raw rule JSON in the email body; a malformed
  nested marker can no longer let a `{{/if}}` inside a JSON string bisect the outer block.
- **Hard delete**: the client path is *prevented* (`preventHardDelete`); the purge/redact path
  cascades edges at the DB (real Postgres FKs) and needs no companion call — the render asks the
  content's references, not the edges, so a reference whose edge was cascaded away is simply
  outside the live set.

Known limitations, deliberately not papered over:

- **Two lenses own the two halves.** The per-template `recipientLens` (what data the recipient
  object carries) and `emailRuleNarrowing` (what rules may say) are declared independently. A
  rule at a declared source whose recipient data lacks the relation throws at render and fails
  **closed** through `onError` (DLQ under `fail`) — safe but noisy. The real fix is deriving one
  from the other; that is INFRA-017/018's authored lens.
- **A dotted path crossing a to-many** (`recipient.spaceUsers.space.id`) registers its edge but
  never matches under `check` (lodash `get` does not traverse arrays). `checkRuleAgainstLens`
  deliberately accepts the spelling today, so refusing it is a json-rules semantics decision
  (INFRA-019 target sharp edges) — author membership rules as relation nodes; the canonical
  spelling is gated, documented, and what every test uses.
- `sender.*` / `data.*` rules are authorable and structurally unregisterable (Json boundary):
  an id named through the opaque payload gets no edge, no gate, no staleness. Inherent to
  opaque payloads; say it in authoring docs.

## Rulings (Aron, 2026-08-31, on Zealot #2116)

1. False polymorphism, not a bare pair — typed FKs on both ends, cascade on the referenced side.
2. `referencedModel` is per edge, from the extraction; a constant is the column being decorative.
3. Edges hard-delete and have no lifecycle. deletedAt-awareness is on the joins and on the
   staleness trigger, never on the edge.
4. Legacy rows outside the id'd rule system (Zealot's ~10.8k `workflowJSON.autoApproveConfig`)
   are not backfilled; the one scanner protecting them survives with a KNOWN-BROKEN block on it.
5. Email `componentRefs` stays as it is. A component reference resolves by **slug through the
   owner cascade** at read time — an org adding an override `header` changes what every template in
   that org resolves without touching either row. An id edge persisted at save would be wrong the
   moment the cascade changes. Only id-addressed references ride this table.

## Zealot follow-through

#2116 reshapes to the rulings (typed FKs, `brandUuid` dropped, `referencedModel` from
`ruleSourceValues` over the segment lens, `syncRuleReferences` callable, staleness hook on Groups
writing `reconcilePausedAt`); ZLT-4444 is the consumer side (segment freeze, auto-approve → manual,
match filters stop). Cycle check on save reads the registry (persisted + in-flight, in the txn) and
retires `segmentsReferencing`.

## Not in scope

Tree composition (a rule evaluating another rule's tree — rejected on ZLT-4331). Depth caps. A
`referencesX` boolean on the owner. Migrating component references onto the table (ruling 5).
Transitive propagation over reverse edges (nothing in the template references a rule-bearing row
from a rule yet; the walk is `emailVersioning`'s when it's needed). Tenancy of a reference (a
Space-owned template naming another org's tag) — the lens narrowing's `where` scope owns that
(INFRA-017 / INFRA-018).

## Related

- **INFRA-016** / **INFRA-017** / **INFRA-018** — serialized lenses, builder surface, lens builder;
  the authored email lens replaces `emailRuleLens.ts`'s hand-declared narrowing when it lands.
- **DB-001** — `db.txn` identity; the hook relies on running inside the caller's transaction.
- `apps/api/src/hooks/emailVersioning/hook.ts`, `packages/email/src/render/validateNoCycle.ts` —
  the reverse-walk and cycle-check precedents this generalizes.
- Zealot **ZLT-4441** / #2116, **ZLT-4444**, **ZLT-4331**; inixiative/json-rules#9 and 2.20.0.
