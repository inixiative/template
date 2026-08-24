# COMM-010: {{#each}} loops with per-block `as=` identifier + json-rules filter= predicate

**Status**: 🟡 Designed — ready to build
**Assignee**: Unassigned
**Priority**: Medium
**Created**: 2026-07-08
**Updated**: 2026-07-13

---

## Overview

Sibling to COMM-009 (converged with Zealot `ZLT-3326`, 2026-07-08). Today the only way to render a list (digest rows, reference lists) is to pre-render it into a `data` string upstream, which defeats the authoring story. This adds a loop block to the render grammar.

Dotted-path traversal is already in place here (`interpolate.ts` resolves `{{data.mission.name}}` via lodash `get`, with the `UNSAFE_PATH_SEGMENTS` prototype-pollution guard) — loops build directly on it.

## Grammar

```
{{#each data.brands as=brand}}
  <mj-text>{{brand.name}}</mj-text>
  {{#each brand.missions as=mission index=i filter={"field":"mission.status","operator":"equals","value":"active"}}}
    <mj-text>{{i}}. {{mission.name}} — for {{brand.name}}</mj-text>
    {{#if rule={"field":"mission.reward","operator":"greaterThan","value":100}}}
      <mj-text>High value</mj-text>
    {{/if}}
  {{/each}}
{{/each}}
```

- `{{#each <path> as=<name>}}…{{/each}}` — body rendered once per element, bound to `<name>`.
- **Every block declares its own identifier (`as=` is required).** This is what makes nested loops work: each level names its binding, inner scopes see all enclosing bindings, and there is no shadowing rule at all.
- **Identifier value = same slug constraints as component slugs** (`[a-z0-9-]+`, the `extractRefs.ts` `OPEN_TAG` charset). **Internal collision detection**: an `as=`/`index=` name that collides with `sender|recipient|data` or an enclosing in-scope loop binding is a validation error, not a shadow — enforced at parse time and in save-time validation (`validateConditions.ts`).
- `index=<name>` — optional; binds the 0-based counter only when declared. Same slug constraint + collision rules.
- `filter=` — optional json-rules Condition (below).
- `$` stays out of the grammar entirely — json-rules already owns `$` for relative paths inside array rules; author-named identifiers make a fixed loop token (`$$`/`this`/`item`) unnecessary.

## One scope object, everywhere

Per element, extend the enclosing scope with the declared bindings: `{ sender, recipient, data, <every in-scope as=/index= name> }`. All three consumers read the same scope:

- **substitution** — the variable pattern accepts any `{{<ident>.<path>}}` where `<ident>` is a reserved prefix or slug-shaped; resolution stays lodash `get` against the scope, `UNSAFE_PATH_SEGMENTS` guard included. An identifier not in scope stays visible in the output (existing unresolved behavior), so top-level behavior is unchanged outside loops.
- **`filter=`** — evaluated with `check(rule, scope)` per element; fields are absolute against the scope (`mission.status`), and `path`-RHS can reference `sender`/`recipient`/`data` or any enclosing binding. Filtering never grows its own operator language; json-rules' `$`/array-rule relative semantics inside the condition are untouched.
- **loop-body conditionals** — `{{#if}}` inside the loop evaluates against the same scope: `each` is handled in the same recursive pass as `if`, threading the loop scope through `evaluateConditions` instead of the top-level variables.

One mental model for authors and one code path for the engine.

## Parser

`parseIfBlock`'s depth-aware scanning and `readRuleMarker` generalize to a second block type; nested each/if compose through the same depth counter. The each marker reads a path token, `as=<name>` (required), optional `index=<name>`, optional `filter=` JSON via the existing `findJsonEnd`.

Errors through the existing `RuleErrorSink` posture (render nothing, report): missing `as=`, non-slug identifier, collision with a reserved prefix or an enclosing loop binding, non-array / missing path at the marker.

## Builder surface (when the FE lands here)

- Insert-loop control: wraps the selection in `{{#each <path> as=<name>}}…{{/each}}`; path from the lens picker restricted to array-valued paths; `as=` default proposed from the path's last segment (`data.missions` → `mission`), renameable, collisions rejected inline.
- Variable picker + rule builder expose every enclosing binding (`<name>.*` typed as the element of its path, plus declared `index=` names) when the caret is inside each-blocks.

## Bring-back from Zealot #1689 / #1655 (2026-07-13)

The Zealot loop build (`#1689`, ZLT-3326, reviewed 2026-07-12) and lens picker (`#1655`, ZLT-3289) surfaced pieces to port here.

### 1. Single-pass `settle()` walker — the structural prerequisite for loops

`interpolate.ts` is two-pass today (`evaluateConditions(...)` → a trailing global `.replace(VARIABLE_PATTERN)`). Zealot `#1689` collapses `{{#if}}` + substitution into one recursive walker (`settle.ts`) that substitutes each text run exactly once at its emit-depth. This is **required** for `{{#each}}`: loop scope bindings must be threaded per-element through a single recursive pass — a flat global regex replace cannot express nested per-element scope. Port the walker as the foundation the rest of this ticket builds on.

**Not a security fix (verified 2026-07-13).** An earlier note flagged the two-pass path as a substitution-injection hole (a `data` value containing `{{recipient.email}}` re-resolving on the second pass). Reproduced against the real module — it does **not** happen: JS `String.replace(globalRegex, cb)` scans the original string once and never re-scans inserted replacement text, so a data-borne token comes out **literally**, unresolved (`{{data.note}} = "{{recipient.email}}"` → output `"{{recipient.email}}"`, no leak). `settle()` is a correctness/loop refactor, not a hardening item — do not prioritize it as a CVE.

### 2. Loop control-flow (the `{{#each}}` body of this ticket)

Port `#1689`'s loop control-flow from `settle.ts` (`as=` binding, optional `index=`, per-element `filter=` json-rules predicate, object-value-leaves-token-visible). **Do NOT port Zealot's desugar-to-absolute-paths step** — that is a workaround for json-rules being binding-free, and template already has real bindings (PR #74's declarative registry). json-rules stays binding-free; the email builder recomposes absolute paths **in its own layer**. Carry the 2026-07-12 locks: explicit bindings everywhere, reserved names = the 2 sources + the derived union, no object display.

### 3. Save-time JSON-opacity WARNING (never a 422)

Port `#1689`'s `collectJsonOpacityWarnings`: walk the FieldMap hop-by-hop and **warn** (never reject) when a `filter=`/`{{#if rule=}}` path descends beneath a `kind:'scalar', type:'Json'` column — where `checkRuleAgainstLens` is structurally blind, so the rule silently never-matches at send. This stays **email-layer** (uses the same path recomposition as #2); it is **not** promoted into `@inixiative/json-rules` (decision 2026-07-13 — json-rules gets no generic tree-walk helper; `walkConditionTree` stays a Zealot email-layer local).

### 4. `{{system.*}}` reserved tokens (from #1655)

`{{system.now}}` / `{{system.year}}` resolved internally at send, own-property-guarded, caller `data`/`recipient`/`sender` cannot override. Fold into the `settle` port (§1). Extends the reserved-prefix set beyond `sender|recipient|data`.

### 5. Email rule lens = compose synthetic ∪ generated, then prune

The `filter=` / rule surface lens should be a **real** `@inixiative/json-rules` lens rooted at a synthetic `EmailRuleContext` (recipient/sender/data), composed by merging the synthetic models into the generated Prisma FieldMap (`lensFor`) then pruning to `maxDepth` — the **same** lens gating the builder field surface, `checkRuleAgainstLens` on save, and runtime `check()`. Do not hand-type a pseudo-lens (materializes the lens-single-source doctrine; models here are template-native, only the technique ports).

## Scope

`packages/email/src/render/`: `conditionParser.ts`, `evaluateConditions.ts`, `interpolate.ts`, `validateConditions.ts` + tests. Plus a new `settle.ts` (§1) and the save-time opacity warning surface (§3).
