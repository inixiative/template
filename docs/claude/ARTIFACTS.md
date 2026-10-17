# Artifacts

<!-- toc:start -->

## Contents

- [What an artifact is](#what-an-artifact-is)
- [Kinds](#kinds)
- [Containers](#containers)
- [Access](#access)
- [Webhooks](#webhooks)
- [Source map](#source-map)

<!-- toc:end -->

---

## What an artifact is

An **artifact** is anything that is owned, placed in containers, shared and made public: a file, a folder, and in forks things like posts and channels. There is one node model, `Artifact`, with a `kind`. A container is just an artifact whose kind may hold others, so there is no separate folder table. A kind with content of its own keeps its own tables (`file` → `File`, `FileVersion`).

Why one node: a grant then has a single target, "who may hold what" is a fact in the code catalog rather than a table per kind, and the same access rules serve files, folders and anything a fork adds. The file system's wider design (upload, versions, bindings, lazy copy) is `tickets/FEAT-009-file-management.md`.

| Problem | Use | Read | Signs you're bypassing it |
|---|---|---|---|
| A thing users own and share: "a file", "a folder", "a document", "something inside a workspace", "an item people can be given access to" | **`Artifact`** · model `packages/db/prisma/schema/artifact.prisma` — one row per thing, `kind` from the catalog; its own content tables only when the kind has content | § Kinds; FEAT-009 § 3 | a new folder or document table with its own owner columns and its own permission table |
| What a kind may contain, its access default, whether it may cross owners: "can a folder hold a folder", "posts are public by default" | **`ArtifactKinds`** · registry `packages/shared/src/artifact/kinds.ts` — `contains`, `defaultAccess`, `crossOwner`, `contentModel` | § Kinds | `if (artifact.kind === 'folder')` checks spread through services |
| Put something in a folder, move it, list what is inside: "nest folders", "add to a collection", "crosspost" | **`ArtifactContainer`** · model (the edge) — written only through **`addArtifactToContainer`** / **`removeArtifactFromContainer`** · services `apps/api/src/modules/artifact/services/` | § Containers | a `parentId` or materialized `path` column; `db.artifactContainer.create` from a controller |
| Share with a person, an org, a space, a member or a customer; time-limited share: "give Bob edit access", "share this folder with the design space" | **`ArtifactPermission`** · model — a role on an artifact, inherited by `inherit` artifacts inside it | § Access | a per-feature share table; a shared-with JSON column |
| Can this caller read / edit / manage this artifact: "who can see this file", "is it public" | **`checkArtifactAccess`** · service, **`validateArtifactAccess(action)`** · middleware `apps/api/src/middleware/validations/` | § Access | `validatePermission` on an artifact route (it skips grants); reading `artifact.access` alone to decide public |
| Everyone with access to an artifact, without an actor: "build the reader set for an index", "who should hear about this change" | **`resolveArtifactAccess`** · service — public flag + grants with roles, through containers | § Access | re-walking containers by hand to collect grants |

---

## Kinds

```ts
// packages/shared/src/artifact/kinds.ts
file:   { contains: [], defaultAccess: 'private', holder: 'local', crossOwner: 'copy', contentModel: 'File', lazyCopy: true },
folder: { contains: ['file', 'folder'], defaultAccess: 'private', holder: 'local', crossOwner: 'copy' },
```

A fork adds kinds below the template marker. `kind` is immutable after creation, and the `artifactAccess` hook refuses a kind the catalog does not know. The plain create routes (`meCreateArtifact`, `organizationCreateArtifact`, `spaceCreateArtifact`) only create kinds without a `contentModel`; a file is created by its upload flow.

`integrationId` names the app that holds the artifact's content: null for this app, set when an integration keeps the content and keys it by `Artifact.id`.

---

## Containers

An artifact may sit in many containers. Edges are refused when:
- the container's kind does not list the member's kind (`contains`);
- the owners differ and the member's kind is `crossOwner: 'copy'` (files and folders cross owners by copy, FEAT-009 § 6);
- the edge would close a loop (`findReferenceCycle`, `packages/shared/src/graph/`) or nest deeper than 10.

**Control over both ends.** Creating or removing an edge needs `manage` on the artifact, because an edge publishes it to the container's audience, and `operate` on the container (`ARTIFACT_EDGE_AUTHORITY`). This is checked once, in the two services.

Placing a container inside another holds `withOwnerLock(platform, 'containers')`: the loop check reads the graph and then writes into it. Placing a non-container takes no lock.

The container side of the edge is `Restrict`: a container is hard-deleted only after its edges are removed. Its soft delete leaves edges in place, and it still counts for access.

---

## Access

`Artifact.access` is `inherit`, `public` or `private`:

| `access` | Public? | Takes its containers' grants? |
|---|---|---|
| `inherit` | if any container resolves public | yes, from every container |
| `public` | yes | yes |
| `private` | no | no — private overrides; you can be private inside a public group |

Grants an artifact carries are its own `ArtifactPermission` rows (expired ones dropped) plus the implicit owner grant: the owning user, or `OrganizationManager` / `SpaceManager` (owners and admins of the owning org or space). An `inherit` or `public` artifact adds every container's grants; a container's implicit ownership passes down capped at `admin`.

**Inherit needs a container.** The `artifactAccess` hook stamps the kind's `defaultAccess` on an artifact created with `inherit` or no access, resolves `inherit` to `private` on an artifact in no container, and does the same when the last edge is removed. To create inside a container use **`createArtifact`**, which creates, adds the edge and sets `inherit` in one `db.txn`.

**An actor's role** is the strongest grant it holds, each capped by what it holds on the grantee: its own role for a `User` grantee (a User token caps it), its membership role for an `Organization`/`Space` grantee, admin or owner for the manager principals, the token's role for `OrganizationUser`/`SpaceUser` grantees. An `Integration` grantee has no presenting path yet. Without read the caller gets 404; with read but not the action, 403. A grant can't exceed the granter's own role.

Not in this cut: access per edge. Access is the node's column plus its containers'.

---

## Webhooks

`Artifact` is a webhook model. Grant and edge changes fire an `Artifact` update for the parent through `webhookRelatedModels`. The audience is the owner and every party with access, through containers, plus a revoked grantee. See [HOOKS.md](HOOKS.md#related-models).

---

## Source map

| Concern | Path |
|---|---|
| Schema | `packages/db/prisma/schema/artifact.prisma`, `file.prisma` |
| Kind catalog | `packages/shared/src/artifact/kinds.ts` |
| Access resolution | `apps/api/src/modules/artifact/services/resolveArtifactAccess.ts`, `checkArtifactAccess.ts`, `actorPrincipalRole.ts` |
| Edges | `apps/api/src/modules/artifact/services/addArtifactToContainer.ts`, `removeArtifactFromContainer.ts`, `assertNoContainerCycle.ts` |
| Access hook | `apps/api/src/hooks/artifactAccess/hook.ts` |
| Routes | `apps/api/src/modules/{artifact,artifactContainer,artifactPermission}/`, `{me,organization,space}CreateArtifact` |
