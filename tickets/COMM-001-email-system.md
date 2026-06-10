# COMM-001: Email System

**Status**: 🚧 In Progress — send engine built; authoring/tracking/UI pending (see Current State)
**Assignee**: TBD
**Priority**: Medium
**Created**: 2026-02-06
**Updated**: 2026-06-09

---

## Current State (2026-06-09)

The scope below imagined React Email + SendGrid/SES. The team actually built an **MJML-based
engine**, send-capable end to end today — so this is not "not started," and `packages/email` is
not a stub.

**Built and operational (verified in code):**
- `packages/email/src/client/` — Resend adapter (`resend.ts`, real batch send) + Console fallback.
- `packages/email/src/render/` — `compose`/`interpolate`/`expand` MJML pipeline: nested components,
  cycle detection, owner-cascade template lookup (Space → Org → default).
- `packages/email/src/targeting/` — declarative recipient resolution (userIds/emails).
- `packages/email/src/verification/` — Bouncer deliverability check + noop fallback.
- `apps/api/src/jobs/handlers/sendEmail.ts` — wired end to end (resolveTargets → composeTemplate →
  interpolate → mjml2html → `client.sendBatch`); emails enqueue as BullMQ jobs via the app-event
  email bridge, not synchronously.

**Remaining (the real "not done" for this ticket):**
- Standard template authoring (welcome, password-reset, verification, invitation) — none created yet.
- Admin UI for template management.
- Delivery tracking (open/click/bounce) and per-user preferences/opt-out.
- Rule-based conditional automation (depends on INFRA-002 rules builder).
- Per-tenant provider/adapter resolution (sendEmail uses the first registered adapter today).

Original intent notes retained below; treat engine specifics (React Email / SendGrid / SES) as
superseded by the MJML + Resend implementation above.

---

## Overview

Complete the email system stub with transactional email templates, delivery tracking, and rule-based automation. Requires rules builder for conditional email logic.

## Key Components

- **Templates**: React Email for beautiful emails
  - Welcome email
  - Invitation email
  - Password reset
  - Receipts/invoices
  - Notifications
  - Digest emails
- **Providers**: Support Resend, SendGrid, AWS SES
- **Delivery tracking**: Open rates, click rates, bounces
- **Rules engine**: Conditional email sending (requires INFRA-002)
- **Preferences**: User opt-in/opt-out per email type
- **Queue**: BullMQ integration for reliable delivery

## Reference

- TODO.md: Line 99 (I18n package)
- Current: `packages/email/` (built engine — see Current State above, no longer a stub)
- User note: "Blocked by rules builder" (applies to rule-based automation only; core send works)

## Related Tickets

- **Blocked by**: INFRA-002 (Rules builder)
- **Blocks**: FEAT-001 (Inquiry system - needs invite emails)

---

_Engine built (see Current State 2026-06-09); remaining scope is templates, tracking, prefs, admin UI, and rules-based automation._
