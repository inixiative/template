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

## Shape (Aron, 2026-10-03)

Not a reference row. A column on the table that holds the rule, derived at save, saying the rule
has something date-sensitive that needs recomputing on a schedule, and how fine. One fact per
rule, read by the sweep as a `where`.

- **The engine owns "does this rule read `now`".** json-rules already classifies date values:
  `ago`/`ahead` (rolling, units years → seconds), `this`/`last`/`next` (period), `start`/`end`
  (edge); `isDateExpr` is the gate and `requireNow` is where evaluation demands a clock. Add a
  fold beside `ruleSourceValues`: `ruleClockUnit(rule): ClockUnit | null` with
  `ClockUnit = hour | day | week | month | quarter | year`, the smallest unit any date expression
  in the tree depends on (Aron, 2026-10-05: six units, each its own tick). Rolling: seconds,
  minutes and hours → `hour`; days → `day`; weeks → `week`; months → `month`; quarters →
  `quarter`; years → `year`. Period and edge: the period unit.
  Absolute dates and column-to-column `path` compares → `null`. Walks `all`/`any`/relation/aggregate/window
  nodes like the other folds; a hand-rolled walk in the segment module is wrong under v3 bindings.
- **`Segment.clockUnit`**, a nullable enum column, written by the `segmentRuleReferences`
  after-write hook next to `syncRuleReferenceEdges`, so it is derived in the same place as the
  edges and rebuilt on revive with them. The column lives on the rule-bearing table, the way
  `conditions` does; a second materialized rule surface gets its own column. Email templates and
  components evaluate at render and materialize nothing, so they need no tick and no column.
- **One job per unit.** `sweepSegments` takes `{ clockUnit?: ClockUnit }` in its cron payload and
  `sweepableSegments(filter)` adds the `where`; dependency order is unchanged. Six cron rows pick
  up their own unit — hourly, daily (keep 04:00), weekly, monthly, quarterly, yearly — beside the existing nightly
  backstop over every sound dynamic segment. Hourly is the floor; a finer tick is a product
  decision, not a default.
- **Same column on derived enrichment maps.** When FEAT-020 lands, a derived map folds `clockUnit`
  from its own rules on the same hook and a synthetic map declares it, so one enum and one sweep
  family cover every materialized rule surface (Zealot: `IntegrationMap`, ZLT-5215).
- **Dependents need no column.** A segment that reads a clock-sensitive segment's membership is
  refreshed by the dependents fan-out `reconcileSegment` already runs after a diff.

## Not in scope

Sliding-window aggregates over many rows ("more than five orders in the last 90 days") stay a
derived-enrichment concern (FEAT-020): bucketed per-day counts summed at read, with a daily tick
dropping the expired bucket. A rolling window on a date column does not need buckets; the tick
alone keeps it fresh.

## Tests

- Fold: rolling hours → `hour`; rolling minutes → `hour`; `thisWeek` → `week`; `lastQuarter` → `quarter`; `thisYear` → `year`; absolute date → `null`; a date expression
  nested under `any` → relation → aggregate is found; `path` compare → `null`.
- Hook: saving a rolling rule writes `clockUnit`; editing it to an absolute date clears it;
  revive rebuilds it.
- Sweep: the hourly row enqueues only `hour` segments, the weekly row only `week`; the backstop still enqueues all.

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
- Hourly is the floor on purpose. A two-hour rolling window can be an hour stale at its edge —
  fine for targeting, not for gating a payout; that is a per-use product line, not a minute tier.
