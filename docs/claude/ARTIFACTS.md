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

An **artifact** is anything that is owned, placed in containers, shared and made public: a file, a folder, and in forks other kinds. There is one table, `Artifact`, with an immutable `kind` (`ArtifactKind` Prisma enum). Whether a kind can hold children is determined from the catalog (`ArtifactKinds` in `packages/shared/src/artifact/kinds.ts`, via `isContainerKind` / `canContain`). A kind with content of its own keeps its own tables (`file` → `File`, `FileVersion`).

Why one table: a grant, a placement, and an audit entry each have a single kind of target, and the same access rules serve folders, files and anything a fork adds. Follow-up tickets cover file storage/uploads (`tickets/FEAT-029-file-storage-and-versioning.md`), bindings/lazy-copy sweeper (`tickets/FEAT-030-resource-bindings-and-lazy-copy.md`), webhooks (`tickets/FEAT-031-artifact-webhooks.md`), and the browser UI (`tickets/FEAT-032-file-browser-ui.md`).

### Why: no orphans, no rug pulls

**Nothing gets lost by being organised.** File systems that let one item live in several places tend to strand it: remove it from the last folder that showed it and it still exists, still costs storage, and nobody can find it. Here an item can sit in several containers, and an item in no same-owner container is simply at its owner's root. Placements are soft-deleted and audited, so "where was this, and who moved it" always has an answer. Moving something between places never changes who owns it. Changing ownership is a separate, deliberate act (the `transferArtifact` Inquiry), so reorganising a folder can't silently hand bytes to someone else.

**Using something can't be pulled out from under you.** When you use an artifact (e.g. as a logo, avatar, or attachment via `ResourceBinding`), revoking your access or deleting the source repoints your use to a frozen copy you own (`tickets/FEAT-030-resource-bindings-and-lazy-copy.md`). The schema columns (`ResourceBinding`, `preserveOnRevoke`, `fromVersion`, `File.sourceFileId`) are in place for that phase.

| Problem | Use | Read | Signs you're bypassing it |
|---|---|---|---|
| A thing users own and share: "a file", "a folder", "a document", "something inside a workspace" | **`Artifact`** · model `packages/db/prisma/schema/artifact.prisma` — one row per thing, `kind` from `ArtifactKind` enum | § Kinds; `tickets/FEAT-009-file-management.md` | a new folder or document table with its own owner columns and its own permission table |
| What a kind may contain and its access default: "can a folder hold a folder", "files start private" | **`ArtifactKinds`** · registry `packages/shared/src/artifact/kinds.ts` — `contains`, `defaultAccess`, `contentModel`, `lazyCopy`, `isContainerKind` | § Kinds | `if (artifact.kind === 'folder')` checks spread through services |
| Put something in a folder, file it in two places, move it, copy it | **`ArtifactPlacement`** · model — written only through **`placeArtifact`**, **`moveArtifact`**, **`copyArtifact`**, **`createArtifact`**, **`removeArtifactPlacement`** · services `apps/api/src/modules/artifact/services/` | § Placements | a `parentId` or materialized `path` column; `db.artifactPlacement.create` from a controller |
| Share with a person, an org, a space, a member or a customer; time-limited share; leave a share | **`ArtifactPermission`** · model — materialized onto inheriting descendants via **`ArtifactEffectivePermission`**; grantees read shares via `GET /{owner}/artifactPermissions` and leave via `DELETE /artifactPermission/:id` | § Access | a per-feature share table; a shared-with JSON column |
| Can this caller read / edit / manage / delete this artifact | **`validatePermission(action)`** · middleware + **`assertArtifactPermission`** / **`canActOnArtifact`** (`db:Artifact` in `schemaMap` with `ArtifactAncestor` and `ArtifactEffectivePermission` `down` lists) | § Access | a custom permission walk outside `schemaMap`; reading `artifact.access` alone to decide public |
| Give an artifact to another user, org or space | **`transferArtifact`** · Inquiry service `apps/api/src/modules/inquiry/services/transferArtifact/` | § Ownership | rewriting `organizationId` on the row; copying the file and deleting the original |
| Read an artifact with its 1-step neighborhood (direct parents, direct children, permissions, bindings) | **`GET /artifact/:id`** (`artifactRead`, backed by `resourceContextArgs` `includeArtifactDetail`) | § Navigating | joining placements, grants, and bindings by hand without the caller's view |
| Delete a folder, or delete a folder and its exclusive contents | **`DELETE /artifact/:id`** (`artifactDelete`), `children` (`exclusive: true`) on **`GET /artifact/:id`**, **`/v1/batch`** | § Deleting | a delete that walks a container's members and removes them; a bespoke delete-many endpoint |

---

## Kinds

```ts
// packages/shared/src/artifact/kinds.ts (mirrors enum ArtifactKind in artifact.prisma)
file:   { contains: [], defaultAccess: 'private', contentModel: 'File', lazyCopy: true },
folder: { contains: ['file', 'folder'], defaultAccess: 'private' },
```

A fork adds kinds below the template marker in both `enum ArtifactKind` (`packages/db/prisma/schema/artifact.prisma`) and `ArtifactKinds`. `kind` is immutable after creation (`immutableFields`). The plain create routes (`{me,organization,space,organizationUser,spaceUser}CreateArtifact`) only create kinds without a `contentModel`.

**No versions on artifacts.** An artifact's history is its audit log (`Artifact`, `ArtifactPlacement` and `ArtifactPermission` are audit-enabled). Only a kind whose content is versioned keeps versions, on its own side table: today that is `file` → `FileVersion`.

---

## Placements

An `ArtifactPlacement` says "this artifact sits in this owner's workspace" — either inside a container (`containerArtifactId` set, owned by the container's owner) or pinned at the owner's root (`containerArtifactId` null, for external public/shared artifacts). Containment organises; it holds no permissions of its own. Materialized tree tables (`ArtifactAncestor` and `ArtifactEffectivePermission`, kept in sync by `artifactTree` hooks) flatten container inheritance to one hop for ReBAC. An artifact may sit in many containers, and so may a container ("compliance" under both "legal" and "operations").

**Cross-owner placements organise without inheriting.** Placing a shared or public artifact into another owner's container always sets `ArtifactAncestor.inherits = false` across owner boundaries, and root pins (`containerArtifactId = null`) never touch `ArtifactAncestor`, so a foreign folder or root pin can never widen access or make the artifact `public`. Handing ownership to another owner is still a transfer (§ Ownership).

**Own root is not a row.** Your own artifact with no live same-owner container placement is at your root (`placements: { none: { containerArtifactId: { not: null }, containerArtifact: owner } }`). Removing its last same-owner placement puts it back at the root; deleting stays an explicit action. Root placements (`POST /{owner}/artifactPlacements`) are only for pinning external readable artifacts at an owner's root.

| Action | What it does | Needs |
|---|---|---|
| **place in container** (`POST /artifact/:id/artifactPlacements`) | adds a container placement | same owner: `manage` on artifact, `operate` on container; cross owner: `read` on artifact, `operate` on container |
| **pin at root** (`POST /{owner}/artifactPlacements`) | pins an external readable artifact at the owner's root (`containerArtifactId = null`) | `read` on artifact + owner operate/manage (`db:ArtifactPlacement.create`) |
| **move** (`POST /artifact/:id/move`) | replaces one placement with another in one step; either end may be the root | the same, at each container end |
| **copy** (`POST /artifact/:id/copy`) | a new artifact in the container, owned by its owner; a file copy shares the source's bytes until the sweeper copies them (`tickets/FEAT-030-resource-bindings-and-lazy-copy.md`); a container is copied without its contents | `read` on the source, `operate` on the container |
| **remove** (`DELETE /artifactPlacement/:id`) | removes a placement (container or root pin) | same-owner container: `manage` on artifact, `operate` on container; cross-owner container: `operate` on container (even if read access was later revoked); root pin: owner operate/manage (`db:ArtifactPlacement.delete`) |

A placement is refused when the container's kind does not list the artifact's kind (`contains`), it would close a loop, it would nest deeper than `ARTIFACT_MAX_DEPTH` (50, longest path via `ArtifactAncestor`), or the container already holds `ARTIFACT_MAX_CHILDREN` (500) direct items.

**Locking.** Placement, access, permission, transfer, and delete writes hold `withArtifactOwnersLock` (`withOwnerLock(owner, 'containers')`, locked in deterministic order when multiple owners are involved) before locking rows with `db.findForUpdate`.

Placements are soft-deleted and audit-enabled.

---

## Access

Artifact authorization lives in `schemaMap` (`packages/permissions/src/rebac/artifactResourcePermission.ts`) using `@inixiative/permissions` `down` lists (`ancestors` and `effectivePermissions`) plus `tenantPermissionRules`.

`Artifact.access` defaults to `private` and is `inherit`, `public`, `tenant` or `private`:

| `access` | Visibility | Takes same-owner containers' grants? |
|---|---|---|
| `inherit` | inherits from inheriting ancestors (`public` > `tenant` > `private`, default `private`) | yes, from every inheriting ancestor |
| `public` | readable by any caller (public, subject to token grants ceiling) | yes |
| `tenant` | readable by anyone with `read` on the owning tenant (`Organization` → org `read`, `Space` → space `read`, `OrganizationUser` → org `read`, `SpaceUser` → space `read`; `User` has no tenant so same as `private`) | yes |
| `private` | only owner/admins + explicit `ArtifactPermission` grants | no |

**Private means the artifact has only its own permissions.** It takes nothing from its containers, neither their grants nor their public state. You can keep your own things in a public folder. Most artifacts created inside a container inherit.

**4-tier action ladder (`Role` → `Action`):**
- `read` (`viewer`): read artifact details, copy out, cross-owner place.
- `operate` (`member`): rename (`PATCH /artifact/:id` `name`), edit content, add/remove/create items inside a container.
- `manage` (`admin`): change `access`, manage `ArtifactPermission` grants (capped at own role via `roleHeldVia`), move/place same-owner artifacts, create org/space artifacts.
- `own` / `delete` (`owner`): grant/revoke `owner`, transfer ownership, delete (+ org/space `owner` break-glass `delete` on `OrganizationUser`/`SpaceUser` artifacts).

**5-way ownership (`ArtifactOwnerModel`):** `User`, `Organization`, `Space`, `OrganizationUser`, `SpaceUser` — the same ownership model as `Project` and `Integration`:
- `User`: the user owns it (capped by User token role).
- `Organization` / `Space`: org/space owners hold `own` (`delete`), admins hold `manage` and create org/space artifacts; members access org/space artifacts via `ArtifactPermission`, `public`, or `tenantPermissionRules`.
- `OrganizationUser` / `SpaceUser`: private member-owned workspace inside a tenant. The member owns and creates in it; the org/space owner has break-glass `read` and `delete` (no `manage`); admins and peers get `403`. `tenantPermissionRules` skip private member-owned artifacts.

**Explicit grants (`ArtifactPermission`):** materialized onto inheriting descendants via `ArtifactEffectivePermission` (1 `down` jump from `Artifact`; see `tickets/AUTH-014-nested-down-list-walks.md`), with `expiresAt` evaluated live against `actor:Clock.now`. Denied access returns `403` (`404` only when the row does not exist). `db:ArtifactPermission` uses `roleHeldVia` so a grant can't be created, changed or revoked by someone whose access is below it, and defines `leave` so grantees can revoke themselves via `DELETE /artifactPermission/:id`.

**Creation.** `Artifact.access` defaults to `private`. `createArtifact` creates with `access: 'inherit'` when placed into a same-owner container (unless overridden) and `kind.defaultAccess` at root or cross-owner, in one locked `db.txn`.

Not in this cut: access per placement, row-level `permissionRules`, `Entitlement` targeting artifacts, `Integration` grantees, or Artifact webhooks (`tickets/FEAT-031-artifact-webhooks.md`).

---

## Ownership

Ownership never changes as a side effect. **`transferArtifact`** is an Inquiry from the current owner (a user, organization or space) to the receiver; whoever manages the owner it is leaving may send it.
- The receiver accepts or declines. On accept, under `withArtifactOwnersLock`, the artifact's owner changes, all of its placements are removed (it arrives at the receiver's root), and its old grants are revoked, so the receiver starts clean. Every step is in the audit log.
- If the sender asked to keep tracking it (`keepTracking`), the sender keeps a pointer: a `tracking` `ResourceBinding` on the sender plus a `viewer` grant. If the receiver refuses the pointer (`allowTracking: false`), the sender keeps a copy instead. Copies happen only then.
- Auto-approve is off for now (the receiver explicitly approves or declines).
- Only non-container artifacts transfer for now.

---

## Deleting

- **Deleting an artifact needs `delete`** (`own` on the artifact, or org/space `owner` break-glass on `OrganizationUser`/`SpaceUser` artifacts), and removes all its placements (`softDeleteCascade`).
- **Deleting a container deletes the container, never its contents.** Anything that was only in it is at its owner's root again.
- **Deleting the contents as well is a separate action.** `GET /artifact/:id` includes `children` with an `exclusive` boolean (items that sit in this container and no other). To delete them, send their `DELETE /api/v1/artifact/:id` requests through `POST /api/v1/batch/execute` with `strategy: 'transactionAll'` (one transaction, all or nothing), contents in the first round and the container in a later round: a caller whose access to the contents comes through the container loses it once the container is gone.
- Deleted artifacts' bytes are reclaimed by the orphan sweeper (`tickets/FEAT-030-resource-bindings-and-lazy-copy.md`).

---

## Navigating

Artifacts are a flat table of nodes; navigating a tree is reading placements:

| View | Route |
|---|---|
| Owner's root (paginated + `filterLens` + naive SQL visibility reflection; pass `search` / `searchFields` to search across the whole owner tree; includes `permissions` for managers; `organization`, `space`, and `user` are public-callable and reflect caller visibility) | `GET /me/artifacts`, `/user/:id/artifacts`, `/organization/:id/artifacts`, `/space/:id/artifacts`, `/organizationUser/:id/artifacts`, `/spaceUser/:id/artifacts` |
| Shared with owner ("Shared with me": paginated active `ArtifactPermission` rows with each `artifact` inline, including `CustomerRelationship` shares) | `GET /me/artifactPermissions`, `/organization/:id/artifactPermissions`, `/space/:id/artifactPermissions`, `/organizationUser/:id/artifactPermissions`, `/spaceUser/:id/artifactPermissions` |
| Owner's placements (paginated root pins + container placements with `artifact` and `containerArtifact` inline, filtered to caller-readable targets) | `GET /me/artifactPlacements`, `/organization/:id/artifactPlacements`, `/space/:id/artifactPlacements`, `/organizationUser/:id/artifactPlacements`, `/spaceUser/:id/artifactPlacements` |
| Single artifact + 1-step neighborhood (effective access `{ role, access }`, direct readable `parents` & `children` with their permissions for managers and `exclusive` flag on children, visible `placements` & `bindings`, direct & effective `permissions` for managers) | `GET /artifact/:id` |

`GET /artifact/:id` loads its 1-step relations via `resourceContextArgs` (`includeArtifactDetail`) and filters them per-caller in `artifactReadController` (bindings checked via ReBAC `db:User`, `db:Organization`, `db:Space`).

No frontend is built yet (`tickets/FEAT-032-file-browser-ui.md`).

---

## Source map

| Concern | Path |
|---|---|
| Schema | `packages/db/prisma/schema/artifact.prisma`, `file.prisma` |
| Kind catalog & caps | `packages/shared/src/artifact/kinds.ts` |
| ReBAC rules | `packages/permissions/src/rebac/artifactResourcePermission.ts`, `apps/api/src/modules/artifact/lib/checkArtifactPermission.ts` |
| Materialized tree | `apps/api/src/hooks/artifactTree/hook.ts`, `syncArtifactTree.ts` |
| Placements & creation | `apps/api/src/modules/artifact/services/{createArtifact,placeArtifact,placeArtifactAtRoot,moveArtifact,copyArtifact,removeArtifactPlacement}.ts`, `lib/artifactPlacementHelpers.ts` |
| Navigation & shared | `apps/api/src/modules/artifact/queries/artifactIncludes.ts`, `controllers/artifactRead.ts`, `lib/readableArtifactWhere.ts`, `services/paginateOwnerArtifacts.ts`, `apps/api/src/modules/artifactPermission/lib/sharedWithOwnerWhere.ts`, `apps/api/src/modules/artifactPlacement/lib/paginateOwnerArtifactPlacements.ts` |
| Ownership | `apps/api/src/modules/inquiry/services/transferArtifact/` |
| Deleting | `apps/api/src/modules/artifact/controllers/artifactDelete.ts` |
| Routes | `apps/api/src/modules/{artifact,artifactPlacement,artifactPermission}/`, `{me,organization,space,organizationUser,spaceUser}{Create,ReadMany}Artifact`, `userReadManyArtifacts`, `{me,organization,space,organizationUser,spaceUser}ReadManyArtifactPermissions`, `{me,organization,space,organizationUser,spaceUser}{Create,ReadMany}ArtifactPlacement` |
