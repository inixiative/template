# COMM-010: {{#each}} loops with per-block `as=` identifier + json-rules filter= predicate

**Status**: 🟡 Designed — ready to build
**Assignee**: Unassigned
**Priority**: Medium
**Created**: 2026-07-08
**Updated**: 2026-07-08

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

## Scope

`packages/email/src/render/`: `conditionParser.ts`, `evaluateConditions.ts`, `interpolate.ts`, `validateConditions.ts` + tests.
