# COMM-004: Contact Ownership Verification (gate communication settings on it)

**Status**: 📋 Proposed — gap identified, not started
**Assignee**: TBD
**Priority**: Medium
**Created**: 2026-06-20
**Updated**: 2026-06-20

---

## The gap

Communication settings — `Contact.acceptedKinds` (the per-channel opt-in/opt-out) —
live on `Contact`, but **nothing verifies the owner actually controls that channel**
(the email address / handle). `Contact` already has a `verifiedAt` field, but:

- `acceptedKinds` is honored regardless of `verifiedAt`.
- `canDeliver(kind, contact, customerRef)` (`apps/api/src/lib/messaging/canDeliver.ts`)
  gates on `acceptedKinds` only — it never checks `verifiedAt`.
- The `Contact` schema comment already flags this: global-within-type uniqueness is
  *"intentionally omitted until handle ownership can be verified (OAuth / DNS proof)."*

So anyone who can create a `Contact` row sets (or clears) delivery preferences for an
address they may not own. The opt-in/opt-out is unenforceable and spoofable, and we may
deliver to — or suppress for — the wrong party.

## Why it matters

Deliverability + compliance (CAN-SPAM/GDPR opt-out) rest on the settings being the
*real owner's* choice. Unverified channels make both the opt-in (we email someone who
never opted in on an address they don't control) and the opt-out (someone suppresses an
address that isn't theirs) untrustworthy.

## Direction (to design)

- A verification flow that sets `Contact.verifiedAt` by proving channel ownership
  (email: signed verify link; future handles: OAuth/DNS). Relates to
  [COMM-002](./COMM-002-email-validation.md) (validation is deliverability ≠ ownership).
- Gate **settings trust + non-`system` delivery on `verifiedAt`**: `canDeliver` (or the
  recipient settings layer in [COMM-003](./COMM-003-sender-and-communication-log.md))
  should treat an unverified contact's `acceptedKinds` as untrusted — likely
  "don't deliver non-system kinds to unverified channels."
- Decide the unverified-channel default (suppress vs. deliver-system-only).

## Related: minimize direct sends

Direct/`raw` sends (a bare address with no `Contact`) are the extreme of this gap — no
ownership, no settings, no opt-out. COMM-003 therefore restricts `raw` to `system` kind,
so every non-`system` communication flows through a verifiable, settings-bearing
`Contact`. Reducing direct sends shrinks this gap's blast radius; verification (this
ticket) closes the rest.

## Open questions
- Re-verification cadence / expiry of `verifiedAt`?
- Org/Space-owned contacts: who verifies a shared channel?
