# COMM-014: Template variants, liveness and untombstone

**Status**: ruled 2026-09-20 (discussion on PR #105). The untombstone half is built as of 2026-10-06: build step 2 (revive in place in `saveScopedRow`) and the full-unique change (the natural-key uniques no longer exclude deleted rows). The variants half (steps 1, 3 to 6) is not built.
**Depends on**: #105 (email lens, segments), FEAT-003 (feature flags: variant rows = label + value + segment).

## Rulings

- **One row per natural key; delete tombstones, recreate untombstones.** A template's identity is its slug, locale, owner and variant. Delete is a soft delete. Saving on a tombstoned key revives the row in place (same id, new body, `deletedAt: null`); components revive with it through the cascade's timestamp group. Reference: Zealot's `saveScopedRow` (insert, catch the unique violation, look up with deleted rows visible, update in place) and its test "same uuid, one row for the slug".
- **One row per natural key, tombstones included (Aron, 2026-10-06).** The uniques are no longer partial on `deletedAt`; they stay partial on `ownerModel`, because each tier keys on its own nullable FK column. Re-create revives the tombstone in place with the same id, so a second tombstone for a key cannot exist. `saveScopedRow` stays read-then-write (live lookup, then a `withDeleted` tombstone lookup, then `revive` and update), because a partial index cannot be an `ON CONFLICT` target; a create race on a key that has never existed is rejected by the unique as a unique violation.
- **AuditLog runs the normal polymorphism.** Hard deletes of audited models are already refused (`preventHardDelete`); the audit hook's hard-delete branch, which writes a subject-less row, is dead in production. Remove the branch and its test and drop the rules hook's AuditLog skip. No exception in the rule generator.
- **Templates get `variant` and `live`; components do not.** `variant` names the branch (`default` when nothing names one); `live` says whether the variant may be served. They are separate: with flags choosing variants, liveness is per variant, not exclusive across the slug. A draft is a variant with `live: false` — preflight and preview see it, the planner never sends it. Components stay one row per slug; their history is the audit snapshot.
- **Selection belongs to flags and segments.** A feature-flag variant value is the template variant name; `sendEmail` resolves the variant for the recipient and the cascade looks up `{ slug, locale, owner, variant, live: true }`, falling back to `default`. The template row never learns who gets it.

## Build

1. `EmailTemplate.variant String @default("default")`, `EmailTemplate.live Boolean @default(true)`; the natural-key uniques gain `variant`; every lookup (`lookupAtOwner`, cascade, compose, planner) carries `variant` and `live: true`; preflight/preview may name a non-live variant.
2. Built 2026-10-06. `saveScopedRow` revives a tombstoned natural key (`withDeleted` lookup → update in place), and the twelve natural-key uniques on `EmailTemplate` and `EmailComponent` cover deleted rows. Zealot's single `ownerKey` column, which would let the unique drop the tier predicates too, is still open.

   **Dev databases.** There is no migrations directory; the schema lands through `db:push`. A dev database that already holds duplicate tombstones for one natural key will refuse the new uniques, so collapse them by hand before pushing: per (slug, locale, owner) keep the newest row and delete the rest. This is dev-only data, so collapsing it by hand loses nothing that matters.
3. A soft-delete template route (admin and tenant tiers as the cascade allows).
4. Audit hook: remove the hard-delete branch and its test; rules hook: `Object.keys(RulesRegistry)` with no skip.
5. `sendEmail`: variant from the flag evaluation for the recipient (FEAT-003 seam), default otherwise; `CommunicationLog` records the variant served.
6. Invariant: a slug that sends needs a live `default` variant; preflight warns when it is missing.

## Open

- **v1 forces `default`.** Ship the columns, the untombstone and the audit cleanup with the planner always serving the live `default` variant (a forced default flag value); rule- and segment-driven A/B selection comes back later on the FEAT-003 seam.

- Does a tenant override (Organization/Space row) inherit the platform's variants, or only `default`? Undefined until FEAT-022 inheritance.
- Whether `live: false` on `default` means "slug retired" (no send at all) or "fall through the cascade to the parent tier".
