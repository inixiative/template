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
column = a `syncRuleReferences` call from its save path.

### No owner-side hook

Edges are written by `syncRuleReferences(owner, contents, lens)` — a service in
`packages/email/src/rules/`, called by `saveEmailTemplate` inside its transaction for the template
and each component it saved. That is the only writer of `mjml`/`subject` in the repo, so there is
nothing for a hook to catch that the call does not. The gate (vocabulary, `dynamic`, delta against
live rows under `findForUpdate`) throws `RuleReferenceError`, a sibling of
`ConditionValidationError` on the same path. The one hook left is on the referenced side.

### Staleness — two clocks on the edge row

An edge has to survive the row it names, and say so. Two ways a target leaves, two signals, both
on the edge:

* **Soft delete** — `ruleReference:referenced` copies the target's `deletedAt` onto every edge that
  names it, matched on `(referencedModel, referencedId)`. One `updateManyAndReturn` per model, no
  walk and no closure. Re-resolve rather than set-once, so an undelete clears it.
* **Purge** — the referenced FK carries no `onDelete`, so Postgres `SET NULL`s it and the edge
  stands with `referencedId` still naming the row that went. No hook can see a purge (the client
  path is refused by `preventHardDelete`; the redact path is raw), which is why this one is the
  database's job rather than a listener's.

### True polymorphism beside the false

The referenced axis carries both: the typed FK **and** `referencedId`.

They are two clocks on one fact. The FK is the *relation* — owned by referential integrity, and it
goes null at exactly the moment the row ceases to exist. `referencedId` is the *name* — owned by
the rule content, written once and never updated. They agree for the whole time the target is
alive and diverge precisely at the moment worth detecting, so the divergence is the signal.
`syncRuleReferences` writes both from the same value, so they agree by construction.

That is also what makes the *read* flat. `ruleReferenceIssues(edges)` — a pure function in
`@template/db`, no relations — answers "which of these no longer resolve" from the edge rows
alone, so a consumer writes `include: { ruleReferences: true }` and never has to grow that include
when a model becomes referenceable. `composeTemplate` reads the template's edges and those of the
components the cascade actually resolved (`expand` now returns their ids), and hands
`interpolate({ liveRefs })` the keys that survive; a branch naming anything outside that set is a
rule error, never a match, and the template's `onError` policy decides.

### Open: a lens that lives in a row

Extraction is a function of two inputs — the rule content and the lens — and the write hook only
observes the first. A per-template lens is fine, because editing it *is* an owner write. A shared
lens authored as data is not: change it and every owner's edges are wrong at once with no write to
notice. Re-deriving on a base-lens change is a sweep over `syncRuleReferences(model, rows)`, the
same callable a backfill loops over, triggered by a job rather than by a save. Deliberately not
built here — the constraint is written down so the surface registry stays broadly open rather than
being tightened around today's two models.

### Tests

`apps/api/src/hooks/ruleReference/hook.test.ts` (19, DB-backed, full prod hook set — scoper,
preventHardDelete, rules): typed edges per surface and per referenced model, subject as a surface,
set-diff keeps survivors, non-rule writes don't churn, clear, components, 422 on missing /
soft-deleted / dynamic, a soft-delete stamps every edge naming the target and a restore clears
them, a purge nulls the FK and leaves the edge naming the row, the client refuses a hard delete,
the registry refuses a contradicting FK. `packages/email/src/rules/ruleReferences.test.ts` (6) and
the reference-liveness cases in `evaluateConditions.test.ts` — live set renders, a key outside it
is a rule error, an empty set fails closed, an omitted set means the caller did not ask.
json-rules: `test/lens.ruleSourceValues.test.ts` (10).

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
  `SET NULL`s the referenced FK and needs no companion call — the edge stays, `referencedId` still
  names the row, and the null FK is what the read calls `purged`.

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
