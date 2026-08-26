# INFRA-029: Preset facets with knobs — a named condition the user can still tune

**Status**: 🆕 Not Started
**Assignee**: Aron
**Priority**: Medium (Zealot carries a side-channel that covers it today; the side-channel is the cost)
**Created**: 2026-08-26
**Updated**: 2026-08-26

The preset facet (`Facet.condition`, rules-builder `ed5980c`, 0.24.x) is a named alias for a complete pre-authored `Condition`: pick "Mature", the whole condition drops in as one **atomic** node — no field/operator/value pickers — and a saved node equal to the condition collapses back to the name. That was half the idea. The other half was that a preset should still let the user pick *something* — the window, the threshold — while its identity stays fixed. That half never landed.

## What grew in its place

Zealot #1710 (ZLT-3214, 2026-07-22, eight days after `ed5980c`) built a Zealot-only `presets` decoration key the library ignores:

- `SegmentRulePreset` / `RULE_PRESETS` — `apps/api/src/modules/groups/lib/segmentDecoration.ts`
- `decorationPresets`, `presetTemplateSignature`, `presetNodeSignature`, `matchPresetNode`, `plainDateWindowRow` — `packages/ui/src/components/rule-builder/lib.ts`
- `preset-rows.tsx` — `AggregateRow`, `DateWindowRow` (124 lines of preset-specific renderer)
- the `~preset:` picker routing (`pickers.tsx`) and `insertPreset` (`rule-builder.tsx`)

A card inserts a template rule via the raw `addRule`/`removeNode` helpers; a saved rule is matched back to its card by a hand-rolled structural signature that ignores the knob values — exactly the recognition the library's `matchFacet` would do if the facet knew which leaves were knobs. It only understands `ArrayNode` shapes (`agg:` / `rel:`), so Zealot #2081's root-group preset (`{ any: [lastLoginAt notExists, lastLoginAt before …] }`) renders as a bare "any of" box with two removable cards the moment it is picked.

## Shape

A `condition` facet declares its knobs; everything else is identity.

```ts
{
  label: 'Rewards Redeemed This Year',
  condition: {
    field: 'fanRewards',
    aggregate: { mode: 'sum', field: 'redeemedUsdCents' },
    operator: 'greaterThanEquals', value: 0,
    condition: { all: [
      { field: 'createdAt', dateOperator: 'within', value: { this: 'year' } },
      { field: 'status', operator: 'notEquals', value: 'rejected' },
    ] },
  },
  // which controls the hoisted node exposes — the rest is locked, like a collection facet's `where`
  knobs: [{ path: [], controls: ['operator', 'value'] }],
}
```

- Recognition (`matchFacet` / `stampFacetIds`): structural equality with knob leaves compared on `field` + operator *kind* only, never value — `leadingWhereCount`'s "identity block" generalised to "everything that isn't a knob".
- Rendering: the hoisted node exposes `FieldControl`/`OperatorControl`/`ValueControl` only for knob leaves; non-knob leaves are locked the way a facet's `where` is. No renderer needs a preset-specific row — the existing per-shape controls (including the `dateWindow` relative-date select) draw the knob.
- `validateDecoration`: every knob path must resolve inside `condition`, and the condition must validate against the lens (already true for atomic presets).
- Keying/path discipline: mirror `selectors` — a knob names a leaf by field (or a `RulePath` into the condition), not by array index.

## End state in Zealot

Delete the `presets` key, `preset-rows.tsx`, the signature/match helpers, `POINT_CHOICES`, and the `~preset:` picker branch; the cards become library facets. After `notWithin` lands (ZLT-4222 follow-through — a negative-flavored date operator that matches NULL under the negation ruling), `daysSinceLastLogin` and `daysSinceLastActivity` (via a `lastFanMission.createdAt` lens pick) are single leaves and need no facet at all. The aggregate card is the only real consumer of this ticket.

## Related

- **INFRA-002** — Rules Builder; **INFRA-017** — Builder Surface (`hoist` / facet machinery lives on the descriptor tree).
- **INFRA-028** — Lens prose decorator; the `label`/`icon` a preset facet carries is the same `Decor`.
- Zealot **ZLT-4222** / #2081 — the case that surfaced the gap; Zealot #1710 — the side-channel this retires.
