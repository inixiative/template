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

An **artifact** is anything that is owned, placed in containers, shared and made public: a file, a folder, a workspace root, and in forks other kinds. There is one table, `Artifact`, with an immutable `kind` (`ArtifactKind` Prisma enum). Whether a kind can hold children is determined from `packages/shared/src/artifact/index.ts` (`isContainerKind`, `isRootKind`, `canContain`). A kind with content of its own keeps its own tables (`file` → `File`, `FileVersion`).

Why one table: a grant, a placement, and an audit entry each have a single kind of target, and the same access rules serve folders, files and anything a fork adds. Follow-up tickets cover file storage/uploads (`tickets/FEAT-029-file-storage-and-versioning.md`), bindings/lazy-copy sweeper (`tickets/FEAT-030-resource-bindings-and-lazy-copy.md`), webhooks (`tickets/FEAT-031-artifact-webhooks.md`), and the browser UI (`tickets/FEAT-032-file-browser-ui.md`).

### Why: no orphans, no rug pulls

**Nothing gets lost by being organised.** File systems that let one item live in several places tend to strand it: remove it from the last folder that showed it and it still exists, still costs storage, and nobody can find it. Here every owner gets an eager `root` container (`ArtifactKind.root`, provisioned by the `ownerRootArtifact` DB hook on owner create/revive and cached per owner via `fetchThroughCache`), every item created in Drive starts with a placement, and removing an owned item from its last non-root container (or deleting that container) automatically reparents it back to the owner's root (`access: 'private'`) via the `artifactTree:placement` DB hook (`reparentOrphanedArtifacts`). Placements are hard-deleted (`HARD_DELETE_ON_TOMBSTONE`) and audit-enabled (`AuditLog` retains full `before`/`after` history; reviving an artifact places it fresh at root via `REGENERATE_ON_REVIVE` without resurrecting old folder placements). Moving a placement never changes who owns it or crosses owners. Changing ownership is a separate, deliberate act (the `transferArtifact` Inquiry), so reorganising a folder can't silently hand bytes to someone else.

**Using something can't be pulled out from under you.** When you use an artifact (e.g. as a logo, avatar, or attachment via `ResourceBinding`), revoking your access or deleting the source repoints your use to a frozen copy you own (`tickets/FEAT-030-resource-bindings-and-lazy-copy.md`). The schema columns (`ResourceBinding`, `preserveOnRevoke`, `fromVersion`, `File.sourceFileId`) are in place for that phase.

| Problem | Use | Read | Signs you're bypassing it |
|---|---|---|---|
| A thing users own and share: "a file", "a folder", "a document", "something inside a workspace" | **`Artifact`** · model `packages/db/prisma/schema/artifact.prisma` — one row per thing, `kind` from `ArtifactKind` enum (`root`, `file`, `folder`) | § Kinds; `tickets/FEAT-009-file-management.md` | a new folder or document table with its own owner columns and its own permission table |
| What a kind may contain: "can a folder hold a folder" | **`canContain`** · `packages/shared/src/artifact/index.ts` — `isContainerKind`, `isRootKind`, `canContain`, `plainArtifactKinds`, `containerArtifactKinds`, `ARTIFACT_MAX_DEPTH`, `ARTIFACT_MAX_CHILDREN` | § Kinds | `if (artifact.kind === 'folder')` checks spread through services |
| Put something in a folder or at an owner's root, change placement visibility, move placement, copy artifact | **`ArtifactPlacement`** · model — written only through **`placeArtifact`**, **`updateArtifactPlacement`**, **`moveArtifactPlacement`**, **`copyArtifact`**, **`createArtifact`**, **`removeArtifactPlacement`** · services `apps/api/src/modules/artifact/services/` | § Placements | a `parentId` or materialized `path` column; `db.artifactPlacement.create` from a controller |
| Share with a person, an org, a space, a member or a customer; time-limited share; leave a share | **`ArtifactPermission`** · model — materialized onto inheriting descendants via **`ArtifactEffectivePermission`**; grantees read shares via `GET /{owner}/artifactPermissions` and leave via `DELETE /artifactPermission/:id` | § Access | a per-feature share table; a shared-with JSON column |
| Can this caller read / edit / manage / delete this artifact | **`validatePermission(action)`** · middleware + **`validateArtifactPermission`** / **`holdsOnRecord`** (`db:Artifact` and `db:ArtifactPlacement` in `packages/permissions/src/rebac/artifactResourcePermission.ts`, backed by materialized `Artifact.effectiveAccess` and `ArtifactEffectivePermission`) | § Access | a custom permission walk outside `schemaMap`; skipping `db:ArtifactPlacement.read` when listing folder contents |
| Give an artifact to another user, org or space | **`transferArtifact`** · Inquiry service `apps/api/src/modules/inquiry/services/transferArtifact/` | § Ownership | rewriting `organizationId` on the row; copying the file and deleting the original |
| Read an artifact with its 1-step neighborhood (placements as artifact/container, permissions, effective permissions, bindings) | **`GET /artifact/:id`** (`artifactRead`, backed by `includeArtifactDetail` and `readArtifactDetail`, keeping Prisma relation names straight through) | § Navigating | joining placements, grants, and bindings by hand without the caller's view |
| Delete a folder, or delete a folder and its exclusive contents | **`DELETE /artifact/:id`** (`artifactDelete`), `artifactPlacementsAsContainer[].artifact.exclusive` on **`GET /artifact/:id`**, **`/v1/batch`** | § Deleting | a delete that walks a container's members and removes them; a bespoke delete-many endpoint |

---

## Kinds

```ts
// packages/shared/src/artifact/index.ts (mirrors enum ArtifactKind in artifact.prisma)
containerChildren = { folder: ['file', 'folder'] };
plainArtifactKinds = ['folder'];
```

`ArtifactKind.root` is the per-owner root container provisioned eagerly by `ownerRootArtifact` on owner create/upsert/revive, enforced unique per owner via partial unique indexes (`WHERE "kind" = 'root' AND "deletedAt" IS NULL`). A root container can hold any non-root kind, can never be placed inside another container, and cannot be deleted, renamed, moved, copied, or granted direct `ArtifactPermission`s via API (`422`). Owner soft-delete cascades still soft-delete the root container cleanly.

A fork adds kinds below the template marker in both `enum ArtifactKind` (`packages/db/prisma/schema/artifact.prisma`) and `packages/shared/src/artifact/index.ts`. `kind` is immutable after creation (`immutableFields`). The plain create routes (`{me,organization,space,organizationUser,spaceUser}CreateArtifact`) only create `plainArtifactKinds` (kinds without a content table).

**No versions on artifacts.** An artifact's history is its audit log (`Artifact`, `ArtifactPlacement` and `ArtifactPermission` are audit-enabled). Only a kind whose content is versioned keeps versions, on its own side table: today that is `file` → `FileVersion`.

---

## Placements

An `ArtifactPlacement` is a pure container → member edge (`containerArtifactId` NOT NULL, `artifactId` NOT NULL) that carries **placement visibility (`access`: `inherit | private | tenant | public`)**. Containment organises AND controls visibility per placement; explicit per-principal grants (`ArtifactPermission`) stay on `Artifact`. Materialized tree state (`ArtifactAncestor`, `ArtifactEffectivePermission`, and `Artifact.effectiveAccess`, kept in sync by `artifactTree` hooks) flattens container inheritance to one hop for ReBAC. An artifact may sit in many containers, and so may a container ("compliance" under both "legal" and "operations").

**Cross-owner placements organise and reshare without inheriting.** Placing someone else's public or shared artifact into your root or folder sets `ArtifactAncestor.inherits = false` and never changes the target artifact's `effectiveAccess` — so your `public` placement can never leak someone else's `private` artifact, and your `private` root placement of someone else's `public` artifact stays invisible to strangers until you flip that placement to `public` (or `tenant` in an org/space). Handing ownership to another owner is still a transfer (§ Ownership).

**Per-owner root container (`ArtifactKind.root`).** Provisioned eagerly by `ownerRootArtifact` when an owner is created or revived. Creating an artifact without a `containerArtifactId` places it in the owner's `root` container (`access: 'private'` by default; `access: 'inherit'` is rejected on root placements with `422`). Removing an owned item from its last non-root container (or deleting that container) automatically reparents it back to the owner's root with `access: 'private'` via the `artifactTree:placement` DB hook (`reparentOrphanedArtifacts`).

| Action | What it does | Needs |
|---|---|---|
| **place in container or at owner root** (`POST /artifact/:id/artifactPlacements`) | adds a placement (`containerArtifactId` for a folder, or `ownerModel` + owner keys for an owner's root; defaults to `inherit` in folders, `private` at root) | same owner: `manage` on artifact, `operate` on container (or owner `create` for root); cross owner: `read` on artifact, `operate` on container (or owner `create` for root) |
| **change placement visibility** (`PATCH /artifactPlacement/:id`) | updates `access` (`inherit`, `private`, `tenant`, `public`; rejects `inherit` on root) | `manage` on container, plus `manage` on artifact if same-owner (or `read` on artifact if cross-owner) |
| **move placement** (`POST /artifactPlacement/:id/move`) | moves an existing placement in-place to another container owned by the **same owner** (omitting `targetContainerArtifactId` moves it to that owner's root); refuses cross-owner moves (`422` — create a new placement instead) | `operate` on source and target containers (`manage` on source when moving a `private` placement; `manage` on target when setting non-default `access`), plus `manage` on artifact if same-owner (`read` if cross-owner) |
| **copy artifact** (`POST /artifact/:id/copy`) | a new artifact in `targetContainerArtifactId` or an owner root (`ownerModel` + owner keys, or omit both for the caller's personal root), with optional `name`; a file copy shares the source's bytes until the sweeper copies them (`tickets/FEAT-030-resource-bindings-and-lazy-copy.md`); a container is copied without its contents | `read` on the source, `operate` on the target container |
| **remove placement** (`DELETE /artifactPlacement/:id`) | hard-deletes a placement (refuses removing an artifact's sole same-owner root placement with `422` — use `DELETE /artifact/:id` to delete the artifact; removing the last non-root placement reparents the owned artifact back to its owner's root as `private`) | same-owner: `manage` on artifact, `operate` on container; cross-owner: `operate` on container (even if read access was later revoked) |

A placement is refused when the container's kind does not allow the child's kind (`canContain`), it would close a loop, it would nest deeper than `ARTIFACT_MAX_DEPTH` (50 non-root levels, longest path via `ArtifactAncestor`), or the container already holds `ARTIFACT_MAX_CHILDREN` (500) direct items.

**Locking & auditing.** Placement, visibility, permission, transfer, and delete writes hold `withArtifactOwnersLock` (`withOwnerLock(owner, 'containers')`, locked in deterministic order when multiple owners are involved) before locking rows with `db.findForUpdate`. Placements are hard-deleted (`HARD_DELETE_ON_TOMBSTONE`) and audit-enabled (`ParentEdgeRegistry.ArtifactPlacement` points to `containerArtifactId` so cross-owner placements audit under the container owner's tenant).

---

## Access

Artifact and placement authorization lives in `schemaMap` (`packages/permissions/src/rebac/artifactResourcePermission.ts`) using `@inixiative/permissions` `down` lists (`artifactEffectivePermissions`) plus `tenantPermissionRules`. Caller-reflected access (`artifactEffectiveRole`) lives in `packages/permissions/src/rebac/check.ts`.

**Visibility lives on `ArtifactPlacement.access`**, and **`Artifact.effectiveAccess`** (`private` | `tenant` | `public`, in `NOOP_FIELDS` with direct cache invalidation) is materialized by `syncArtifactAncestors` as the most permissive visibility (`public` > `tenant` > `private`) across the artifact's **same-owner** placements:

| `placement.access` | Placement visibility (`db:ArtifactPlacement.read`) | Contributes to same-owner `Artifact.effectiveAccess` | Takes same-owner container's grants? |
|---|---|---|---|
| `inherit` *(folders only; `422` at root)* | readable by anyone who can read the container (and the target artifact) | container's `effectiveAccess` | yes |
| `public` | readable by any caller who can read the target artifact (in root, or inside a readable folder) | `public` | yes |
| `tenant` | readable by members with `read` on the container's owning tenant + container owner/managers (and who can read the target artifact) | `tenant` (or `private` for `User`) | no (stops external grants from above) |
| `private` | only container owner/managers (and who can read the target artifact) | `private` | no |

Removing an artifact from a `public` folder automatically drops its `effectiveAccess` back to `private` (or the max of its remaining same-owner placements). Unplaced artifacts (0 placements) stay `effectiveAccess = 'private'`.

**4-tier action ladder (`Role` → `Action`):**
- `read` (`viewer`): read artifact details, copy out, cross-owner place.
- `operate` (`member`): rename (`PATCH /artifact/:id` `name`), edit content, add/remove/create items inside a container.
- `manage` (`admin`): change placement `access` (`PATCH /artifactPlacement/:id`), manage `ArtifactPermission` grants (capped at own role via `roleHeldVia`), move/place same-owner artifacts, create org/space artifacts.
- `own` / `delete` (`owner`): grant/revoke `owner`, transfer ownership, delete (+ org/space `owner` break-glass `delete` on `OrganizationUser`/`SpaceUser` artifacts).

**5-way ownership (`ArtifactOwnerModel`):** `User`, `Organization`, `Space`, `OrganizationUser`, `SpaceUser` — the same ownership model as `Project` and `Integration`:
- `User`: the user owns it (capped by User token role).
- `Organization` / `Space`: org/space owners hold `own` (`delete`), admins hold `manage` and create org/space artifacts; members access org/space artifacts via `ArtifactPermission`, `public`, `tenant`, or `tenantPermissionRules`.
- `OrganizationUser` / `SpaceUser`: private member-owned workspace inside a tenant. The member owns and creates in it; the org/space owner has break-glass `read` and `delete` (no `manage`); admins and peers see `tenant` and `public` placements/artifacts and get `403` on `private` ones. `tenantPermissionRules` skip private member-owned artifacts.

**Explicit grants (`ArtifactPermission`):** stay on `Artifact` (surviving folder moves) and are materialized onto inheriting descendants via `ArtifactEffectivePermission` (1 `down` jump from `Artifact`; see `tickets/AUTH-014-nested-down-list-walks.md`), with `expiresAt` evaluated live against `actor:Clock.now`. Denied access returns `403` (`404` only when the row does not exist). `db:ArtifactPermission` uses `roleHeldVia` so a grant can't be created, changed or revoked by someone whose access is below it, and defines `leave` so grantees can revoke themselves via `DELETE /artifactPermission/:id`.

Not in this cut: per-placement explicit user grants, row-level `permissionRules`, `Entitlement` targeting artifacts, `Integration` grantees, or Artifact webhooks (`tickets/FEAT-031-artifact-webhooks.md`).

---

## Ownership

Ownership never changes as a side effect. **`transferArtifact`** is an Inquiry from the current owner (a user, organization or space) to the receiver; whoever manages the owner it is leaving may send it.
- The receiver accepts or declines. On accept, under `withArtifactOwnersLock`, the artifact's owner changes, the artifact is placed in the receiver's `root` container with `access: 'private'`, all old placements are hard-deleted, and all old grants are soft-deleted, so the receiver starts clean. Every step is in the audit log.
- If the sender asked to keep tracking it (`keepTracking`), the sender keeps a pointer: a `tracking` `ResourceBinding` on the sender plus a `viewer` grant. If the receiver refuses the pointer (`allowTracking: false`), the sender keeps a copy instead. Copies happen only then.
- Auto-approve is off for now (the receiver explicitly approves or declines).
- Only non-container artifacts transfer for now.

---

## Deleting

- **Deleting an artifact needs `delete`** (`own` on the artifact, or org/space `owner` break-glass on `OrganizationUser`/`SpaceUser` artifacts), and removes all its placements (`softDeleteCascade`). Root containers cannot be deleted via API (`422`).
- **Deleting a container deletes the container, never its contents.** Exclusive same-owner children are automatically reparented to the owner's `root` (`access: 'private'`) by the `artifactTree:placement` hook (`reparentOrphanedArtifacts`).
- **Deleting the contents as well is a separate action.** `GET /artifact/:id` returns `artifactPlacementsAsContainer`, where each nested `artifact` carries an `exclusive` boolean (items that sit in this container and no other same-owner container). To delete them, send their `DELETE /api/v1/artifact/:id` requests through `POST /api/v1/batch/execute` with `strategy: 'transactionAll'` (one transaction, all or nothing), contents in the first round and the container in a later round: a caller whose access to the contents comes through the container loses it once the container is gone.
- Deleted artifacts' bytes are reclaimed by the orphan sweeper (`tickets/FEAT-030-resource-bindings-and-lazy-copy.md`).

---

## Navigating

Artifacts are a flat table of nodes; navigating a workspace tree is reading placements:

| View | Route |
|---|---|
| Owner's flat artifact list (paginated + `filterLens` + SQL access reflection on `effectiveAccess`; excludes `root` containers; pass `search` / `searchFields` to filter; includes `artifactPermissions` for managers) | `GET /me/artifacts`, `/user/:id/artifacts`, `/organization/:id/artifacts`, `/space/:id/artifacts`, `/organizationUser/:id/artifacts`, `/spaceUser/:id/artifacts` |
| Owner's workspace root / placements (paginated; defaults to root placements — both owned items and external pins/reshares — with `placement.id`, `placement.access`, `artifact`, and `containerArtifact` inline; public-callable for public/tenant root reshares) | `GET /me/artifactPlacements`, `/user/:id/artifactPlacements`, `/organization/:id/artifactPlacements`, `/space/:id/artifactPlacements`, `/organizationUser/:id/artifactPlacements`, `/spaceUser/:id/artifactPlacements` |
| Shared with owner ("Shared with me": paginated active `ArtifactPermission` rows with each `artifact` inline, including `CustomerRelationship` shares) | `GET /me/artifactPermissions`, `/organization/:id/artifactPermissions`, `/space/:id/artifactPermissions`, `/organizationUser/:id/artifactPermissions`, `/spaceUser/:id/artifactPermissions` |
| Single artifact + 1-step neighborhood (scalar `effectiveAccess`, `effectiveRole`, and exact Prisma relation names: `artifactPlacementsAsArtifact` with `containerArtifact` + `artifactPermissions` for managers, `artifactPlacementsAsContainer` with `artifact` + `exclusive` + `artifactPermissions` for managers, visible `resourceBindings`, and for managers `artifactPermissions` + `artifactEffectivePermissions`) | `GET /artifact/:id` |

`GET /artifact/:id` loads its 1-step relations (`includeArtifactDetail`) and filters them per-caller in `readArtifactDetail` (enforcing `db:ArtifactPlacement.read` on placements and ReBAC `db:User`/`db:Organization`/`db:Space` on bindings) without renaming Prisma relations.

No frontend is built yet (`tickets/FEAT-032-file-browser-ui.md`).

---

## Source map

| Concern | Path |
|---|---|
| Schema | `packages/db/prisma/schema/{artifact,artifactAncestor,artifactEffectivePermission,artifactPlacement,artifactPermission,file,fileVersion,resourceBinding}.prisma` |
| Kind catalog & caps | `packages/shared/src/artifact/index.ts` |
| ReBAC rules & access helpers | `packages/permissions/src/permix.ts`, `packages/permissions/src/rebac/{artifactResourcePermission,check}.ts` |
| Validations | `apps/api/src/modules/artifact/validations/{validateArtifactPermission,validateNotRootArtifact,validateContainable,validatePlacementAccess,validateNoContainerCycle,validateEdgeAuthority,validateArtifactCreateAtOwner}.ts` |
| Materialized tree & root hooks | `apps/api/src/hooks/ownerRootArtifact/hook.ts`, `apps/api/src/hooks/artifactTree/{hook,fetchArtifactTreeAround,syncAncestors,syncJoinRows,reparentOrphanedArtifacts,syncArtifactAncestors,syncPermissionDescendants}.ts` |
| Placements & creation | `apps/api/src/modules/artifact/services/{createArtifact,placeArtifact,updateArtifactPlacement,moveArtifactPlacement,copyArtifact,removeArtifactPlacement,artifactPlacementUtils,artifactOwner}.ts` |
| Navigation & shared | `apps/api/src/modules/artifact/queries/{artifactIncludes,accessibleArtifactWhere,ownerArtifactsQuery}.ts`, `apps/api/src/modules/artifact/services/readArtifactDetail.ts`, `apps/api/src/modules/artifactPermission/queries/sharedWithOwnerWhere.ts`, `apps/api/src/modules/artifactPlacement/queries/ownerArtifactPlacementsQuery.ts` |
| Ownership | `apps/api/src/modules/inquiry/services/transferArtifact/` |
| Deleting | `apps/api/src/modules/artifact/controllers/artifactDelete.ts` |
| Routes | `apps/api/src/modules/{artifact,artifactPlacement,artifactPermission}/`, `{me,organization,space,organizationUser,spaceUser}{Create,ReadMany}Artifact`, `userReadManyArtifacts`, `{me,user,organization,space,organizationUser,spaceUser}ReadManyArtifactPlacements`, `{me,organization,space,organizationUser,spaceUser}ReadManyArtifactPermissions` |
