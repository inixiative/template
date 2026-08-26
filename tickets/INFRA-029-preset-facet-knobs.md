# INFRA-029: Preset facets with variables — a named condition the user can still tune

**Status**: 🆕 Not Started — shape settled + adversarially reviewed 2026-08-26 (11-agent pass; amendments folded in below); rules-builder only, no json-rules change
**Assignee**: Aron
**Priority**: Medium (Zealot carries a side-channel that covers it today; the side-channel is the cost)
**Created**: 2026-08-26
**Updated**: 2026-08-26

The preset facet (`Facet.condition`, rules-builder `ed5980c`, 0.24.x) is a named alias for a complete pre-authored `Condition`: pick "Mature", the whole condition drops in as one **atomic** node and a saved node equal to the condition collapses back to the name. That was half the idea. The other half — a preset that still lets the user pick *something* while its identity stays fixed — never landed.

## What grew in its place

Zealot #1710 (ZLT-3214, eight days after `ed5980c`) built a Zealot-only `presets` decoration key the library ignores: `SegmentRulePreset` / `RULE_PRESETS` (`segmentDecoration.ts`), `decorationPresets` / `presetTemplateSignature` / `presetNodeSignature` / `matchPresetNode` / `plainDateWindowRow` (`packages/ui/.../rule-builder/lib.ts`), `preset-rows.tsx` (`AggregateRow`, `DateWindowRow`), the `~preset:` picker routing and `insertPreset`, and a second consumer in `apps/admin-dashboard/.../SegmentPreviewRail/describeConditions.ts` (reads `decoration.presets` with its own signature). A card inserts a template via the raw `addRule`/`removeNode` helpers and is matched back by a hand-rolled structural signature that only understands `ArrayNode` shapes — Zealot #2081's root-group preset rendered as a bare "any of" box the moment it was picked.

## Shape (settled with Aron, 2026-08-26)

A **variable** is a slot inside the facet's condition, marked in place and carrying its own default. Nothing outside the slot describes it. The word sits in the value-source family json-rules already speaks — `value` (literal), `path` (same-row / context), `bind` (server-supplied at evaluation) — this one is *author-supplied at authoring time*. "Knob" is the renderer's metaphor for the control, not the template's word for the slot.

```ts
// The first consumer, as it actually ships in Zealot (segmentDecoration.ts RULE_PRESETS[0]):
{
  label: 'Rewards Redeemed',
  condition: {
    field: 'fanRewards',
    aggregate: { mode: 'sum', field: 'redeemedUsdCents' },
    operator: 'greaterThanEquals',
    value: { variable: {} },                                   // threshold: OPEN — inserts incomplete, the save gate blocks until filled
    condition: { all: [
      { field: 'createdAt', dateOperator: 'within', value: { variable: { default: { this: 'year' } } } },   // window: variable with a default
      { field: 'status', operator: 'notEquals', value: 'rejected' },                                        // identity — load-bearing, locked
    ] },
  },
}
```

Rulings the shape encodes:

- **`bind` stays locked.** A `{ bind }` in a facet condition means "the server fills this; the user never sees it" — identity, not a variable. The editable marker is a different word (`variable`) so one token never means both. (No Zealot facet carries one today — the segment lens scopes brand on the lens, not in rules — so there is no worked example; the ruling stands without one.)
- **Variable = open; default = default.** `variable: {}` is a legal open slot and inserts with the slot key *omitted* (the tree state a freshly added leaf has — `isLeafComplete` false, `validateRule` blocks save). A default, when present, lives *in* the slot. The threshold above is deliberately open: `default: 0` would turn today's fail-loud incomplete rule into a silently everyone-matching segment.
- **Defaults are literal `RuleValue` / `DateExpr` only — not `bind`, not `path`.** Reviewed and rejected for 0.26: a nested `value: { bind }` is an object literal the engine never resolves (`field.ts` returns `value` before the `bind` arm; `resolveBindings` reads `node.bind`), and a sibling `bind:` with no `value` fails `validateRule` (`missing_value_source`, validate.ts:716-731) — step 1 of Zealot's save gate — before `toPrisma` would throw on the unresolved bind. Nothing in Zealot resolves rule-level binds (every call is `resolveLensBindings` on the lens). A bind/path default needs `validateRule` to learn `bind`, i.e. a json-rules ticket; out of scope here by design.
- **Builder-side template, not a `Condition`.** The template isn't a `Condition` until resolved, so the marker never reaches json-rules. `validateDecoration` substitutes a present default and validates against the lens; for an absent default it omits the slot key (no synthesised placeholder — `checkRuleAgainstLens` gates only string enum literals, so `''` is a false violation and `0` is checked by nothing).
- **Value variables only in 0.26.** Operator variables are *not* free by construction: the operator selects the value shape (`valueShapeForOperator`), `validateRule` forbids `value` on a `none`-shape operator and demands a pair for `between`, so a variable operator reshapes or deletes its sibling. Deferred, with the constraint stated: an operator slot's options must share one value shape unless the sibling value is also a variable.
- **By value, not by reference.** The saved rule is the expanded condition — evaluates anywhere, needs no lens to mean something; a central edit of the facet changes what new rules say, not what saved segments already mean. Consequence, accepted: recognition is by-value, so a hand-authored rule inside a facet's equivalence class wears the card on every load, and `facetMode: 'raw'` (session-only `__facetId: null`, dropped by `stripMeta`) does not survive reload. The card is a view over the rule, not a claim on it; a durable opt-out is a separate ruling.
- **`selectors` and variables are siblings, not one mechanism.** A selector writes an `equals`/`in` *clause* claimed by field name, order-tolerantly, because the clause is user data; a variable is claimed by *position* because everything around it is fixed. `selectorsApply` is already hard-false for presets. Add one violation in `validateFacetList`'s preset branch when `selectors` and `condition` coexist (today it is silently dropped).

## Mechanics (rules-builder 0.26) — with the amendments from the adversarial pass

1. **One comparator, defaults erased.** `canonical` erases a variable's default (`{ variable: { … } }` → `{ variable: {} }`) so `facetId`, `sameConditions`, and the preset compare ride one relation. Without this `facetId` folds the default in while recognition ignores it: `{variable:{}}` and `{variable:{default:0}}` over the same body get different ids while a saved `value: 100` node matches both — and `validateFacetList`'s preset branch `continue`s before the collision check, so `validateDecoration`'s determinism guarantee is silently void for every variable-bearing preset (contradicting its own doctrine: "`defaultWhere` is editable, so it never folds in").
2. **Recognition: fill, compare, rank.** `matchFacet`'s preset arm compares `canonical(fill(template, node))` to `canonical(node)` — the node's values substituted at the template's variable positions — and accumulates into `best` by **fewest wildcard slots** (the existing `bestLead` idiom) instead of returning the first hit, so a fixed-`100` facet beats a variable one on a `100` rule and array order never decides which card a saved rule wears. Do not add a preset rejection rule — catch-all + stricter projection is sanctioned twice in the file.
3. **Aggregates must reach `matchFacet`.** Today `buildArray` gates recognition on `!isAggregate && scope.decoration` (`buildNodes.ts` ~600), and `hoist` / `atomic` / `facetMode` all derive from that one binding — so the first consumer (a top-level `AggregateRule`) would insert fine and then render raw forever, #2081's failure class. The preset arm is whole-node equality and shape-agnostic (verified empirically on 0.25.0: `matchFacet` returns a preset facet for an aggregate node). Scope the guard to path-facets — its rationale is the whereless-path heuristic, not presets — don't drop it, or the collection arm mislabels aggregates. `stampFacetIds` needs nothing: with (2), preset recognition is deterministic without a pin.
4. **Insert:** resolve variables → defaults (slot key omitted where none) → the expanded condition enters the tree via the existing `addRule` path.
5. **Rendering:** the hoisted node exposes one control per variable — the controls the hook already builds for that leaf (`ValueControl` with the catalog shape), not re-derived from the catalog; everything else on the card is inert. Zero variables = today's atomic preset, so `Facet.condition` + variables is one primitive with the atomic case as the degenerate form.

## End state in Zealot (assumes ZLT-4222 / #2081 merged)

- New: one generic `PresetRow` for `node.atomic` + the variable controls — Zealot's rule-builder has zero `atomic` handling today, so this is net-new rendering, not a deletion.
- Delete: the `presets` key on `SegmentDecoration`, `preset-rows.tsx`, the signature/match helpers in `lib.ts`, `POINT_CHOICES`, the `~preset:` picker branch and `insertPreset`; and `describeConditions.ts`'s `decoration.presets` reader + its test — prose for a matched facet interpolates the node's variable-slot values (its own comment already requires the window to be restated).
- Cards: `rewardsRedeemedThisYear` → the facet above ("Rewards Redeemed", threshold open, window variable defaulting to this year — today's `AggregateRow` exposes operator, threshold *and* window; fixing the window would orphan every saved rule on `{ last: 'year' }` / `{ ago: { days: 90 } }`). `daysSinceLastLogin` → a single `lastLoginAt notWithin` / `notAfter` leaf (json-rules 2.19.6–2.19.8), no facet. `daysSinceLastActivity` stays a facet with a window variable **until** the manual-activity question is settled: `fanMissions none (createdAt within …)` over every row is *not* the same set as a `lastFanMission.createdAt` leaf — the `lastFanMission` pointer is maintained by an after-create-only hook that skips `activityType` (manual) rows, so an advocate whose only recent touch is admin-logged activity would flip to "inactive". No card migration to `lastFanMission` until the hook and backfill agree on whether manual activity is activity.
- Sequencing: land rules-builder 0.26 first (it ignores the Zealot-only `presets` key), bump Zealot's `github:userevidence/rules-builder#vX` pin, then move the decoration in a later commit — a cached admin bundle on 0.25 would otherwise insert the raw marker and fail at save.

## Not in scope

json-rules changes of any kind (the by-reference `{ preset, variables }` node considered on 2026-08-26 was dropped — `reconcileUserMembership` runs bare `check()` with no `applyLens`, so an unexpanded node would evaluate `false` and silently evict members; and by-reference propagation was the feature and the hazard at once). Bind/path defaults (json-rules ticket). Operator variables (deferred, constraint above). User-authored presets. Variable labels beyond `Decor`. A durable detach.

## Related

- **INFRA-002** — Rules Builder; **INFRA-017** — Builder Surface (`hoist` / facet machinery on the descriptor tree).
- **INFRA-028** — Lens prose decorator; a preset facet's `label`/`icon` is the same `Decor`.
- Zealot **ZLT-4222** / #2081 — the case that surfaced the gap; Zealot #1710 — the side-channel this retires; json-rules #12 / 2.19.7–2.19.8 — the Prisma rail fixes the plain-leaf path depends on.
- Adversarial pass 2026-08-26: 4 lenses, 27 findings, 6 verified — the four facts above (facetId/recognition split, aggregate guard, bind-default unsaveable, invalid example) held on independent re-verification; the verifiers rejected the original severities and amendments, which are replaced here.
