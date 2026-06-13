# COMM-001: Email System

**Status**: 🚧 In Progress (render runtime built; authoring layer is the gap)
**Assignee**: TBD
**Priority**: Medium
**Created**: 2026-02-06
**Updated**: 2026-06-13

---

## Overview

The email **render runtime already exists** in `packages/email`. MJML templates,
reusable components, the ownership cascade, variable interpolation, and
json-rules conditional blocks all work today. What's missing is the **authoring
layer**: a typed, narrowed data surface to build conditions and insert variables
against, instead of hand-writing `Condition` JSON and `{{recipient.x}}` tokens
into MJML. That layer is the rules builder (INFRA-002) over a lens (INFRA-017),
pointed at the email variable roots.

## What already works (`packages/email/render/*`)

- **Conditional blocks, on json-rules** — `evaluateConditions.ts` parses
  `{{#if rule=<Condition JSON>}}…{{/if}}` and runs `check(rule, data)`.
- **Interpolation** — `interpolate.ts`, three fixed roots `sender` / `recipient`
  / `data` (`VariablePrefix`), HTML-escaped.
- **Component system + cascade** — `EmailComponent` / `EmailTemplate` polymorphic
  ownership (`default | admin | Organization | Space`) + `inheritToSpaces`,
  `{{component:slug}}` expansion (`expand.ts`), resolved Space → Org →
  default/admin (`lookupCascade.ts`). An org-owned `default-header`/footer that
  spaces inherit is the existing brand mechanism.
- Save pipeline, MJML validation, Resend/Console clients.

Remaining **runtime** TODOs (separate from this ticket's authoring scope): data
hydration into `Variables`, BullMQ send job, preference/unsubscribe management.
See `docs/claude/COMMUNICATIONS.md`.

## Build scope (authoring layer)

1. **Per-actor narrowed lens** over `{ sender, recipient, data }`, per
   actor-context and template/event type. Space-context authors get a lens
   narrowed to their space (optionally space + org); org-context wider; superadmin
   widest. Shipped to the builder as `exposedSurface` (where-stripped); the `where`
   scope floor is re-applied server-side at send via `applyLens`. Narrowing
   governs *what data can be referenced and how far up the graph an author may
   traverse* — not what they must include.
2. **Authoring UI** — the rules builder (INFRA-002) emitting the exact `Condition`
   JSON `evaluateConditions` already consumes, plus a **field selector**
   (FieldSelector, extracted from the builder) emitting the `{{recipient.x}}`
   tokens `interpolate` already consumes. The builder is the editor for a runtime
   that already runs; it does not replace it.
3. The lens also buys safety the hand-written form lacks today: author-time
   narrowing (can't reference off-surface fields) + save-time validation
   (`describeRule` / `checkRuleAgainstLens`).

For **custom** (no fixed template/payload) emails: the author gets a base lens
over `{ sender, recipient, data }` for their role — same lens, role-differentiated
narrowing.

## Deferred — documented, not built

- **Subtenancy brand lock.** An org setting `spaceEmailPolicy: free | locked` (+
  the locked/required component slugs), enforced server-side: on `locked`,
  `lookupCascade` stops letting a Space override the locked slugs, and save/render
  requires or auto-injects them. The *mechanism* (org component + `inheritToSpaces`
  + cascade) already exists; only the lock/enforcement is missing. **No settings
  table exists** (searched: no `Setting`/`Preference`/`Config`/`Policy` model or
  `settings`/`config` column in the schema) — this lands on the `Organization`
  model's app-fields fence as a typed enum, not a generic settings bag, unless a
  real settings table is introduced first.
- **Feature-flag-gated additive lens grants.** Entitlement/module ownership
  stitches extra `data` fields into the lens (FF is the gating mechanism). The
  base lens stays static + superadmin-authored; grants layer on later.
- **Predicate-composited authoring surfaces** — explicitly *not* pursued: a
  predicate-dependent surface has no stable contract to validate rules against.
  Content variation belongs in the conditional blocks (which already exist), not
  in surface composition.

Market note: static-per-actor/event-type surface + rich template conditionals is
the dominant pattern (Customer.io, Braze, SendGrid, Mailchimp) and matches the
existing `{sender,recipient,data}` + `{{#if rule=}}` split — confirming the
deferrals above.

## Related Tickets

- **Blocked by**: INFRA-002 (rules builder), INFRA-017 (builder surface)
- **Benefits from** (not blocking): INFRA-016 (lens serialization), INFRA-018 (lens builder)
- **Blocks**: FEAT-001 (Inquiry system — needs invite emails)
