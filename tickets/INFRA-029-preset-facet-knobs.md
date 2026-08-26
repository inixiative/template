# INFRA-029: Preset facets with variables — a named condition the user can still tune

**Status**: 🆕 Not Started — shape settled 2026-08-26 (see below); rules-builder only, no json-rules change
**Assignee**: Aron
**Priority**: Medium (Zealot carries a side-channel that covers it today; the side-channel is the cost)
**Created**: 2026-08-26
**Updated**: 2026-08-26

The preset facet (`Facet.condition`, rules-builder `ed5980c`, 0.24.x) is a named alias for a complete pre-authored `Condition`: pick "Mature", the whole condition drops in as one **atomic** node and a saved node equal to the condition collapses back to the name. That was half the idea. The other half — a preset that still lets the user pick *something* while its identity stays fixed — never landed.

## What grew in its place

Zealot #1710 (ZLT-3214, eight days after `ed5980c`) built a Zealot-only `presets` decoration key the library ignores: `SegmentRulePreset` / `RULE_PRESETS` (`segmentDecoration.ts`), `decorationPresets` / `presetTemplateSignature` / `presetNodeSignature` / `matchPresetNode` / `plainDateWindowRow` (`packages/ui/.../rule-builder/lib.ts`), `preset-rows.tsx` (`AggregateRow`, `DateWindowRow`), the `~preset:` picker routing and `insertPreset`. A card inserts a template via the raw `addRule`/`removeNode` helpers and is matched back by a hand-rolled structural signature that only understands `ArrayNode` shapes — Zealot #2081's root-group preset rendered as a bare "any of" box the moment it was picked.

## Shape (settled with Aron, 2026-08-26)

A **variable** is a slot inside the facet's condition, marked in place and carrying its own default. Nothing outside the slot describes it. The word is chosen against the value-source family json-rules already speaks — `value` (literal), `path` (same-row / context), `bind` (server-supplied at evaluation) — this one is *author-supplied at authoring time*. "Knob" is the renderer's metaphor for the control, not the template's word for the slot.

```ts
{
  label: 'Rewards Redeemed This Year',
  condition: {
    field: 'fanRewards',
    aggregate: { mode: 'sum', field: 'redeemedUsdCents' },
    operator: 'greaterThanEquals',
    value: { variable: { default: 0 } },             // open slot, defaults to 0
    condition: { all: [
      { field: 'brandUuid', operator: 'equals', bind: 'brandUuid' },   // LOCKED — identity, server-resolved
      { field: 'createdAt', dateOperator: 'within', value: { this: 'year' } },
    ] },
  },
}

// the same marker, elsewhere:
value: { variable: {} }                              // open, no default → inserts empty (existing incomplete-leaf state)
value: { variable: { default: { ago: { days: 30 } } } }  // DateExpr default
value: { variable: { default: { bind: 'brandUuid' } } }  // default is a bind: context-resolved until the user overrides
operator: { variable: { default: 'greaterThanEquals' } } // an operator slot — same marker, no engine change
```

Rulings the shape encodes:

- **`bind` stays locked.** A `{ bind }` in a facet condition means "the server fills this; the user never sees it" — identity, not a variable. The editable marker is a different word (`variable`) so one token never means both.
- **Variable = open; default = default.** `variable: {}` is a legal open slot; the default, when present, lives *in* the slot (it knows its own shape and position — a side map keyed by name was wrong).
- **A default may itself be a bind or a path.** The builder writes the default verbatim into the slot on insert; a bind default rides into the saved rule and the engine resolves it at evaluation like any bind; the control shows the context value until the user overrides, at which point the literal replaces it.
- **Builder-side template, not a `Condition`.** The template isn't a `Condition` until resolved, so the marker can sit in *any* slot — value, operator — with zero json-rules change. Value variables ship first; operator variables are free by construction, added when a card needs one.
- **By value, not by reference.** The saved rule is the expanded condition — evaluates anywhere, needs no lens to mean something; a central edit of the facet changes what new rules say, not what saved segments already mean.

## Mechanics (rules-builder 0.26)

- `validateDecoration`: substitute each variable's default (or a catalog-shaped placeholder when absent — shape from `valueShapeForOperator` for that leaf), then validate the condition against the lens exactly as for an atomic preset.
- Insert: resolve variables → defaults (empty where none) → the expanded condition goes into the tree via the existing `addRule` path.
- Recognition (`matchFacet` / `stampFacetIds`): variable slots are wildcards; everything else — including locked binds, compared as tokens — must match canonically. `variable: {}` and `variable: { default }` recognise identically; the default only matters at insert.
- Rendering: the hoisted node exposes one control per variable (`ValueControl` / `OperatorControl`, shape from the catalog); everything else on the card is inert. No preset-specific row components.
- Zero variables = today's atomic preset, so `Facet.condition` + variables is one primitive with the atomic case as the degenerate form.

## End state in Zealot

Delete the `presets` key, `preset-rows.tsx`, the signature/match helpers, `POINT_CHOICES`, and the `~preset:` picker branch; the cards become facets with variables. After json-rules 2.19.6–2.19.8 (`notWithin`, `notBefore`/`notAfter`, and the Prisma rail fixes), `daysSinceLastLogin` and `daysSinceLastActivity` (via a `lastFanMission.createdAt` lens pick) are single leaves and need no facet at all; the aggregate card (`rewardsRedeemedThisYear`, variable on the amount, operator fixed) is the first consumer.

## Not in scope

json-rules changes of any kind (the by-reference `{ preset, variables }` node considered on 2026-08-26 was dropped — it was the only thing that dragged the engine in, and by-reference propagation was the feature and the hazard at once). User-authored presets. Variable labels beyond `Decor`.

## Related

- **INFRA-002** — Rules Builder; **INFRA-017** — Builder Surface (`hoist` / facet machinery on the descriptor tree).
- **INFRA-028** — Lens prose decorator; a preset facet's `label`/`icon` is the same `Decor`.
- Zealot **ZLT-4222** / #2081 — the case that surfaced the gap; Zealot #1710 — the side-channel this retires; json-rules #12 / 2.19.7–2.19.8 — the Prisma rail fixes the plain-leaf path depends on.
