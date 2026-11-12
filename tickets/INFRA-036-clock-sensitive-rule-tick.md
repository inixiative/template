# INFRA-036 — Clock-sensitive rules get a tick

**Status:** draft · **Line:** INFRA · **Related:** FEAT-021, INFRA-033, INFRA-030, FEAT-020

## Problem

A dynamic segment's membership moves for two reasons: a row its rule reads changes, or the clock
does. The first is covered — `RECONCILE_TRIGGERS` maps every model the lens reads to the events
that carry its change, and `reconcileCustomerRefSegments` re-evaluates the one customer. The
second has only the nightly backstop: `sweepSegments` at 04:00 UTC re-enqueues every sound dynamic
segment. A rule like "last order within the past 2 hours" or "signed up this week" is therefore up
to a day stale, while the sweep spends most of its budget on rules that never read the clock.

Nothing records which rules are clock-sensitive. `isContinuous` is dynamic-and-reconcilable;
`sweepableSegments` takes everything that passes it.

## Shape (Aron, 2026-10-03, 2026-10-29)

A column on the table that holds the rule, derived at save, saying how fine a clock the rule
reads; a `lastComputedAt` on what the rule computed; one job per unit that looks one unit ahead.

- **The engine owns "does this rule read `now`".** json-rules `clockUnit(rule): ClockUnit | null`
  returns the finest clock unit any date expression in the tree reads, one of `CLOCK_UNITS`
  (`second | minute | hour | day | week | month | quarter | year`). Rolling (`ago`/`ahead`): each
  unit it names. Period (`this`/`last`/`next`) and edge (`start`/`end`): the period's unit
  (`isoWeek` → `week`). Absolute dates, column-to-column `path` compares and their offsets, and
  `dayIn`/`dayNotIn` → `null`. It walks `all`/`any`/`if`/relation/aggregate/range through
  `visitCondition`.
- **The floor is an engine setting.** `engineGlobals` `clock.finestUnit` (default `second`). A
  unit finer than the floor is chopped to it, not rounded. The app sets `hour` once at boot; a
  finer floor is a product decision, not a default.
- **`clockUnit` lives on the rule-bearing row.** `Segment.clockUnit`, a nullable enum column,
  written by the `segmentRuleReferences` after-write hook next to `syncRuleReferenceEdges`, so it
  is derived in the same place as the edges and rebuilt on revive with them. Derived enrichment
  maps (FEAT-020) carry it on the map and/or the field definition, folded from their rules on the
  same hook; a synthetic map declares it. One enum and one sweep family cover every materialized
  rule surface (Zealot: `Groups`, `IntegrationMap`, `CustomFieldDefinition`). Email templates and
  components evaluate at render and materialize nothing, so they need no tick and no column.
- **`lastComputedAt` lives on what was computed:** the segment, or the derived enrichment rows.
- **One job per unit, one unit ahead.** Each unit's cron row (hourly, daily (keep 04:00), weekly,
  monthly, quarterly, yearly) checks one clock unit ahead: whatever with that `clockUnit` whose
  `lastComputedAt` would no longer hold by the next tick is recomputed. Dependency order is
  unchanged, and the nightly backstop over every sound dynamic segment stays.
- **Dependents need no column.** A segment that reads a clock-sensitive segment's membership is
  refreshed by the dependents fan-out `reconcileSegment` already runs after a diff.

## Not in scope

Sliding-window aggregates over many rows ("more than five orders in the last 90 days") stay a
derived-enrichment concern (FEAT-020): bucketed per-day counts summed at read, with a daily tick
dropping the expired bucket. A rolling window on a date column does not need buckets; the tick
alone keeps it fresh.

## Tests

- Fold: rolling hours → `hour`; rolling minutes → `minute`; `thisWeek` → `week`; `lastQuarter` →
  `quarter`; `thisYear` → `year`; `isoWeek` → `week`; absolute date → `null`; a date expression
  nested under `any` → relation → aggregate is found; `path` compare → `null`.
- Floor: under `clock.finestUnit = 'hour'`, rolling minutes and `this: 'minute'` → `hour`; `day`
  stays `day`; `null` stays `null`.
- Hook: saving a rolling rule writes `clockUnit`; editing it to an absolute date clears it;
  revive rebuilds it.
- Sweep: the hourly row recomputes only `hour` rows whose `lastComputedAt` won't hold by the next
  tick, and skips one that will; the weekly row touches only `week` rows; the backstop still
  enqueues all.

## Refinements (2026-10-05)

- The unit means "how fast the boundary moves" for rolling expressions and "when the boundary
  jumps" for period ones; the mapping above is right for both. The app's date policy favours
  calendar periods (`this month` over "last 30 days"), so most clock-sensitive rules are period
  rules and land on `day`, `week` or `month`.
- Period boundaries fall at local midnight, so across owners' timezones a week or month turns over
  a window of about a day, never longer. Schedule each unit's cron row **after the last zone has
  crossed** (around 12:00 UTC on the boundary day) so every owner is fresh before anyone looks;
  early zones wait up to half a day. That is a cron time, not a design point. The hourly row is
  zone-free: an hour boundary is the same instant everywhere.
- The app's `hour` floor is on purpose. A two-hour rolling window can be an hour stale at its edge —
  fine for targeting, not for gating a payout; that is a per-use product line, not a minute tier.
