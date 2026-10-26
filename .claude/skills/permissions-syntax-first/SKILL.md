---
name: permissions-syntax-first
description: Use whenever work touches permissions, auth, tokens, integrations, members, entitlements, the rebac schema (packages/permissions/src/rebac/schema.ts), route permission middleware, or any code that allows, denies, throws 401/403/422, filters or clips. Express the decision in the rule syntax first; anything outside the system needs a written justification the user approves.
---

# Permissions: syntax first

The permission system is the schema plus the library's check. Its syntax reads any path on the hydrated record and on the actor, so almost every question ("is this yours?", "which owner is this?", "may you set this role?") is a condition in a rule. Most mistakes in this area come from building outside it: a new action, a helper, a hook, a validator, a controller 403, a substitution in code. **If you are not using the system, you are allowed zero checks.**

## 1. Read before you edit

- The running rulings doc for the current project, if there is one (e.g. `tmp/permissions-rulings.md`). Every edit names the ruling it implements. No ruling → ask, don't edit.
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
- **entitlement**: a named grant `{ resource, anchor, actions }`; **anchor**: where it acts from.
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
- `{ rule: <json-rules condition> }`: evaluated over `{ ...record, __actor }`. A condition reads any hydrated path (`field: 'integration.userId'`), compares to another path (`path: '__actor.record.id'`), and uses operators (`in`, `notIn`, `equals`, `isEmpty`, …).

The actor is `{ model: 'User' | 'Token', record }` (sanitized row). Rules read it by path; there are no binds and no other actor machinery.

Shared pieces already in `schema.ts` — reuse, don't re-derive:
- `actorIsUser` (`__actor.model == User`), `actorIsDelegateOfUser` (`__actor.record.ownerModel == User`);
- `onOwner(action)`: walk a delegate's direct owner by `ownerModel`;
- `heldAtOwner`: the role on the row is one the actor holds at the direct owner (owner→own, admin→manage, member→operate, viewer→read via `roleToStandardAction`);
- `assignRole(own, manage)`: high roles need `own`, others `manage` — the one role-assignment rule for members and integrations;
- `ownerIsYoursOrTenant(at)`: `${at}ownerModel in [Organization, Space]` or `${at}userId == __actor.record.id`.

Other parts of the system (use them, don't parallel them):
- `canGrantEntitlement` — the only check for writing entitlements;
- `RulesRegistry` json-rules write rules, enforced by the rules hook — row shape (e.g. `full` takes no role or entitlements; where `full` may be set). Don't call `validateRules` from controllers;
- hydration / the lens — relations come from hydrating, never from copying keys;
- the one `full` skip at install (`delegateTable`).

## 3. Stand-in (pseudo) records

An action on something that does not exist yet, or on a collection, is checked on a **stand-in record of the model it is about**, placed under its parent, through the ordinary check:

- **Create:** build the would-be row, hydrate it, check `create` on that model:
  ```ts
  const standIn = await hydrate('token', { id: '', ...row } as HydratedRecord);
  check(permix, rebacSchema, 'token', standIn, TokenAction.create);
  ```
  The rule for creating a token lives on `db:token`, never on the parent (`token.create` on organization/space/user was the bug behind a bypass: stored actions on a member's organization entry satisfied it).
- **Collections are stand-in records too.** Listing a parent's children is an action on a stand-in child under that parent (e.g. tokens of an organization = `read` on `{ ownerModel: 'Organization', organizationId }` as a token), so the rule lives with the child model. Routes that still check an action on the parent (`validatePermission('operate')` on the organization for `/organization/:id/tokens`, `validatePermission('manage')` for creating children) are legacy: don't add new ones; migrate when touched.
- **Updates of permission fields** check the stand-in of the row as it will be written (members use `greaterRole(old, new)` so lowering a higher role is also gated).
- **Grants:** `canGrantEntitlement` itself checks each action on a stand-in of the entry's resource under the anchor.

## 4. Rules from this branch (what went wrong and the syntax answer)

| Built outside the system | The syntax answer |
|---|---|
| `token.create` copied onto six parent models | `create` on a stand-in `db:token` |
| actions named after other models (`organization.create` on user) | each action on its own model (test: a dotted action is named after its model) |
| a `yours` action to hop to the integration | a path condition: `ownerIsYoursOrTenant('integration.')` |
| `leave` as an alternative that skipped the role check | the role check always runs; "yours" is an extra requirement |
| `full` arms in the schema | `full` is inheritance: skipped at install; at write checked as role owner. CI rule `no-full-in-rebac-schema` |
| write-time "ceiling" with a trim in `validateDelegateGrant` | `heldAtOwner` + `assignRole` + `canGrantEntitlement` |
| copying delegated keys onto a stand-in | hydrate the relation and read it |
| explicit `validateRules` in controllers | the rules hook |
| a library clause special-casing "conditional" actions | the owner walk already re-runs the rule's conditions (scan finding; pending) |

## 5. Procedure

1. Name the ruling.
2. Write the decision as a rule over the hydrated record + `__actor`, reusing section 2's pieces. Prefer a condition on a path over a new action, helper or code.
3. If it truly can't be written: write one paragraph — what it decides, why the syntax can't say it — show the user, and stop until they approve.
4. Tests first, in the user's sentences, including attempts to get around the rule (another user's row, a token actor, a lower role, a different tenant). Factories only.
5. Before committing: `bash scripts/ci/run-ci-rules.sh`, the permissions and API suites, and an adversarial pass on just the change.
