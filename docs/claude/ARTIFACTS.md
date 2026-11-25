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

An **artifact** is anything that is owned, placed in containers, shared and made public: a file, a folder, a workspace root, and in forks other kinds. There is one table, `Artifact`, with an immutable `kind` (`ArtifactKind` Prisma enum). Whether a kind can hold children is determined from `packages/shared/src/artifact/kinds.ts` (`containerChildren`, `isContainerKind`, `isRootKind`, `canContain`). A kind with content of its own keeps its own tables (`file` → `File`, `FileVersion`).

Why one table: a grant, a placement, and an audit entry each have a single kind of target, and the same access rules serve folders, files and anything a fork adds. Follow-up tickets cover file storage/uploads (`tickets/FEAT-029-file-storage-and-versioning.md`), bindings/lazy-copy sweeper (`tickets/FEAT-030-resource-bindings-and-lazy-copy.md`), webhooks (`tickets/FEAT-031-artifact-webhooks.md`), and the browser UI (`tickets/FEAT-032-file-browser-ui.md`).

### Why: no orphans, no rug pulls

**Nothing gets lost by being organised.** File systems that let one item live in several places tend to strand it: remove it from the last folder that showed it and it still exists, still costs storage, and nobody can find it. Here every owner has a lazy `root` container (`ArtifactKind.root`), every item created in Drive starts with a placement, and removing an owned item from its last folder (or deleting that folder) automatically reparents it back to the owner's root (`access: 'private'`). Placements are soft-deleted and audited, so "where was this, and who moved it" always has an answer. Moving something between places never changes who owns it. Changing ownership is a separate, deliberate act (the `transferArtifact` Inquiry), so reorganising a folder can't silently hand bytes to someone else.

**Using something can't be pulled out from under you.** When you use an artifact (e.g. as a logo, avatar, or attachment via `ResourceBinding`), revoking your access or deleting the source repoints your use to a frozen copy you own (`tickets/FEAT-030-resource-bindings-and-lazy-copy.md`). The schema columns (`ResourceBinding`, `preserveOnRevoke`, `fromVersion`, `File.sourceFileId`) are in place for that phase.

| Problem | Use | Read | Signs you're bypassing it |
|---|---|---|---|
| A thing users own and share: "a file", "a folder", "a document", "something inside a workspace" | **`Artifact`** · model `packages/db/prisma/schema/artifact.prisma` — one row per thing, `kind` from `ArtifactKind` enum (`root`, `file`, `folder`) | § Kinds; `tickets/FEAT-009-file-management.md` | a new folder or document table with its own owner columns and its own permission table |
| What a kind may contain: "can a folder hold a folder" | **`containerChildren`** · `packages/shared/src/artifact/kinds.ts` — `isContainerKind`, `isRootKind`, `canContain`, `plainArtifactKinds`, `ARTIFACT_MAX_DEPTH`, `ARTIFACT_MAX_CHILDREN` | § Kinds | `if (artifact.kind === 'folder')` checks spread through services |
| Put something in a folder or at an owner's root, change placement visibility, move, copy | **`ArtifactPlacement`** · model — written only through **`placeArtifact`**, **`updateArtifactPlacement`**, **`moveArtifact`**, **`copyArtifact`**, **`createArtifact`**, **`removeArtifactPlacement`** · services `apps/api/src/modules/artifact/services/` | § Placements | a `parentId` or materialized `path` column; `db.artifactPlacement.create` from a controller |
| Share with a person, an org, a space, a member or a customer; time-limited share; leave a share | **`ArtifactPermission`** · model — materialized onto inheriting descendants via **`ArtifactEffectivePermission`**; grantees read shares via `GET /{owner}/artifactPermissions` and leave via `DELETE /artifactPermission/:id` | § Access | a per-feature share table; a shared-with JSON column |
| Can this caller read / edit / manage / delete this artifact | **`validatePermission(action)`** · middleware + **`assertArtifactPermission`** / **`canActOnArtifact`** (`db:Artifact` and `db:ArtifactPlacement` in `schemaMap`, backed by materialized `Artifact.effectiveAccess` and `ArtifactEffectivePermission`) | § Access | a custom permission walk outside `schemaMap`; skipping `db:ArtifactPlacement.read` when listing folder contents |
| Give an artifact to another user, org or space | **`transferArtifact`** · Inquiry service `apps/api/src/modules/inquiry/services/transferArtifact/` | § Ownership | rewriting `organizationId` on the row; copying the file and deleting the original |
| Read an artifact with its 1-step neighborhood (direct parents, direct children, placements, permissions, bindings) | **`GET /artifact/:id`** (`artifactRead`, backed by `resourceContextArgs` `includeArtifactDetail` and `readArtifactDetail`) | § Navigating | joining placements, grants, and bindings by hand without the caller's view |
| Delete a folder, or delete a folder and its exclusive contents | **`DELETE /artifact/:id`** (`artifactDelete`), `children` (`exclusive: true`) on **`GET /artifact/:id`**, **`/v1/batch`** | § Deleting | a delete that walks a container's members and removes them; a bespoke delete-many endpoint |

---

## Kinds

```ts
// packages/shared/src/artifact/kinds.ts (mirrors enum ArtifactKind in artifact.prisma)
containerChildren = { folder: ['file', 'folder'] };
plainArtifactKinds = ['folder'];
```

`ArtifactKind.root` is the lazy per-owner root container (`ensureOwnerRootArtifact`), enforced unique per owner via partial unique indexes (`WHERE "kind" = 'root' AND "deletedAt" IS NULL`). A root container can hold any non-root kind, can never be placed inside another container, and cannot be deleted, renamed, moved, copied, or granted direct `ArtifactPermission`s via API (`422`). Owner soft-delete cascades still soft-delete the root container cleanly.

A fork adds kinds below the template marker in both `enum ArtifactKind` (`packages/db/prisma/schema/artifact.prisma`) and `packages/shared/src/artifact/kinds.ts`. `kind` is immutable after creation (`immutableFields`). The plain create routes (`{me,organization,space,organizationUser,spaceUser}CreateArtifact`) only create `plainArtifactKinds` (kinds without a content table).

**No versions on artifacts.** An artifact's history is its audit log (`Artifact`, `ArtifactPlacement` and `ArtifactPermission` are audit-enabled). Only a kind whose content is versioned keeps versions, on its own side table: today that is `file` → `FileVersion`.

---

## Placements

An `ArtifactPlacement` is a pure container → member edge (`containerArtifactId` NOT NULL, `artifactId` NOT NULL) that carries **placement visibility (`access`: `inherit | private | tenant | public`)**. Containment organises AND controls visibility per placement; explicit per-principal grants (`ArtifactPermission`) stay on `Artifact`. Materialized tree state (`ArtifactAncestor`, `ArtifactEffectivePermission`, and `Artifact.effectiveAccess`, kept in sync by `artifactTree` hooks) flattens container inheritance to one hop for ReBAC. An artifact may sit in many containers, and so may a container ("compliance" under both "legal" and "operations").

**Cross-owner placements organise and reshare without inheriting.** Placing someone else's public or shared artifact into your root or folder sets `ArtifactAncestor.inherits = false` and never changes the target artifact's `effectiveAccess` — so your `public` placement can never leak someone else's `private` artifact, and your `private` root placement of someone else's `public` artifact stays invisible to strangers until you flip that placement to `public` (or `tenant` in an org/space). Handing ownership to another owner is still a transfer (§ Ownership).

**Lazy root container (`ArtifactKind.root`).** Creating an artifact without a `containerArtifactId` lazily ensures the owner's `root` container and places the artifact there (`access: 'private'` by default; `access: 'inherit'` is rejected on root placements with `422`). Removing an owned item from its last non-root folder (or deleting that folder) automatically reparents it back to the owner's root with `access: 'private'`. `GET /{owner}/artifactPlacements` never creates a root row on read — it simply returns `[]` until one exists.

| Action | What it does | Needs |
|---|---|---|
| **place in container or at owner root** (`POST /artifact/:id/artifactPlacements`) | adds a placement (`containerArtifactId` for a folder, or `ownerModel` + owner keys for an owner's lazy root; defaults to `inherit` in folders, `private` at root) | same owner: `manage` on artifact, `operate` on container (or owner `create` for root); cross owner: `read` on artifact, `operate` on container (or owner `create` for root) |
| **change placement visibility** (`PATCH /artifactPlacement/:id`) | updates `access` (`inherit`, `private`, `tenant`, `public`; rejects `inherit` on root) | `manage` on container, plus `manage` on artifact if same-owner (or `read` on artifact if cross-owner) |
| **move** (`POST /artifact/:id/move`) | replaces one placement with another in one step; omitting `fromContainerArtifactId` or `toContainerArtifactId` resolves to the artifact owner's lazy root | the same, at each container end |
| **copy** (`POST /artifact/:id/copy`) | a new artifact in the container, owned by its owner; a file copy shares the source's bytes until the sweeper copies them (`tickets/FEAT-030-resource-bindings-and-lazy-copy.md`); a container is copied without its contents | `read` on the source, `operate` on the container |
| **remove** (`DELETE /artifactPlacement/:id`) | removes a placement (reparenting an owned artifact to owner root if it was removed from its last non-root folder) | same-owner: `manage` on artifact, `operate` on container; cross-owner: `operate` on container (even if read access was later revoked) |

A placement is refused when the container's kind does not allow the child's kind (`canContain`), it would close a loop, it would nest deeper than `ARTIFACT_MAX_DEPTH` (50 non-root levels, longest path via `ArtifactAncestor`), or the container already holds `ARTIFACT_MAX_CHILDREN` (500) direct items.

**Locking & auditing.** Placement, visibility, permission, transfer, and delete writes hold `withArtifactOwnersLock` (`withOwnerLock(owner, 'containers')`, locked in deterministic order when multiple owners are involved) before locking rows with `db.findForUpdate`. Placements are soft-deleted and audit-enabled (`ParentEdgeRegistry.ArtifactPlacement` points to `containerArtifactId` so cross-owner placements audit under the container owner's tenant).

---

## Access

Artifact and placement authorization lives in `schemaMap` (`packages/permissions/src/rebac/artifactResourcePermission.ts`) using `@inixiative/permissions` `down` lists (`effectivePermissions`) plus `tenantPermissionRules`.

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
- The receiver accepts or declines. On accept, under `withArtifactOwnersLock`, the artifact's owner changes, all old placements and grants are soft-deleted, and the artifact is placed in the receiver's lazy `root` container with `access: 'private'`, so the receiver starts clean. Every step is in the audit log.
- If the sender asked to keep tracking it (`keepTracking`), the sender keeps a pointer: a `tracking` `ResourceBinding` on the sender plus a `viewer` grant. If the receiver refuses the pointer (`allowTracking: false`), the sender keeps a copy instead. Copies happen only then.
- Auto-approve is off for now (the receiver explicitly approves or declines).
- Only non-container artifacts transfer for now.

---

## Deleting

- **Deleting an artifact needs `delete`** (`own` on the artifact, or org/space `owner` break-glass on `OrganizationUser`/`SpaceUser` artifacts), and removes all its placements (`softDeleteCascade`). Root containers cannot be deleted via API (`422`).
- **Deleting a container deletes the container, never its contents.** Exclusive same-owner children are automatically reparented to the owner's lazy `root` (`access: 'private'`).
- **Deleting the contents as well is a separate action.** `GET /artifact/:id` includes `children` with an `exclusive` boolean (items that sit in this container and no other). To delete them, send their `DELETE /api/v1/artifact/:id` requests through `POST /api/v1/batch/execute` with `strategy: 'transactionAll'` (one transaction, all or nothing), contents in the first round and the container in a later round: a caller whose access to the contents comes through the container loses it once the container is gone.
- Deleted artifacts' bytes are reclaimed by the orphan sweeper (`tickets/FEAT-030-resource-bindings-and-lazy-copy.md`).

---

## Navigating

Artifacts are a flat table of nodes; navigating a workspace tree is reading placements:

| View | Route |
|---|---|
| Owner's flat artifact list (paginated + `filterLens` + SQL visibility reflection on `effectiveAccess`; excludes `root` containers; pass `search` / `searchFields` to filter; includes `permissions` for managers) | `GET /me/artifacts`, `/user/:id/artifacts`, `/organization/:id/artifacts`, `/space/:id/artifacts`, `/organizationUser/:id/artifacts`, `/spaceUser/:id/artifacts` |
| Owner's workspace root / placements (paginated; defaults to root placements — both owned items and external pins/reshares — with `placement.id`, `placement.access`, `artifact`, and `containerArtifact` inline; public-callable for public/tenant root reshares) | `GET /me/artifactPlacements`, `/user/:id/artifactPlacements`, `/organization/:id/artifactPlacements`, `/space/:id/artifactPlacements`, `/organizationUser/:id/artifactPlacements`, `/spaceUser/:id/artifactPlacements` |
| Shared with owner ("Shared with me": paginated active `ArtifactPermission` rows with each `artifact` inline, including `CustomerRelationship` shares) | `GET /me/artifactPermissions`, `/organization/:id/artifactPermissions`, `/space/:id/artifactPermissions`, `/organizationUser/:id/artifactPermissions`, `/spaceUser/:id/artifactPermissions` |
| Single artifact + 1-step neighborhood (scalar `effectiveAccess`, `effectiveRole`, direct readable `parents` excluding root, readable `children` with `placementId`, `placementAccess`, `exclusive`, and permissions for managers, visible `placements` & `bindings`, direct & effective `permissions` for managers) | `GET /artifact/:id` |

`GET /artifact/:id` loads its 1-step relations via `resourceContextArgs` (`includeArtifactDetail`) and filters them per-caller in `readArtifactDetail` (enforcing `db:ArtifactPlacement.read` on placements/children and ReBAC `db:User`/`db:Organization`/`db:Space` on bindings).

No frontend is built yet (`tickets/FEAT-032-file-browser-ui.md`).

---

## Source map

| Concern | Path |
|---|---|
| Schema | `packages/db/prisma/schema/{artifact,artifactAncestor,artifactEffectivePermission,artifactPlacement,artifactPermission,file,fileVersion,resourceBinding}.prisma` |
| Kind catalog & caps | `packages/shared/src/artifact/kinds.ts` |
| ReBAC rules | `packages/permissions/src/rebac/artifactResourcePermission.ts`, `apps/api/src/modules/artifact/services/checkArtifactPermission.ts` |
| Materialized tree | `apps/api/src/hooks/artifactTree/{hook,syncArtifactAncestors,syncPermissionDescendants}.ts` |
| Placements & creation | `apps/api/src/modules/artifact/services/{createArtifact,ownerRootArtifact,placeArtifact,updateArtifactPlacement,moveArtifact,copyArtifact,removeArtifactPlacement,artifactPlacementHelpers,artifactOwner}.ts` |
| Navigation & shared | `apps/api/src/modules/artifact/queries/{artifactIncludes,readableArtifactWhere,ownerArtifactsQuery}.ts`, `apps/api/src/modules/artifact/services/readArtifactDetail.ts`, `apps/api/src/modules/artifactPermission/queries/sharedWithOwnerWhere.ts`, `apps/api/src/modules/artifactPlacement/queries/ownerArtifactPlacementsQuery.ts` |
| Ownership | `apps/api/src/modules/inquiry/services/transferArtifact/` |
| Deleting | `apps/api/src/modules/artifact/controllers/artifactDelete.ts` |
| Routes | `apps/api/src/modules/{artifact,artifactPlacement,artifactPermission}/`, `{me,organization,space,organizationUser,spaceUser}{Create,ReadMany}Artifact`, `userReadManyArtifacts`, `{me,user,organization,space,organizationUser,spaceUser}ReadManyArtifactPlacements`, `{me,organization,space,organizationUser,spaceUser}ReadManyArtifactPermissions` |
