# COMM-014: Template variants, liveness and untombstone

**Status**: ruled 2026-09-20 (discussion on PR #105), not built.
**Depends on**: #105 (email lens, segments), FEAT-003 (feature flags: variant rows = label + value + segment).

## Rulings

- **One row per natural key; delete tombstones, recreate untombstones.** A template's identity is its slug, locale, owner and variant. Delete is a soft delete. Saving on a tombstoned key revives the row in place (same id, new body, `deletedAt: null`); components revive with it through the cascade's timestamp group. Reference: Zealot's `saveScopedRow` (insert, catch the unique violation, look up with deleted rows visible, update in place) and its test "same uuid, one row for the slug".
- **AuditLog runs the normal polymorphism.** Hard deletes of audited models are already refused (`preventHardDelete`); the audit hook's hard-delete branch, which writes a subject-less row, is dead in production. Remove the branch and its test and drop the rules hook's AuditLog skip. No exception in the rule generator.
- **Templates get `variant` and `live`; components do not.** `variant` names the branch (`default` when nothing names one); `live` says whether the variant may be served. They are separate: with flags choosing variants, liveness is per variant, not exclusive across the slug. A draft is a variant with `live: false` — preflight and preview see it, the planner never sends it. Components stay one row per slug; their history is the audit snapshot.
- **Selection belongs to flags and segments.** A feature-flag variant value is the template variant name; `sendEmail` resolves the variant for the recipient and the cascade looks up `{ slug, locale, owner, variant, live: true }`, falling back to `default`. The template row never learns who gets it.

## Build

1. `EmailTemplate.variant String @default("default")`, `EmailTemplate.live Boolean @default(true)`; the natural-key uniques gain `variant`; every lookup (`lookupAtOwner`, cascade, compose, planner) carries `variant` and `live: true`; preflight/preview may name a non-live variant.
2. `saveScopedRow` revives a tombstoned natural key (`withDeleted` lookup → update in place). Consider Zealot's single `ownerKey` column so the unique can be full rather than three partials.
3. A soft-delete template route (admin and tenant tiers as the cascade allows).
4. Audit hook: remove the hard-delete branch and its test; rules hook: `Object.keys(RulesRegistry)` with no skip.
5. `sendEmail`: variant from the flag evaluation for the recipient (FEAT-003 seam), default otherwise; `CommunicationLog` records the variant served.
6. Invariant: a slug that sends needs a live `default` variant; preflight warns when it is missing.

## Open

- Does a tenant override (Organization/Space row) inherit the platform's variants, or only `default`? Undefined until FEAT-022 inheritance.
- Whether `live: false` on `default` means "slug retired" (no send at all) or "fall through the cascade to the parent tier".
