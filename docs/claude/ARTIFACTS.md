# Artifacts

<!-- toc:start -->

## Contents

- [What an artifact is](#what-an-artifact-is)
- [Kinds](#kinds)
- [Containers](#containers)
- [Access](#access)
- [Deleting](#deleting)
- [Webhooks](#webhooks)
- [Source map](#source-map)

<!-- toc:end -->

---

## What an artifact is

An **artifact** is anything that is owned, placed in containers, shared and made public: a file, a folder, and in forks other kinds. There is one node model, `Artifact`, with a `kind`. A container is just an artifact whose kind may hold others, so there is no separate folder table. A kind with content of its own keeps its own tables (`file` → `File`, `FileVersion`).

Why one node: a grant then has a single target, "who may hold what" is a fact in the code catalog rather than a table per kind, and the same access rules serve files, folders and anything a fork adds. The file system's wider design (upload, versions, bindings, lazy copy) is `tickets/FEAT-009-file-management.md`.

| Problem | Use | Read | Signs you're bypassing it |
|---|---|---|---|
| A thing users own and share: "a file", "a folder", "a document", "something inside a workspace", "an item people can be given access to" | **`Artifact`** · model `packages/db/prisma/schema/artifact.prisma` — one row per thing, `kind` from the catalog; its own content tables only when the kind has content | § Kinds; FEAT-009 § 3 | a new folder or document table with its own owner columns and its own permission table |
| What a kind may contain and its access default: "can a folder hold a folder", "files start private" | **`ArtifactKinds`** · registry `packages/shared/src/artifact/kinds.ts` — `contains`, `defaultAccess`, `contentModel`, `systemOnly`, `ownerReach` | § Kinds | `if (artifact.kind === 'folder')` checks spread through services |
| Put something in a folder, file it in two places, move it, list what is inside: "nest folders", "add to a collection" | **`ArtifactContainer`** · model (the edge) — written only through **`addArtifactToContainer`** / **`removeArtifactFromContainer`** · services `apps/api/src/modules/artifact/services/` | § Containers | a `parentId` or materialized `path` column; `db.artifactContainer.create` from a controller |
| Share with a person, an org, a space, a member or a customer; time-limited share: "give Bob edit access", "share this folder with the design space" | **`ArtifactPermission`** · model — a role on an artifact, inherited by `inherit` artifacts inside it | § Access | a per-feature share table; a shared-with JSON column |
| Can this caller read / edit / manage this artifact: "who can see this file", "is it public" | **`checkArtifactAccess`** · service, **`validateArtifactAccess(action)`** · middleware `apps/api/src/middleware/validations/` | § Access | `validatePermission` on an artifact route (it skips grants); reading `artifact.access` alone to decide public |
| Everyone with access to an artifact, without an actor: "build the reader set for an index", "who should hear about this change" | **`resolveArtifactAccess`** · service — public flag + grants with roles, through containers | § Access | re-walking containers by hand to collect grants |
| Delete a folder, or delete a folder and what is in it: "empty this folder", "remove the folder but keep the files" | **`deleteArtifact`** · service (`DELETE /artifact/:id`), **`artifactReadExclusiveContents`** · route, **`/v1/batch`** | § Deleting | a delete that walks a container's members and removes them; a bespoke delete-many endpoint |

---

## Kinds

```ts
// packages/shared/src/artifact/kinds.ts
file:   { contains: [], defaultAccess: 'private', holder: 'local', contentModel: 'File', lazyCopy: true },
folder: { contains: ['file', 'folder'], defaultAccess: 'private', holder: 'local' },
organizationUserFolder: { contains: ['file', 'folder'], defaultAccess: 'private', holder: 'local', systemOnly: true, ownerReach: 'owners' },
```

A fork adds kinds below the template marker. `kind` is immutable after creation, and the `artifactAccess` hook refuses a kind the catalog does not know. The plain create routes (`meCreateArtifact`, `organizationCreateArtifact`, `spaceCreateArtifact`) only create kinds without a `contentModel` and that are not `systemOnly`; a file is created by its upload flow, a system container by the system that owns it.

`integrationId` names the app that holds the artifact's content: null for this app, set when an integration keeps the content and keys it by `Artifact.id`.

---

## Containers

An artifact may sit in many containers, and so may a container ("compliance" can sit under both "legal" and "operations"). **Every edge stays within one owner**: an artifact can't sit in another owner's container. Crossing owners is a copy (FEAT-009 § 6). Grouping across owners is not a container; it is a separate concept for later.

An edge is refused when:
- the container's kind does not list the member's kind (`contains`);
- the two have different owners;
- the edge would close a loop (`findReferenceCycle`, `packages/shared/src/graph/`) or nest deeper than 10.

**Control over both ends.** Creating or removing an edge needs `manage` on the artifact and `operate` on the container (`ARTIFACT_EDGE_AUTHORITY`). This is the Google Drive shape: owner-level control of the item, editor on the destination. An edge publishes the item to the container's audience, so placing someone else's item needs control of that item. The check lives once, in the two services.

Placing a container inside another holds `withOwnerLock(owner, 'containers')`. The loop check reads the owner's container graph and then writes into it, and containers never nest across owners. Placing a non-container takes no lock.

Edges are soft-deleted and audit-enabled.

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

**A member's org-user content.** Content a member makes "as an org user" lives in their `organizationUserFolder`. The folder is owned by the org (the bytes stay with the org), private, and granted to the member. For that folder and everything under it (`ownerReach: 'owners'`), the implicit owner grant is `OrganizationOwner`: org owners reach it, as deliberate governance access, but org admins do not. An explicit grant always works ("if I give you the file, you can access it"). A member who also files something into a team folder has shared it, and the team folder's audience, its admins included, reaches it through that folder.

**Inherit needs a container.** The `artifactAccess` hook:
- stamps the kind's `defaultAccess` on an artifact created with `inherit` or no access;
- resolves `inherit` to `private` on an artifact that sits in no container;
- does the same when its last edge is removed or soft-deleted.

To create inside a container, use **`createArtifact`**: it creates, adds the edge and sets `inherit` in one `db.txn`. Placing an artifact that already sits somewhere keeps its explicit access.

**An actor's role** is the strongest grant it holds. Each grant is capped by what the actor holds on its grantee:

| Grantee | Cap |
|---|---|
| `User` | its own role, capped by a User token; scoped tokens never reach their user's personal grants |
| `Organization` / `Space` | its membership role there |
| `OrganizationManager` / `SpaceManager` | admin or owner there |
| `OrganizationOwner` | owner of the org |
| `OrganizationUser` / `SpaceUser` | the token's role |
| `Integration` | no presenting path yet |

Without read the caller gets 404; with read but not the action, 403. A grant can't be created, changed or revoked by someone whose role is below it.

Not in this cut: access per edge. Access is the node's column plus its containers'.

---

## Deleting

- **Deleting a container deletes the container, never its contents.** Its edges are soft-deleted with it (`softDeleteCascade`), the contents stay, and anything left in no container becomes private. Restoring the container brings its edges back; the contents keep whatever access they had.
- **Deleting the contents as well is a separate action.** `GET /artifact/:id/exclusiveContents` lists the artifacts that sit directly in this container and in no other container, among those the caller can read. To delete them, send one round of `DELETE /api/v1/artifact/:id` requests through `POST /api/v1/batch/execute` with `strategy: 'transactionAll'`: one transaction, all or nothing. A UI may offer the two together; the API keeps them apart.
- **An artifact in more than one container needs `own` to delete**, so one container's manager can't delete something other containers rely on. An artifact in one container needs `manage`. Removing an edge is unchanged (§ Containers).
- System artifacts cannot be deleted. Deleted artifacts' bytes are reclaimed by the orphan sweeper (FEAT-009 § 16).

---

## Webhooks

`Artifact` is a webhook model. Grant and edge changes fire an `Artifact` update for the parent through `webhookRelatedModels`. The audience is the owner and every party with access, through containers, plus a just-revoked grantee. Owners-only content (`OrganizationOwner`) reaches no org-level subscription. See [HOOKS.md](HOOKS.md#related-models).

---

## Source map

| Concern | Path |
|---|---|
| Schema | `packages/db/prisma/schema/artifact.prisma`, `file.prisma` |
| Kind catalog | `packages/shared/src/artifact/kinds.ts` |
| Access resolution | `apps/api/src/modules/artifact/services/resolveArtifactAccess.ts`, `checkArtifactAccess.ts`, `actorPrincipalRole.ts` |
| Edges | `apps/api/src/modules/artifact/services/addArtifactToContainer.ts`, `removeArtifactFromContainer.ts`, `assertNoContainerCycle.ts` |
| Deleting | `apps/api/src/modules/artifact/services/deleteArtifact.ts`, `listExclusiveContents.ts` |
| Access hook | `apps/api/src/hooks/artifactAccess/hook.ts` |
| Routes | `apps/api/src/modules/{artifact,artifactContainer,artifactPermission}/`, `{me,organization,space}CreateArtifact` |
