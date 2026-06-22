# COMM-001: Email System

**Status**: 🚧 In Progress — render + send engine built; authoring layer (rules/lens) + tracking/prefs/admin UI pending
**Assignee**: TBD
**Priority**: Medium
**Created**: 2026-02-06
**Updated**: 2026-06-14

---

## Current State

The original scope below imagined React Email + SendGrid/SES. The team actually
built an **MJML-based engine that is send-capable end to end today** — so this is
not "not started," and `packages/email` is not a stub. What remains is the
**authoring layer** (typed, narrowed data surface for composing conditions and
inserting variables) plus delivery tracking, preferences, and admin UI.

**Built and operational (verified in code):**
- `packages/email/src/client/` — Resend adapter (real batch send) + Console fallback.
- `packages/email/src/render/` — `compose`/`interpolate`/`expand` MJML pipeline:
  nested components, cycle detection, owner-cascade lookup (Space → Org →
  default/admin), and json-rules **conditional blocks** (`evaluateConditions.ts`
  parses `{{#if rule=<Condition JSON>}}…{{/if}}` → `check(rule, data)`).
- `packages/email/src/targeting/` — declarative recipient resolution (userIds/emails).
- `packages/email/src/verification/` — Bouncer deliverability check + noop fallback.
- `apps/api/src/jobs/handlers/sendEmail.ts` — wired end to end (resolveTargets →
  composeTemplate → interpolate → mjml2html → `client.sendBatch`); emails enqueue
  as BullMQ jobs via the app-event email bridge, not synchronously.
- **Render-error policy** — per-template `onError` enum (`fail`/`degrade`/`fallback`,
  default `fail`). A conditional rule that *throws* at render (not a non-match) is
  surfaced via the evaluator's `onError` sink, always logged, then handled per
  policy: `fail` → `EmailRenderError` → BullMQ retries → DLQ; `degrade` → send with
  the throwing block dropped; `fallback` → re-compose one owner up (`parentOwner`:
  Space → Org → default). Base owners always `fail`. Save-time validates conditionals
  in both `mjml` and `subject`. Debug-only inline error comments gate on
  `EMAIL_INLINE_RENDER_ERRORS` (decoupled from env, so testable).

**Interpolation** today is three fixed roots `sender` / `recipient` / `data`
(`VariablePrefix`, HTML-escaped). See `docs/claude/COMMUNICATIONS.md`.

## The gap = the authoring layer

Conditions are currently hand-written `Condition` JSON inside `{{#if rule=…}}`,
and variables are hand-typed `{{recipient.x}}` tokens. The authoring layer
replaces the hand-writing with a typed editor over a **narrowed lens**:

1. **Per-actor narrowed lens** over `{ sender, recipient, data }`, per
   actor-context and template/event type. Space-context authors get a lens
   narrowed to their space (optionally space + org); org-context wider; superadmin
   widest. Shipped to the builder as `exposedSurface` (where-stripped); the `where`
   scope floor is re-applied server-side at send via `applyLens`. Narrowing governs
   *what data can be referenced and how far up the graph an author may traverse* —
   not what they must include.
2. **Authoring UI** — the rules builder (INFRA-002) emitting the exact `Condition`
   JSON `evaluateConditions` already consumes, plus a **field selector**
   (FieldSelector, extracted from the builder) emitting the `{{recipient.x}}`
   tokens `interpolate` already consumes. The builder is the editor for a runtime
   that already runs; it does not replace it.
3. The lens also buys safety the hand-written form lacks: author-time narrowing
   (can't reference off-surface fields) + save-time validation (`describeRule` /
   `checkRuleAgainstLens`).

For **custom** (no fixed template/payload) emails: the author gets a base lens
over `{ sender, recipient, data }` for their role — same lens, role-differentiated
narrowing.

## Remaining (non-authoring)

- Standard template authoring (welcome, password-reset, verification, invitation)
  — none created yet.
- Admin UI for template management.
- Delivery tracking (open/click/bounce) and per-user preferences/opt-out.
- Per-tenant provider/adapter + template owner/locale resolution (sendEmail uses
  the first registered adapter and `{ ownerModel: 'default', locale: 'en' }` today).
  This is also the seam that activates the render-error policy beyond `fail` — until
  a send resolves to a non-base owner, `degrade`/`fallback` are unreachable. The
  policy machinery ships now and threads through the cascade unchanged.

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

- **Blocked by**: INFRA-002 (rules builder), INFRA-017 (builder surface) — for the authoring layer only; core send works today.
- **Benefits from** (not blocking): INFRA-016 (lens serialization), INFRA-018 (lens builder)
- **Blocks**: FEAT-001 (Inquiry system — needs invite emails)
