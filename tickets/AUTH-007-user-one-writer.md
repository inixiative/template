# AUTH-007: One writer and one resolver for a User by address

**Status**: 🆕 Not Started
**Assignee**: Unassigned
**Priority**: Medium (the find-then-create races surface as 500s today)
**Created**: 2026-10-05
**Updated**: 2026-10-05

Port of Zealot #2447 (ZLT-4988, merged 2026-10-03). Zealot had a create/alias/race dance copied into every path that made a member from an email address. It replaced them with one writer (`createFanUserAtBrand`) and one resolver (`findFanUserForAddress`), and put every inline trim + lowercase behind `normalizeFanUserEmail`. The template has the same shape in miniature: two paths create a `User`, and neither is race-safe.

The batch side of #2447, an upserting `findForUpdate` fence over many keys, is INFRA-034 (#148). This ticket is the single-address writer, which needs only the single-key upserting fence already on main.

## What template has (verified on main 2026-10-05)

Two `db.user.create` call sites outside factories:

- `modules/user/services/findOrCreateGuest.ts` (`findUserOrCreateGuest`). It runs `findUnique({ email })` outside any lock, then creates inside `db.txn`. Callers: `organizationCreateOrganizationUser`, `resolveInquiryTarget`.
- `lib/identity/resolveUserByContact.ts`. It runs `contact.findFirst` and then `user.create` + `contact.create` in one txn, without a lock. The `User` gets a stub email from `ContactRegistry[type].toStubEmail`.

Normalization:

- `modules/user/utils/normalizeEmail.ts` is `toLowerCase().trim()`, used by `findOrCreateGuest` and `spoofMiddleware`.
- `hooks/userEmailContact/hook.ts` builds the email contact's `valueKey` with a bare `user.email.toLowerCase()`, so there is no trim and it doesn't go through `normalizeEmail`.
- Better Auth sign-up (`lib/auth.ts`) writes the `User` row itself through its adapter, outside both services.

Constraints that make the races real:

- `User.email` is `@unique` across tombstones, and `User` has `deletedAt`, which `softDeleteScopeExtension` scopes out of reads.

## Problems

1. **Find-then-create races.** Two concurrent `findUserOrCreateGuest(email)` calls both miss, and the loser's create throws P2002, which surfaces as a 500. `resolveUserByContact` has the same race on the contact `valueKey`.
2. **A tombstoned address can't be reached.** The soft-delete-scoped `findUnique` misses a deleted `User`, the create then hits the unique on its email, and the result is a 500. Zealot settled this case: the address links to the existing row and revives it (`reactivateFanUserMembership`), rather than refusing.
3. **Normalization is per call site.** The contact hook keys by its own lowercase, so `" A@x.com"` and `"a@x.com"` can produce different `valueKey`s for one `User`.
4. **A third writer.** Better Auth creates users without the shared normalizer or the revive rule.

## What to build

- **One writer**, e.g. `createUserForAddress` under `modules/user/services/`, which `findUserOrCreateGuest` and `resolveUserByContact` both call. It:
  - normalizes once with `normalizeEmail`;
  - calls `db.findForUpdate('User', { email }, { upserting: true })` inside `db.txn`, reaching tombstones via `db.withDeleted`;
  - returns a live row, revives a tombstone in place, and otherwise creates one row and emits `user.created`.
  - A contended lock that times out is a 409, never a raw P2002.
- **One resolver** for "which `User` holds this address", used by the writer and by every read-by-email (`findUserByEmail`, spoof, inquiry targeting). The resolver takes the raw address and normalizes it itself, so callers can't skip it.
- **`resolveUserByContact`** fences the contact key (`type`, `valueKey`) the same way, then writes the `User` through the writer.
- **`userEmailContact` hook** keys by `normalizeEmail(user.email)`.
- **Better Auth**: route its user create through the writer (a `databaseHooks.user.create.before` that normalizes and revives), or record why it can't be. Decide which during the work, not here.
- **Tests**, against a real DB and no mocks:
  - two concurrent guest creates for one address produce one `User`;
  - creating for a tombstoned address revives that row;
  - padded or mixed-case input lands on the same `User` and the same contact `valueKey`;
  - two concurrent `resolveUserByContact` calls for one handle produce one `User`.

## Not to port

- Zealot's brand alias (`aliasFanUserID`) and the brand-scope argument (`requireBrandScope`). Template identity is one `User` per address across organizations, and membership is `OrganizationUser`, so there is no per-tenant alias row.
- The approval-path specifics (`updateApplicantStatus`'s 409 copy, notification addressing). The template has no applicant flow.

## Related

- INFRA-034 (#148): the batch upserting fence. Bulk user creation goes through it once both land.
- Zealot ruling: FanUsers identity is email + brand, behind one set of primitives (2026-09).
