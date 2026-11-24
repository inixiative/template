# Artifacts

<!-- toc:start -->

## Contents

- [What an artifact is](#what-an-artifact-is)
  - [Why: no orphans, no rug pulls](#why-no-orphans-no-rug-pulls)
- [Kinds](#kinds)
- [Placements](#placements)
- [Access](#access)
- [Ownership](#ownership)
- [Deleting](#deleting)
- [Navigating](#navigating)
- [Source map](#source-map)

<!-- toc:end -->

---

## What an artifact is

An **artifact** is anything that is owned, placed in containers, shared and made public: a file, a folder, and in forks other kinds. There is one table, `Artifact`, and every artifact is either a **container** (it holds other artifacts: a folder) or an **object** (it doesn't: a file). That is its `type`, set from its kind when it is created and never changed. A kind with content of its own keeps its own tables (`file` → `File`, `FileVersion`).

Why one table: a grant, a placement, and an audit entry each have a single kind of target, and the same access rules serve containers, objects and anything a fork adds. The wider file design (upload, versions, bindings, lazy copy) is `tickets/FEAT-009-file-management.md`.

### Why: no orphans, no rug pulls

**Nothing gets lost by being organised.** File systems that let one item live in several places tend to strand it: remove it from the last folder that showed it and it still exists, still costs storage, and nobody can find it. Here an item can sit in several containers, and an item in no container is simply at its owner's root, so it is never reachable only by search. Placements are soft-deleted and audited, so "where was this, and who moved it" always has an answer. Moving something between places never changes who owns it. Changing ownership is a separate, deliberate act (the `transferArtifact` Inquiry), so reorganising a folder can't silently hand bytes to someone else.

**Using something can't be pulled out from under you.** This is the less common property. When you use an artifact, for example as a logo, an avatar or an attachment (a `ResourceBinding`), you depend on it. If the owner revokes your access or deletes the source, your use is not left broken: it is repointed to a frozen copy that you own (lazy copy, also called copy-on-revoke, FEAT-009 § 6). An active use always triggers this; a grant marked `preserveOnRevoke` opts in without one. The lazy copy is designed but not built yet; the bindings and the grant flag that drive it are in place.

| Problem | Use | Read | Signs you're bypassing it |
|---|---|---|---|
| A thing users own and share: "a file", "a folder", "a document", "something inside a workspace", "an item people can be given access to" | **`Artifact`** · model `packages/db/prisma/schema/artifact.prisma` — one row per thing, `kind` from the catalog, `type` container or object | § Kinds; FEAT-009 § 3 | a new folder or document table with its own owner columns and its own permission table |
| What a kind may contain and its access default: "can a folder hold a folder", "files start private" | **`ArtifactKinds`** · registry `packages/shared/src/artifact/kinds.ts` — `type`, `contains`, `defaultAccess`, `contentModel`, `lazyCopy` | § Kinds | `if (artifact.kind === 'folder')` checks spread through services; `kind in [...]` lists instead of `type` |
| Put something in a folder, file it in two places, move it, copy it, list what is inside: "nest folders", "add to a collection" | **`ArtifactPlacement`** · model — written only through **`placeArtifact`**, **`moveArtifact`**, **`copyArtifact`**, **`createArtifact`**, **`removeArtifactPlacement`** · services `apps/api/src/modules/artifact/services/` | § Placements | a `parentId` or materialized `path` column; `db.artifactPlacement.create` from a controller |
| Share with a person, an org, a space, a member or a customer; time-limited share: "give Bob edit access", "share this folder with the design space" | **`ArtifactPermission`** · model — a role on an artifact, materialized onto inheriting descendants via **`ArtifactEffectivePermission`** | § Access | a per-feature share table; a shared-with JSON column |
| Can this caller read / edit / manage / delete this artifact: "who can see this file", "is it public" | **`validatePermission(action)`** · middleware + **`assertArtifactPermission`** / **`canActOnArtifact`** (`db:artifact` in `rebacSchema` with `ArtifactAncestor` and `ArtifactEffectivePermission` `down` lists) | § Access | a custom permission walk outside `rebacSchema`; reading `artifact.access` alone to decide public |
| Give an artifact to another user, org or space: "hand this file over", "move it to the client's workspace" | **`transferArtifact`** · Inquiry service `apps/api/src/modules/inquiry/services/transferArtifact/` | § Ownership | rewriting `organizationId` on the row; copying the file and deleting the original |
| Read an artifact with its effective access, parents, ancestors, placements, bindings, and (for managers) grants | **`GET /artifact/:id`** (`artifactRead`) | § Navigating | joining placements, grants, and bindings by hand without the caller's view |
| Delete a folder, or delete a folder and what is in it: "empty this folder", "remove the folder but keep the files" | **`deleteArtifact`** · service (`DELETE /artifact/:id`), **`GET /artifact/:id/artifacts?exclusive=true`**, **`/v1/batch`** | § Deleting | a delete that walks a container's members and removes them; a bespoke delete-many endpoint |

---

## Kinds

```ts
// packages/shared/src/artifact/kinds.ts
file:   { type: 'object',    contains: [], defaultAccess: 'private', contentModel: 'File', lazyCopy: true },
folder: { type: 'container', contains: ['file', 'folder'], defaultAccess: 'private' },
```

A fork adds kinds below the template marker. `kind` and `type` are immutable after creation; the `artifactAccess` hook sets `type` from the kind and refuses a kind the catalog does not know. The plain create routes (`{me,organization,space,organizationUser,spaceUser}CreateArtifact`) only create kinds without a `contentModel`.

**No versions on artifacts.** An artifact's history is its audit log (`Artifact`, `ArtifactPlacement` and `ArtifactPermission` are audit-enabled). Only a kind whose content is versioned keeps versions, on its own side table: today that is `file` → `FileVersion`.

---

## Placements

An `ArtifactPlacement` says "this artifact sits in that container". Containment organises; it holds no permissions of its own. Materialized tree tables (`ArtifactAncestor` and `ArtifactEffectivePermission`, kept in sync by `artifactTree` hooks) flatten container inheritance to one hop for ReBAC. An artifact may sit in many containers, and so may a container ("compliance" under both "legal" and "operations").

**Cross-owner placements organise without inheriting.** Placing a shared artifact into another owner's container always sets `ArtifactAncestor.inherits = false` across owner boundaries, so a foreign folder can never widen access or make the artifact `public`. Handing ownership to another owner is still a transfer (§ Ownership).

**The root is not a row.** An artifact with no live placement is at its owner's root (`placements: { none: {} }`, under the soft-delete scope). Removing its last placement just puts it back at the root; deleting stays an explicit action.

| Action | What it does | Needs |
|---|---|---|
| **place** (`POST /artifact/:id/artifactPlacements`) | adds a placement | same owner: `manage` on artifact, `operate` on container; cross owner: `read` on artifact, `operate` on container |
| **move** (`POST /artifact/:id/move`) | replaces one placement with another in one step; either end may be the root | the same, at each container end |
| **copy** (`POST /artifact/:id/copy`) | a new artifact in the container, owned by its owner; a file copy shares the source's bytes until the sweeper copies them (the sweeper, FEAT-009 § 16, is not built yet); a container is copied without its contents | `read` on the source, `operate` on the container |
| **remove** (`DELETE /artifactPlacement/:id`) | removes a placement | same owner: `manage` on artifact, `operate` on container; cross owner: `operate` on container (even if read access was later revoked) |

A placement is refused when the container's kind does not list the artifact's kind (`contains`), or it would close a loop or nest deeper than `ARTIFACT_MAX_DEPTH` (50, longest path via `ArtifactAncestor`).

**Locking.** Placement, access, permission, and delete writes hold `withArtifactOwnersLock` (`withOwnerLock(owner, 'containers')`, locked in deterministic order when two owners are involved) before their transaction opens.

Placements are soft-deleted and audit-enabled.

---

## Access

Artifact authorization lives in `rebacSchema` (`packages/permissions/src/rebac/artifactResourcePermission.ts`) using `@inixiative/permissions` `down` lists (`ancestors` and `effectivePermissions`) plus `tenantPermissionRules`.

`Artifact.access` defaults to `private` and is `inherit`, `public` or `private`:

| `access` | Public? | Takes same-owner containers' grants? |
|---|---|---|
| `inherit` | if any inheriting ancestor is `public` | yes, from every inheriting ancestor |
| `public` | yes | yes |
| `private` | no | no |

**Private means the artifact has only its own permissions.** It takes nothing from its containers, neither their grants nor their public state. You can keep your own things in a public folder. Most artifacts created inside a container inherit.

**4-tier action ladder (`Role` → `Action`):**
- `read` (`viewer`): read artifact details, list folder contents, copy out, cross-owner place.
- `operate` (`member`): rename (`PATCH /artifact/:id` `name`), edit content, add/remove/create items inside a container.
- `manage` (`admin`): change `access`, manage `ArtifactPermission` grants (capped at own role via `roleHeldVia`), move/place same-owner artifacts.
- `own` / `delete` (`owner`): grant/revoke `owner`, transfer ownership, delete (+ org/space `owner` break-glass `delete` on `OrganizationUser`/`SpaceUser` artifacts).

**5-way ownership (`ArtifactOwnerModel`):** `User`, `Organization`, `Space`, `OrganizationUser`, `SpaceUser` — the same ownership model as `Project` and `Integration`:
- `User`: the user owns it (capped by User token role).
- `Organization` / `Space`: org/space owners hold `own` (`delete`), admins hold `manage`; members create (receiving a creator `owner` `ArtifactPermission`), and read/operate other org/space artifacts via `ArtifactPermission`, `public`, or `tenantPermissionRules`.
- `OrganizationUser` / `SpaceUser`: private member-owned workspace inside a tenant. The member owns it; the org/space owner has break-glass `read` and `delete` (no `manage`); admins and peers get `403`. `tenantPermissionRules` skip private member-owned artifacts.

**Explicit grants (`ArtifactPermission`):** materialized onto inheriting descendants via `ArtifactEffectivePermission` (1 `down` jump from `Artifact`; see `tickets/AUTH-014-nested-down-list-walks.md`), with `expiresAt` evaluated live against `actor:Clock.now`. Denied access returns `403` (`404` only when the row does not exist). `db:artifactPermission` uses `roleHeldVia` so a grant can't be created, changed or revoked by someone whose access is below it.

**Creation.** `Artifact.access` defaults to `private`. `createArtifact` creates with `access: 'inherit'` when placed into a same-owner container (unless overridden) and `kind.defaultAccess` at root or cross-owner, in one locked `db.txn`.

Not in this cut: access per placement, row-level `permissionRules`, `Entitlement` targeting artifacts, `Integration` grantees, or Artifact webhooks (tracked separately).

---

## Ownership

Ownership never changes as a side effect. **`transferArtifact`** is an Inquiry from the current owner (a user, organization or space) to the receiver; whoever manages the owner it is leaving may send it.
- The receiver accepts or declines. On accept the artifact's owner changes, its placements in the old owner's containers are removed (it arrives at the receiver's root), and its old grants are revoked, so the receiver starts clean. Every step is in the audit log.
- If the sender asked to keep tracking it (`keepTracking`), the sender keeps a pointer: a `tracking` `ResourceBinding` on the sender plus a `viewer` grant. If the receiver refuses the pointer (`allowTracking: false`), the sender keeps a copy instead. Copies happen only then.
- Auto-approve is off for now (the receiver explicitly approves or declines).
- Only objects transfer for now.

---

## Deleting

- **Deleting an artifact needs `delete`** (`own` on the artifact, or org/space `owner` break-glass on `OrganizationUser`/`SpaceUser` artifacts), and removes all its placements (`softDeleteCascade`).
- **Deleting a container deletes the container, never its contents.** Anything that was only in it is at its owner's root again.
- **Deleting the contents as well is a separate action.** `GET /artifact/:id/artifacts?exclusive=true` lists the artifacts that sit in this container and in no other, among those the caller can read. To delete them, send their `DELETE /api/v1/artifact/:id` requests through `POST /api/v1/batch/execute` with `strategy: 'transactionAll'` (one transaction, all or nothing), contents in the first round and the container, if it goes too, in a later round: a caller whose access to the contents comes through the container loses it once the container is gone. A UI may offer the two together; the API keeps them apart.
- Deleted artifacts' bytes are reclaimed by the orphan sweeper (FEAT-009 § 16).

---

## Navigating

There is no "primary parent": with several parents, `GET /artifact/:id` returns the artifact along with its effective access, readable direct `parents`, full readable `ancestors` graph (`{ artifacts, edges }`, read from `ArtifactAncestor`), visible `placements`, visible `bindings`, and (for managers) direct `permissions` and active `effectivePermissions`:

| View | Route |
|---|---|
| Top of the browser: the owner's root | `GET /me/artifacts`, `/organization/:id/artifacts`, `/space/:id/artifacts`, `/organizationUser/:id/artifacts`, `/spaceUser/:id/artifacts` |
| Artifact detail (access, parents, ancestors, placements, permissions, bindings) | `GET /artifact/:id` |
| Below: direct children (pass `?exclusive=true` for items only in this container) | `GET /artifact/:id/artifacts` |

**A placement in a container the caller can't see doesn't count for them.** The item shows at that caller's root, and `GET /artifact/:id` only returns placements in containers the caller can read and bindings on resources the caller can read (organizations and spaces checked with `fetchAsCaller` against their own read routes; a user's bindings only to that user).

No frontend is built yet.

---

## Source map

| Concern | Path |
|---|---|
| Schema | `packages/db/prisma/schema/artifact.prisma`, `file.prisma` |
| Kind catalog | `packages/shared/src/artifact/kinds.ts` |
| ReBAC rules | `packages/permissions/src/rebac/artifactResourcePermission.ts`, `apps/api/src/modules/artifact/lib/checkArtifactPermission.ts` |
| Materialized tree | `apps/api/src/hooks/artifactTree/hook.ts`, `syncArtifactTree.ts` |
| Placements | `apps/api/src/modules/artifact/services/artifactPlacements.ts`, `removeArtifactPlacement.ts`, `assertNoContainerCycle.ts` |
| Navigation | `apps/api/src/modules/artifact/services/fetchRootArtifacts.ts`, `fetchArtifactAncestors.ts` |
| Ownership | `apps/api/src/modules/inquiry/services/transferArtifact/` |
| Deleting | `apps/api/src/modules/artifact/services/deleteArtifact.ts` |
| Hooks | `apps/api/src/hooks/artifactAccess/hook.ts`, `apps/api/src/hooks/artifactTree/hook.ts` |
| Routes | `apps/api/src/modules/{artifact,artifactPlacement,artifactPermission}/`, `{me,organization,space,organizationUser,spaceUser}CreateArtifact`, `{me,organization,space,organizationUser,spaceUser}ReadManyArtifacts` |
