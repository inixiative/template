# COMM-013: Email errors and degraded rule behaviour — problem statement

**Status**: problem statement (2026-09-10), no decisions yet. Parked from the #74 review.
**Stack**: #74 ← #91 ← #96 ← #97. Everything below is what the branches do today.

## The problem

A template is validated when it is written, against grammar and, only when a lens is
passed in, against that lens. It is rendered much later, against data shaped by a lens and
a registry that may have changed since, through components that may have been edited,
shadowed or deleted, with rules that may no longer address anything. There are two error
channels with different vocabularies and different reach: write time throws typed errors
and rolls the save back; read time reports free-form strings into a sink and then applies
a per-row policy. The policy reaches only part of the failure space, the sink's strings
carry no type the API or a UI can act on, and several failure modes are silent to
everyone, including the log.

## Two channels today

**Write time** (`saveEmailTemplate`, `saveComponents`). Throws, transaction rolls back.
`ParseBlocksError` (six reasons), `MjmlValidationError`, `ConditionValidationError`
(issues with path and message), `DivergentDuplicateSlugError`, `EmailRenderError`
`circular_ref` from `validateNoCycle`, and a bare `Error` for a non-system template
without an unconditional unsubscribe token. Reach: the whole payload, template and
inlined component bodies. `assertValidConditions` runs without a lens on both branches
that save, so the lens check never runs at save.

**Read time** has two sub-channels.

- *Throws before the policy*: `composeTemplate` throws `EmailRenderError`
  `template_missing`, `component_missing`, `circular_ref`. `onError` never sees these.
  `deliverEmail` marks the CommunicationLog `failed`, rethrows, BullMQ retries three times
  with backoff, then DLQ. The error is deterministic and is retried anyway.
- *The sink*: `settle` reports strings (a rule threw, rule JSON invalid, each attribute
  errors, each over cap, each path not an array, token resolved to an object,
  unterminated each). `settleTemplate` collects them, logs a warning, then applies the
  row's policy: `fail` throws `render_failed` into the same retry path; `degrade` sends
  what settled; `fallback` recomposes one owner up and re-settles, looping until a base
  owner, where the policy is forced to `fail`.

## Error states, enumerated

| # | Condition | Detected | What happens | Who sees it |
|---|---|---|---|---|
| 1 | Rule references a path the lens no longer provides | never | `check` on a missing field is false, branch silently skipped, no sink | nobody |
| 2 | Rule JSON invalid | save throws; render sinks | policy | log |
| 3 | Rule throws at render | render | sink then policy; under `degrade` the whole if-block drops; with the inline flag the gated body renders | log |
| 4 | each filter throws mid-array | render | sink; elements that passed before the throw still render | log, output partial |
| 5 | each over element cap or depth | render | sink; block renders nothing | log |
| 6 | Reserved-root token resolves to nil (`{{recipient.x}}`) | never | literal token ships in the email, no sink | the recipient |
| 7 | Token on an unknown root or binding | never | literal token ships | the recipient |
| 8 | Token resolves to an object | render | sink; literal stays | log and recipient |
| 9 | Component missing at render (deleted, or its shadow removed with no parent) | render | `component_missing` thrown, failed, retries, DLQ; policy does not apply | ops |
| 10 | Component missing at read (`hydrate`) | read | bare ref kept, no error | editor |
| 11 | Persisted component cycle | save, render and hydrate all throw `circular_ref` | | ops or editor |
| 12 | `degradedComponentRefs` | versioning hook, on ref writes | index-list projection only; compose never consults it | admin list |
| 13 | No template anywhere in the cascade | render | `template_missing`, failed, retries, DLQ | ops |
| 14 | Base owner with `degrade` or `fallback` | render | forced to `fail` | ops |
| 15 | Rail-provided system token not supplied | never | literal token ships | the recipient |
| 16 | Bind name missing at planning | planning | plain `Error` in `sendEmail` before any CommunicationLog exists; retries; DLQ | ops |
| 17 | Bind present but null | planning | where equals null, zero recipients, info log "jobs=0" | nobody |
| 18 | Sender pick reads an empty field | planning | plain `Error`, as 16 | ops |

## Staleness: what drifts between write and read

- **Which lens validated the rule?** None. Save passes no lens. #97 stores a lens on the
  row and serves the projection to the authoring UI, but the save path does not read the
  row's lens, and the registry entry's lens is never consulted at save either.
- **Registry picks change on deploy.** Tokens and rule paths that depended on a pick go
  dead with no signal (rows 1, 6).
- **Schema changes.** A removed field would fail `validateRule` against a lens at the next
  save of that row. Nothing revalidates rows that are not resaved.
- **Component edited at a parent tier.** Every inheriting template gets the new body: new
  slots, new tokens, new expectations. No template is revalidated. #97 derives and stores
  `expectations` on the component at save; nothing reads them.
- **Shadow lifecycle.** Shadow deleted with a parent present: falls back, fine. Parent
  deleted with children referencing it: `degradedComponentRefs` marks the ref, compose
  throws at the next send.
- **Snapshots** (#91) make sent mail recomposable from its pins. Live renders always use
  live rows, so staleness is only ever discovered at send.

## The read/write asymmetry

Write time knows the template and its inlined bodies, but not the lens and not the data.
Read time knows the data, validates nothing, and evaluates. The question in the middle,
"is this row still valid against its lens and its live components", has no owner and no
time at which it is asked.

## What the policy covers and does not

`onError` covers sink errors only. Not missing templates or components, not cycles, not
planning failures, not provider failures. `degrade` does not have one meaning: an if-block
whose rule threw drops entirely; an each whose filter threw renders the elements that
passed; a token that missed ships as literal text. `fallback` re-renders the whole
template one tier up, so the recipient gets a different email, not the same email without
the failing block, and it walks down to the base owner and then fails.

## Questions to rule on

1. Is there a third time, a validation pass on save of any row in the cascade, on deploy,
   or on demand, that checks every template against its lens and its resolved components
   and writes a status rather than throwing? `degradedComponentRefs` is the one existing
   example of that shape.
2. Does `degrade` get one meaning: a failing block renders nothing, an unresolved token
   renders empty, never literal? Is literal token output ever acceptable?
3. Should read-time errors be typed (reason plus path) like write-time errors, so the
   sink is a list of issues the API can map and a UI can show?
4. Should missing component and cycle at render go through the policy (a `fallback` one
   tier up would resolve a missing shadow) instead of straight to DLQ?
5. `fail` retries three times on a deterministic error. Is a render error ever retryable?
6. The inline-errors flag reads `process.env` inside the library and renders the gated
   body. Caller option, or gone?
7. Which lens does save validate against: the row's (#97), the registry entry's, or the
   projection? (COMM-012 open item 3.)
8. Planning failures (16 to 18) happen before a CommunicationLog exists. Are they recorded
   anywhere?
