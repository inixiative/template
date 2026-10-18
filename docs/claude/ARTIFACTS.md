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
- [Webhooks](#webhooks)
- [Source map](#source-map)

<!-- toc:end -->

---

## What an artifact is

An **artifact** is anything that is owned, placed in containers, shared and made public: a file, a folder, and in forks other kinds. There is one table, `Artifact`, and every artifact is either a **container** (it holds other artifacts: a folder) or an **object** (it doesn't: a file). That is its `type`, set from its kind when it is created and never changed. A kind with content of its own keeps its own tables (`file` → `File`, `FileVersion`).

Why one table: a grant, a placement, an audit entry and a webhook each have a single kind of target, and the same access rules serve containers, objects and anything a fork adds. The wider file design (upload, versions, bindings, lazy copy) is `tickets/FEAT-009-file-management.md`.

### Why: no orphans, no rug pulls

**Nothing gets lost by being organised.** File systems that let one item live in several places tend to strand it: remove it from the last folder that showed it and it still exists, still costs storage, and nobody can find it. Here an item can sit in several containers of its owner, and an item in no container is simply at its owner's root, so it is never reachable only by search. Placements are soft-deleted and audited, so "where was this, and who moved it" always has an answer. Moving something between places never changes who owns it. Changing ownership is a separate, deliberate act (the `transferArtifact` Inquiry), so reorganising a folder can't silently hand bytes to someone else.

**Using something can't be pulled out from under you.** This is the less common property. When you use an artifact, for example as a logo, an avatar or an attachment (a `ResourceBinding`), you depend on it. If the owner revokes your access or deletes the source, your use is not left broken: it is repointed to a frozen copy that you own (lazy copy, also called copy-on-revoke, FEAT-009 § 6). An active use always triggers this; a grant marked `preserveOnRevoke` opts in without one. The lazy copy is designed but not built yet; the bindings and the grant flag that drive it are in place.

| Problem | Use | Read | Signs you're bypassing it |
|---|---|---|---|
| A thing users own and share: "a file", "a folder", "a document", "something inside a workspace", "an item people can be given access to" | **`Artifact`** · model `packages/db/prisma/schema/artifact.prisma` — one row per thing, `kind` from the catalog, `type` container or object | § Kinds; FEAT-009 § 3 | a new folder or document table with its own owner columns and its own permission table |
| What a kind may contain and its access default: "can a folder hold a folder", "files start private" | **`ArtifactKinds`** · registry `packages/shared/src/artifact/kinds.ts` — `type`, `contains`, `defaultAccess`, `contentModel`, `systemOnly`, `memberScoped` | § Kinds | `if (artifact.kind === 'folder')` checks spread through services; `kind in [...]` lists instead of `type` |
| Put something in a folder, file it in two places, move it, copy it, list what is inside: "nest folders", "add to a collection" | **`ArtifactPlacement`** · model — written only through **`placeArtifact`**, **`moveArtifact`**, **`copyArtifact`**, **`createArtifact`**, **`removeArtifactPlacement`** · services `apps/api/src/modules/artifact/services/` | § Placements | a `parentId` or materialized `path` column; `db.artifactPlacement.create` from a controller |
| Share with a person, an org, a space, a member or a customer; time-limited share: "give Bob edit access", "share this folder with the design space" | **`ArtifactPermission`** · model — a role on an artifact, inherited by `inherit` artifacts inside it | § Access | a per-feature share table; a shared-with JSON column |
| Can this caller read / edit / manage this artifact: "who can see this file", "is it public" | **`checkArtifactAccess`** · service, **`validateArtifactAccess(action)`** · middleware `apps/api/src/middleware/validations/` | § Access | `validatePermission` on an artifact route (it skips grants); reading `artifact.access` alone to decide public |
| Everyone with access to an artifact, without an actor: "build the reader set for an index", "who should hear about this change" | **`resolveArtifactAccess`** · service — public flag + grants with roles, through containers | § Access | re-walking containers by hand to collect grants |
| Give an artifact to another user, org or space: "hand this file over", "move it to the client's workspace" | **`transferArtifact`** · Inquiry handler `apps/api/src/modules/inquiry/handlers/transferArtifact/` | § Ownership | rewriting `organizationId` on the row; copying the file and deleting the original |
| Where something is used and placed, as the caller sees it: "what uses this logo", "which folders is this in" | **`GET /artifact/:id/uses`** (`listArtifactUses`) | § Navigating | joining placements and bindings by hand without the caller's view |
| Delete a folder, or delete a folder and what is in it: "empty this folder", "remove the folder but keep the files" | **`deleteArtifact`** · service (`DELETE /artifact/:id`), **`artifactReadExclusiveContents`** · route, **`/v1/batch`** | § Deleting | a delete that walks a container's members and removes them; a bespoke delete-many endpoint |

---

## Kinds

```ts
// packages/shared/src/artifact/kinds.ts
file:   { type: 'object',    contains: [], defaultAccess: 'private', holder: 'local', contentModel: 'File', lazyCopy: true },
folder: { type: 'container', contains: ['file', 'folder'], defaultAccess: 'private', holder: 'local' },
organizationUserFolder: { type: 'container', contains: ['file', 'folder'], defaultAccess: 'private', holder: 'local', systemOnly: true, memberScoped: true },
```

A fork adds kinds below the template marker. `kind` and `type` are immutable after creation; the `artifactAccess` hook sets `type` from the kind and refuses a kind the catalog does not know. The plain create routes (`meCreateArtifact`, `organizationCreateArtifact`, `spaceCreateArtifact`) only create kinds without a `contentModel` and that are not `systemOnly`.

**No versions on artifacts.** An artifact's history is its audit log (`Artifact`, `ArtifactPlacement` and `ArtifactPermission` are audit-enabled). Only a kind whose content is versioned keeps versions, on its own side table: today that is `file` → `FileVersion`.

`integrationId` names the app that holds the artifact's content: null for this app, set when an integration keeps the content and keys it by `Artifact.id`.

---

## Placements

An `ArtifactPlacement` says "this artifact sits in that container". Containment organises; it holds no permissions of its own. Access comes from grants, and the access walk reaches a container's grants through its placements. An artifact may sit in many containers, and so may a container ("compliance" under both "legal" and "operations"). **Placements stay within one owner**; handing an artifact to another owner is a transfer (§ Ownership).

**The root is not a row.** An artifact with no live placement is at its owner's root (`placements: { none: {} }`, under the soft-delete scope). Removing its last placement just puts it back at the root; deleting stays an explicit action.

| Action | What it does | Needs |
|---|---|---|
| **place** (`POST /artifact/:id/artifactPlacements`) | adds a placement | `manage` on the artifact, `operate` on the container (`ARTIFACT_EDGE_AUTHORITY`) — the Google Drive shape |
| **move** (`POST /artifact/:id/move`) | replaces one placement with another in one step; either end may be the root | the same, at each container end |
| **copy** (`POST /artifact/:id/copy`) | a new artifact in the container, owned by its owner; a file copy shares the source's bytes until the sweeper copies them; a container is copied without its contents | `read` on the source, `operate` on the container |
| **remove** (`DELETE /artifactPlacement/:id`) | removes a placement | as place |

A placement is refused when the container's kind does not list the artifact's kind (`contains`), the two have different owners, or it would close a loop (`findReferenceCycle`, `packages/shared/src/graph/`) or nest deeper than 10.

**Locking.** Every placement write holds `withOwnerLock(owner, 'containers')` before its transaction opens. Creating, moving and copying hold the same lock.

Placements are soft-deleted and audit-enabled.

---

## Access

`Artifact.access` is `inherit`, `public` or `private`:

| `access` | Public? | Takes its containers' grants? |
|---|---|---|
| `inherit` | if any container resolves public | yes, from every container |
| `public` | yes | yes |
| `private` | no | no |

**Private means the artifact has only its own permissions.** It takes nothing from its containers, neither their grants nor their public state. You can keep your own things in a public folder. Most artifacts should inherit.

The grants an artifact carries are:
- its own live `ArtifactPermission` rows, with soft-deleted and expired ones dropped;
- the implicit owner grant: the owning user, or `OrganizationManager` / `SpaceManager` (owners and admins of the owning org or space);
- for `inherit` and `public` artifacts, every container's grants.

**A member's org-user content.** Every member has an `organizationUserFolder` in the org: owned by the org (the bytes stay with the org), private, and granted to the member. It is created optimistically, when a membership is created (which covers org creation and accepting an invite) and already when an invite is sent; at invite time it is granted to the invited user, and on joining that grant becomes the membership grant. For that folder and everything under it (`memberScoped`), the implicit owner grant is `OrganizationOwner`. Org owners (the org's IT and owner) can reach it as an internal superadmin would: they don't see everything, but if the member needs help, they can open it by id. Org admins (the average manager) cannot. It is also left out of every listing and root view (children, parents, ancestors, the owner's root, `exclusiveContents`, `/uses` placements) for anyone whose access is only that implicit owner reach, so owners don't browse it. The member, and anyone with an explicit grant, sees it listed: an explicit grant always works. Org-level webhook subscriptions don't hear it. Filing it into a team folder shares it, and then it is ordinary team content. Org-user content must stay in a container: removing its last placement, or deleting a member-scoped folder that still holds it, is refused, since at the org root it would show in the org's normal browse.

**Creation and the kind default.** The `artifactAccess` hook stamps the kind's `defaultAccess` on an artifact created with `inherit` or no access, so a new file is private. `createArtifact` creates and, if asked, places it in a container with `inherit`, in one locked `db.txn`. Placing with `inherit: false` keeps it private: an artifact at its root is first set to its kind's default access.

**An actor's role** is the strongest grant it holds. Each grant is capped by what the actor holds on its grantee:

| Grantee | Cap |
|---|---|
| `User` | its own role, capped by a User token; scoped tokens never reach their user's personal grants |
| `Organization` / `Space` | its membership role there |
| `OrganizationManager` / `SpaceManager` | admin or owner there |
| `OrganizationOwner` | owner of the org (org-user content only) |
| `OrganizationUser` / `SpaceUser` | the token's role |
| `Integration` | no presenting path yet |

Without read the caller gets 404; with read but not the action, 403. A grant can't be created, changed or revoked by someone whose role is below it.

Not in this cut: access per placement. Access is the artifact's column plus its containers'.

---

## Ownership

Ownership never changes as a side effect. **`transferArtifact`** is an Inquiry from the current owner (a user, organization or space) to the receiver; whoever manages the owner it is leaving may send it.
- The receiver accepts or declines. On accept the artifact's owner changes, its placements in the old owner's containers are removed (it arrives at the receiver's root), and its old grants are revoked, so the receiver starts clean. Every step is in the audit log.
- If the sender asked to keep tracking it (`keepTracking`), the sender keeps a pointer: a `tracking` `ResourceBinding` on the sender plus a `viewer` grant. If the receiver refuses the pointer (`allowTracking: false`), the sender keeps a copy instead. Copies happen only then.
- It auto-approves only on the existing handshake rule: when the sender already manages the receiver.
- Only objects transfer for now.

---

## Deleting

- **Deleting an artifact always needs `own` on it**, and removes all its placements (`softDeleteCascade`).
- **Deleting a container deletes the container, never its contents.** Anything that was only in it is at its owner's root again.
- **Deleting the contents as well is a separate action.** `GET /artifact/:id/exclusiveContents` lists the artifacts that sit in this container and in no other, among those the caller can read. To delete them, send their `DELETE /api/v1/artifact/:id` requests through `POST /api/v1/batch/execute` with `strategy: 'transactionAll'` (one transaction, all or nothing), contents in the first round and the container, if it goes too, in a later round: a caller whose access to the contents comes through the container loses it once the container is gone. A UI may offer the two together; the API keeps them apart.
- System artifacts cannot be deleted. Deleted artifacts' bytes are reclaimed by the orphan sweeper (FEAT-009 § 16).

---

## Navigating

There is no "primary parent": with several parents, a browser shows two link lists for an item, **above** (its direct parents) and **below** (its direct children), plus a hover or expanded view of the whole graph above it. The API serves each cheaply, **as the caller sees it**:

| View | Route |
|---|---|
| Top of the browser: the owner's root | `GET /me/artifacts`, `/organization/:id/artifacts`, `/space/:id/artifacts` |
| Below: direct children | `GET /artifact/:id/artifacts` |
| Above: direct parents | `GET /artifact/:id/parents` |
| The full graph above, to the root | `GET /artifact/:id/ancestors` → `{ artifacts, edges }`, each shared ancestor once, depth-capped like the access walk |
| Everything it is in and used by | `GET /artifact/:id/uses` → `{ owner, access, placements, bindings }` |

**A placement in a container the caller can't see doesn't count for them.** The item shows at that caller's root, with its owner and who has access, but not the container. `/uses` lists only placements in containers the caller can read, and bindings on resources the caller can read (organizations and spaces checked with `readAsCaller` against their own read routes; a user's bindings only to that user).

No frontend is built yet.

---

## Webhooks

`Artifact` is a webhook model. Grant and placement changes fire an `Artifact` update for the parent through `webhookRelatedModels`. The audience is the owner and every party with access, through containers, plus a just-revoked grantee. Org-user content reaches no org-level subscription. See [HOOKS.md](HOOKS.md#related-models).

---

## Source map

| Concern | Path |
|---|---|
| Schema | `packages/db/prisma/schema/artifact.prisma`, `file.prisma` |
| Kind catalog | `packages/shared/src/artifact/kinds.ts` |
| Access resolution | `apps/api/src/modules/artifact/services/resolveArtifactAccess.ts`, `checkArtifactAccess.ts`, `actorPrincipalRole.ts` |
| Placements | `apps/api/src/modules/artifact/services/artifactPlacements.ts`, `removeArtifactPlacement.ts`, `assertNoContainerCycle.ts` |
| Navigation and uses | `apps/api/src/modules/artifact/services/listRootArtifacts.ts`, `readArtifactAncestors.ts`, `listArtifactUses.ts` |
| Ownership | `apps/api/src/modules/inquiry/handlers/transferArtifact/` |
| Org-user folders | `apps/api/src/modules/artifact/services/ensureOrganizationUserFolder.ts`, `apps/api/src/hooks/organizationUserFolder/hook.ts` |
| Deleting | `apps/api/src/modules/artifact/services/deleteArtifact.ts`, `listExclusiveContents.ts` |
| Hooks | `apps/api/src/hooks/artifactAccess/hook.ts` (kind default and type) |
| Routes | `apps/api/src/modules/{artifact,artifactPlacement,artifactPermission}/`, `{me,organization,space}CreateArtifact`, `{me,organization,space}ReadManyArtifacts` |
