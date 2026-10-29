---
name: permissions-syntax-first
description: Use whenever work touches permissions, auth, tokens, integrations, members, entitlements, the rebac schema (packages/permissions/src/rebac/schema.ts), route permission middleware, or any code that allows, denies, throws 401/403/422, filters or clips. Express the decision in the rule syntax first; anything outside the system needs a justification that survives the user and an adversary.
---

# Permissions: syntax first

The permission system is the schema plus the library's check. Its syntax reads any path on the hydrated record and on the actor, so almost every question ("is this yours?", "which owner is this?", "may you set this role?") is a condition in a rule. Most mistakes in this area come from building outside it: a new action, a helper, a hook, a validator, a controller 403, a substitution in code. **If you are not using the system, you are allowed zero checks** — anything outside it is justified to the user and an adversary, or it doesn't get written.

## 0. Scope: build the ruling, nothing next to it

The goal of a unit is the ruling's sentence, and the change ends there. When this work has gone wrong it has gone wrong the same way: a ruling left a "how" open, the gap was filled with a new mechanism, and that mechanism was then defended and extended instead of asking.

- **Every new function, option, callback, type, list or library export is named by a ruling.** A plan line, a review finding or my own reading is not a ruling. If the ruling leaves the how open, ask with the existing primitive you would use; never invent one to close the gap.
- **No hard-coded model lists.** Where a record sits comes from the polymorphism registry and the relations (`schemaMap`, `hydrate`), never from a list of models in code.
- **A problem gets the smallest fix inside what exists.** Before adding a layer, check whether `check`, `hydrate`, a json-rules option or a body refinement already answers it. A review finding is fixed at its own size; any new concept it suggests goes to the user as a question.
- **Library changes are the ruling's change only.** No new schema objects, refinements or exports beyond the ask. Validation of request bodies lives in `bodyRefinement` / `queryRefinement` / `paramsRefinement` (`docs/claude/API_ROUTES.md`), never as a `.refine` / `z.custom` on a schema object.
- **When the user asks "how did we rule on this", the answer is in `tmp/permissions-rulings.md`.** Read it before proposing; a question that a ruling already settles is never put back to the user.
- **Circling is the signal to stop.** If the same area comes back a second time with a new mechanism, stop building, quote the ruling and the existing primitive, and ask one question.

## 1. Read before you edit

- The running rulings doc (`tmp/permissions-rulings.md`; create it if missing — the user requires one). Process rule: every edit names the ruling it implements; no ruling → ask, don't edit.
- `docs/claude/PERMISSIONS.md`, Vocabulary section. Names are composed of vocabulary words: user, tenant (user/organization/space), member (OrganizationUser/SpaceUser), JWT, token, actor, owner, delegate (token or integration), permissions (`{ role, full, entitlements }`), anchor, entitlement. No aliases (`person`, `seat`, `claim`, `hasUser` are wrong).

## 1a. Disentangle before you design

Permissions questions tangle because one sentence mixes several parties and several kinds of access. Untangle mechanically before writing any rule:

**Step 1 — name the parties**, each with a vocabulary word:
- **actor**: who is making the request (a user via JWT or spoof, or a token). Says nothing about relationships.
- **user**: a person's account. Only a user is ever superadmin.
- **tenant**: user, organization or space.
- **member**: the row joining a user to an organization or space (OrganizationUser, SpaceUser).
- **delegate**: something that acts for its owner: a token or an integration.
- **owner**: the immediate thing a delegate belongs to (owners all the way down).
- **permissions**: a delegate's `{ role, full, entitlements }`.
- **entitlement**: a named grant `{ resource, anchor: { resource, id, path? }, where?, actions }`; **anchor**: the record it acts from, reached from the entitled record along `path` (relation names; none for a self anchor).
- **pseudo record**: the would-be row checked for a create or a collection action.

**Step 2 — put every requirement in exactly one bucket**, for the thing X it is about:

| Bucket | Question | Example: integration | Example: token |
|---|---|---|---|
| 1. Access to X | who can see or reach X | `read` on it | listing tokens |
| 2. Actions on X itself | who administers X | `own` / `manage`: its user, or your role at its org/space | revoke, rename |
| 3. X's access to other things | what X can reach, as a narrowing of its owner | its role / entitlements / full, set at or below its owner | its role / entitlements / full, checked against the minter |
| 4. Acting with X, on its behalf | what X does as an actor | execution — out of scope (Signet) | requests made with the token (`__actor.model == Token`) |

**Step 3 — never let one bucket answer another.** A bucket-2 fact ("M manages their integration") must not satisfy a bucket-3 check ("M may give a token admin access") — that merge produced a real bug. A bucket-4 fact (the actor is a token) is a condition on the actor, not on the thing.

**Step 4 — one named group per bucket in the schema** (e.g. `integrationAdministering`, `integrationAccess`), spread into the model's actions. If a requirement doesn't fit one bucket, it is two requirements.

## 2. What the syntax can say

An action rule (`ActionRule`) is one of:
- a string: another action on the same record (`manage: 'own'`);
- `null`: terminal — only a held grant passes;
- `{ rel: 'organization', action: 'own' }`: walk a hydrated to-one relation (dotted paths walk further: `'sourceSpace.organization'`) and ask an action there;
- `{ any: [...] }` / `{ all: [...] }`;
- `{ rule: <json-rules condition> }`: evaluated over `{ ...record, __actor }`. A condition reads any hydrated path (`field: 'integration.userId'`), compares to another path (`path: '__actor.record.id'`), and uses positive operators only (`equals`, `in`, comparisons; "no value" is `equals null`). Negations, `isEmpty`, `notExists`, `if`/`then`/`else`, array and aggregate rules are refused (json-rules `validateRule(…, { positive: true })`).

The actor is `{ model: 'User' | 'Token', record }` (sanitized row). Rules read it by path; there are no binds and no other actor machinery.

Shared pieces already in `schema.ts` — reuse, don't re-derive:
- `actorIsUser` (`__actor.model == User`), `actorIsDelegateOfUser` (`__actor.record.ownerModel == User`);
- `actionOnOwner(action)`: walk a delegate's direct owner by `ownerModel`;
- `roleHeldAtOwner`: the role on the row is one the actor holds at the direct owner (owner→own, admin→manage, member→operate, viewer→read via `roleToStandardAction`);
- `memberRoleWrite(tenant)` / `integrationRoleWrite`: manage the row's tenant (the integration itself) and hold there the role being set; `memberRemoval(tenant)` = `leave` or `memberRoleWrite`. Rules routes and controllers check, never named actions;
- `actorIsItsUser(at)`: `${at}userId` is set and is the acting user (or a User-owned token of that user), narrowed by `manage` on that user;
- `ownedByYouOrOrganizationOrSpace(at)`: owned by an organization or space, or `actorIsItsUser(at)`;
- `ownedBy(owners, at)` and `actionOnOwner(action, at, owners)` with a path prefix (e.g. `'integration.'`): the one per-owner expansion; pass the owner models a rule covers instead of a separate gate.

Other parts of the system (use them, don't parallel them):
- `placeEntitlement` + `canGrantEntitlement` (library, over `schemaMap`) — the only check for writing entitlements, validity included; entitlements change only through `PATCH …/:id/entitlements` (`{ add, remove }`, both through that check), never a record update;
- `RulesRegistry` json-rules write rules, enforced by the rules hook — a row's own columns only (`full` takes no role or entitlements; where `full` may be set; a token has permissions). Nothing in a rules object reads an entitlement or its anchor. Don't call `validateRules` from controllers;
- hydration / the lens — relations come from hydrating, never from copying keys;
- the one `full` skip at install (`delegateTable`).

## 3. Pseudo records

An action on something that does not exist yet, or on a collection, is checked on a **pseudo record of the model it is about**, placed under its owner, through the ordinary check:

- **Create:** build the would-be row, hydrate it, check `create` on that model:
  ```ts
  const standIn = await hydrate('token', { id: '', ...row } as HydratedRecord);
  check(permix, rebacSchema, 'token', standIn, TokenAction.create);
  ```
  The rule for creating a token lives on `db:token`, never on its owner (`token.create` on organization/space/user was the bug behind a bypass: stored actions on a member's organization entry satisfied it).
- **Collections are pseudo records too** (user, 10-26): `validateSubmodelPermission(action)` checks the action on a pseudo record of the route's submodel under the loaded owner (from the polymorphism registry); it never reads the body. Lists that are really "which of these can I see" (spaces of an organization, member-shaped lists, customers, segment memberships, inquiries) stay a model check on the real owner until AUTH-008.
- **Role writes** (members, integrations) need the body, so they run in the controller: `memberRoleWrite` / `integrationRoleWrite` on the row as it is and on the row as it will be.
- **Grants:** the library's `placeEntitlement` builds one pseudo record per kind the entry reaches, from the hydrated anchor down the path (each step's known foreign keys, each owner placed under the anchor), and `canGrantEntitlement` checks each action on every one. A polymorphic step reaches every kind that carries its keys (`organization` on an integration = the org's, its spaces', its members'); the `where`'s root leaves (the `where`, or each leaf of its top `all`) on the kind field narrow the first step's kinds, each checked with json-rules; the path already fixes the keys, so leaves on them narrow nothing.

## 4. Rules from this branch (what went wrong and the syntax answer)

| Built outside the system | The syntax answer |
|---|---|
| `token.create` copied onto six owner models | `create` on a pseudo record `db:token` |
| actions named after other models (`organization.create` on user) | each action on its own model (test: a dotted action is named after its model) |
| a `yours` action to hop to the integration | a path condition: `ownedByYouOrOrganizationOrSpace('integration.')` |
| `leave` as an alternative that skipped the role check | the role check always runs; "yours" is an extra requirement |
| `full` arms in the schema | `full` is inheritance: skipped at install (`delegateTable`); setting it takes `own` on the owner. CI rule `no-full-in-rebac-schema` |
| write-time "ceiling" with a trim in `validateDelegateGrant` | `roleHeldAtOwner` + `memberRoleWrite`/`integrationRoleWrite` + `canGrantEntitlement` |
| copying delegated keys onto a pseudo record | hydrate the relation and read it |
| explicit `validateRules` in controllers | the rules hook |
| a library clause special-casing "conditional" actions | removed in 0.8: the owner walk already re-runs the rule's conditions |
| `greaterRole` folded into one role check | two checks: the role-write rule on the row as it is and as it will be |
| members' extra actions stored flat on the role table | entitlements `{ resource, anchor, actions }` like delegates (queue item 15) |
| a second traversal returning conditions ("proofs") to carry into a grant | the ordinary check on a pseudo record pinned by the `where`'s exact `equals` values; missing fields read as unknown (json-rules `absent: 'unknown'`) |
| splitting a `where` into branches, one pseudo record each | one pseudo record; anything not pinned exactly stays unknown, so a filtered writer is refused |
| narrowing what an entitlement reaches to patch a grant-check hole (direct owner, one branch per path) | the path names the anchor and axis, every kind on it is reached, the `where` narrows; the grant judges every kind it reaches |
| an "own the tenant/anchor" escape hatch beside the grant check | the normal check on the placed pseudo record, nothing else |
| `z.custom` / `.refine` on a schema object for rule validation | shape-only schemas; validation in a reusable body refinement |

## 4a. Principles, in the user's words

- "the entitlement is supposed to grant whatever it says... making other machinery around it is a bit bad smelly"
- "One thing that checks if you can assign a member or integration a role. One thing that detects if you can write the token from your perspective. One thing that... grants some entitlements. One machine that skips for full. We shouldn't have multiple copies."
- "everything that we need already exists. Please verify... before you're writing new functions"
- "The syntax is very robust. The fact that you keep trying to build things outside of it is the source of half of our problems."
- "Actor is just: are you a user or a token? It doesn't say anything about your relationships." Only a JWT or a spoof is a user.
- "you shouldn't be able to do things for other people's members or integrations. If it is a member and it's not you, no."
- An integration has three parts: administering it, its access to its owner, its executions (out of scope).
- "Are we making things simpler?"

## 5. Procedure

1. Name the ruling.
2. Write the decision as a rule over the hydrated record + `__actor`, reusing section 2's pieces. Prefer a condition on a path over a new action, helper or code.
3. If it truly can't be written: write one paragraph — what it decides, why the syntax can't say it — show the user, and stop until they approve.
4. Tests first, in the user's sentences, including attempts to get around the rule (another user's row, a token actor, a lower role, a different tenant). Factories only.
5. One change at a time: an adversarial pass on the plan before building, then on the change. Behaviour changes beyond the ask are proposals, never applied.
6. Before committing: `bash scripts/ci/run-ci-rules.sh`, the permissions and API suites, and an adversarial pass on just the change.
