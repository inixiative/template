# COMM-014: Per-org sending domains (bring-your-own sender)

**Status**: 📋 Stub — not started. Zealot ships this first (Linear project "Per-brand email domains", Steven, Oct 2026); port once the Zealot shape settles.
**Assignee**: TBD
**Priority**: Low (template sends under one platform domain today; nothing is broken)
**Created**: 2026-10-05
**Updated**: 2026-10-05

## Problem

Every org's mail is signed by the one platform sending domain, whatever the `from` address says. Inbox
providers check who signed, not who claims to send, so a `from` on the org's own domain fails
alignment, and every org shares one sending reputation: one org's complaint spike degrades delivery for
all of them.

## What Zealot is building (the shape to port)

- Each org gets its own verified sending domain: DNS records issued by the platform, verification
  state on the org, mail signed by the same domain recipients see.
- Reputation is isolated per org.
- Rollout is staged and reversible: send-rate controls and a stop switch first, a staging rehearsal,
  one internal canary org on real traffic, then orgs one at a time with evidence at each gate. The
  shared sending path stays live as the rollback the whole way.
- Out of scope there and here: retiring the shared path, the email builder surface, any change for
  orgs without a verified domain.

## Open for template

- Where the verified domain lives: on `Sender` (COMM-003) or on the org. Zealot's answer decides this.
- Whether the provider abstraction in COMM-001 already carries per-domain credentials or needs a
  per-org signing configuration.
- The gate ledger and halt breaker Zealot built for the rollout: port as a generic staged-rollout
  primitive, or leave as Zealot-only operations tooling.

## Related

- [COMM-001](./COMM-001-email-system.md) (render + send engine), [COMM-003](./COMM-003-sender-and-communication-log.md) (Sender model)
- [FEAT-007](./FEAT-007-white-labeling.md) (custom domains for the app surface — a sibling concern, not the same one)
- Zealot: Linear project "Per-brand email domains" (P-ZLT-730), ZLT-4611, ZLT-5200
