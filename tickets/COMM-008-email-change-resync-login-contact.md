# COMM-008: User email-change → re-sync the login-email Contact

**Status**: 📋 Proposed — gap found in ZLT-3008 review
**Priority**: Low

---

**Gap:** a user's login email is effectively **creation-time only**. `userEmailContact` mirrors
`User.email` into a `User`-owned email `Contact` on **create only** (`[DbAction.create,
createManyAndReturn]`), and that contact is **locked against manage** (403, from the login-email
lock). There is no `changeEmail` endpoint. So if `User.email` ever changes, the mirror contact
goes stale and can't be edited through the API.

**Open question first:** do we even want user-initiated email change, or is the login email
immutable by design (change = new account / re-invite)? Decide before building.

**If we do support it:**
- An email-change endpoint with **re-verification** (the new address must be verified before it
  becomes the login).
- **Re-sync the login-email `Contact`** when `User.email` changes — naturally a background job or a
  `User` *update* hook (the current hook is create-only), since the contact is the canonical
  deliverable address and feeds deliverability/opt-outs.
- Respect/relax the login-email contact lock during that sync.
