# FEAT-009: File Management System

**Status**: In Progress — artifact abstraction (Artifact / ArtifactContainer / ArtifactPermission, access resolution, edge guard, webhooks) + file schema + resourceBinding registry + factories (PR #72)
**Priority**: High
**Created**: 2026-02-06
**Updated**: 2026-10-17 (files and folders become kinds of one `Artifact` node: container edges replace the folder tree and materialized paths, access is the `access` column + `ArtifactPermission` resolved as a union over containers; `FolderVisibility` and the `public` grant are gone)
**Dependencies**: Railway Buckets, Space Transfer (inquiry system)

---

## 1. Overview

File upload, storage, access control, sharing, and resource binding for the template. Two Railway Buckets (system + user), S3-compatible, private-only. Ownership, access, and usage are separate concerns managed at the application layer.

**Design principles:**
- **This is not a filesystem.** It's usage tooling + permission boundaries for SaaS workflows. Upload, bind, share, serve — the storage mechanics should stay out of the way.
- Usage layer (ResourceBinding) and permission boundaries (scope/share model) are the SaaS core. Everything else should feel effortless.
- Users are first-class owners alongside orgs and spaces — personal files exist independent of any org
- Three-layer separation: storage (Artifact + File/FileVersion) → access (`Artifact.access` + ArtifactPermission) → usage (ResourceBinding)
- Two kinds of ownership: storage (immutable, who pays) vs access (mutable, who manages)
- Containment is an edge (`ArtifactContainer`), not a path: an artifact may sit in many containers, and containers are artifacts
- Within-scope = move (same File, rewrite its container edges only — keys never change); cross-scope = copy (new File, new owner)
- Org/space owners and admins get implicit broad access via ReBAC; everyone else needs explicit ABAC
- Access is mutable (permission records with roles and expiry, inherited through containers)
- Public read is the artifact's `access` column (`public`, or `inherit` from any public container); there is no public grant
- System folders provide scaffolding; user folders provide flexibility
- De-emphasize elaborate folder features and power-user file browser UX in favor of strong workflow integration

> **NOTE: Model names are provisional.** Names like `ResourceBinding`, system folder names,
> etc. may change during implementation. The layer separation and patterns are the core decisions.

---

## 2. Architecture — Three Layers

| Layer | Concern | Model(s) | Answers |
|-------|---------|----------|---------|
| **Storage** | What it is, who owns it, where it sits | `Artifact` (+ `ArtifactContainer` edges), and for files `File`, `FileVersion` | Who owns it? Which containers hold it? Which version is current? |
| **Access** | Who can see/download/manage (internal) | `Artifact.access`, `ArtifactPermission` | Is it public? Who has what role? When does it expire? |
| **Usage** | What role a file plays on a resource | `ResourceBinding` | What role does this file play, and how is it rendered? |

Why three layers:
- **One model** breaks when access needs to vary per-user or expire
- **Two models** (file + permission) breaks when the same file is used as a logo AND an attachment — usage varies per binding, independent of the file
- **Three models** keeps each concern clean and independently queryable

**Why one node, not File + Folder.** A folder and a file are both things that get owned, shared and made public, and the Artifactory's posts and channels are the same again. One `Artifact` with a `kind` gives a grant a single target, makes a container just another artifact, and turns "what may hold what" into a fact in the code catalog (`packages/shared/src/artifact/kinds.ts`) rather than a table per kind. A kind that has content of its own keeps its own tables: `File`/`FileVersion` for `file`.

**Public is an artifact-level state, like Google Drive:** "public" is the artifact's `access` (§6), inherited through containers — not a per-usage property. A file's bytes have one access state; bindings only describe *where* it is used.

**Intent — bidirectional visibility is the whole point:**

Most SaaS apps treat files as write-once blobs. You upload, get a URL string, paste it into a column, and forget about it. The file and its usages are completely disconnected — the URL *is* the binding, and URLs don't know who's pointing at them. This leads to silent orphans (files nobody uses but nobody can safely delete), broken references (someone deletes a file and three pages lose their banner), and zero visibility in either direction ("what is this file doing?" / "where did this logo come from?").

This system is designed so that **every file knows what it's doing, and every usage knows where it comes from.** File → ResourceBinding gives you "this image is used as a logo on 2 spaces, an attachment on 3 inquiries, and shared with 4 users." ResourceBinding → File gives you "the banner on this space is owned by org Z and has 3 other usages elsewhere." This bidirectional graph is what makes delete safety, lazy copy, access revocation, and lifecycle management possible — you can't orphan silently because the system knows every reference.

**When writing code against this system:** never store a raw URL string to reference a file. Always go through ResourceBinding. If something displays a file, there should be a binding. If there's no binding, the file isn't in use and can be safely cleaned up. This invariant is what keeps the graph complete. The one exception is URL-only bindings (external assets not managed in our storage) — these still go through ResourceBinding, they just don't have a File record behind them.

---

## 3. Data Model

Schema: `packages/db/prisma/schema/artifact.prisma` and `file.prisma`. Ownership and grantees are false polymorphism, registered in `packages/db/src/registries/falsePolymorphism.ts`.

### 3.1 Artifact (the node)

```prisma
model Artifact {
  id, createdAt, updatedAt, deletedAt
  kind   String           // key into the kind catalog (§3.2)
  name   String
  access ArtifactAccess   // inherit | public | private
  system Boolean          // auto-created scaffolding, undeletable
  integrationId String?   // the app holding the content: null = this app (a File); set = that integration
  ownerModel ArtifactOwnerModel  // User | Organization | Space — one FK set, never changes
  userId?, organizationId?, spaceId?
  file File?; permissions ArtifactPermission[]
  containers ArtifactContainer[]  // edges where this artifact is the member
  members    ArtifactContainer[]  // edges where this artifact is the container
}
```

`kind` is immutable (the immutableFields registry) and validated against the catalog by the `artifactAccess` hook. Artifact is audit-enabled, so it is soft-deleted.

### 3.2 Kind catalog (code)

```ts
export const ArtifactKinds = {
  file:   { contains: [],                 defaultAccess: 'private', holder: 'local', contentModel: 'File', lazyCopy: true },
  folder: { contains: ['file', 'folder'], defaultAccess: 'private', holder: 'local' },
  organizationUserFolder: { contains: ['file', 'folder'], defaultAccess: 'private', holder: 'local', systemOnly: true, ownerReach: 'owners' },
  // forks add kinds below
};
```

- `contains` — what a container kind may hold; a kind with an empty list is not a container.
- `defaultAccess` — stamped at creation when the artifact is created outside a container (§6).
- `systemOnly` — created by its system (the org_user folder), never by the plain create route.
- `ownerReach: 'owners'` — the owning org's owners reach it and what sits under it implicitly; its admins do not (§10).
- `contentModel` — a kind with its own content table is created by its own flow (upload, §7), never by the plain create route.
- `ownerRoot` — the `ownerRoot` kind is each owner's root container (§3.3).

### 3.3 ArtifactContainer (the placement)

`{ containerArtifactId, artifactId }`, one live placement per pair: "this artifact exists in that container". Containment organises; access comes from grants, and the access walk joins through placements to the containers' grants. **Every owner has a root container** (`ownerRoot`, created with the owner), and every artifact is placed in its owner's root for as long as it lives, so there is no orphan state. Any artifact may sit in several containers; containers nest only within one owner, while a non-container (a file) may also be placed in another owner's container as a read-capped use. Loops are refused and nesting stops at 10 (§5). Placements are soft-deleted and audit-enabled; deleting either end tombstones them. Rules: ARTIFACTS.md § Placements and the owner root.

### 3.4 ArtifactPermission (Access Layer — ABAC)

A grant of a `role` (`Role`: viewer / member / admin / owner) on an artifact, and through `inherit` on everything inside it. The grantee is false-polymorphic with real FKs: `User`, `Organization`, `Space`, `OrganizationUser` (`granteeOrganizationId + granteeUserId`), `SpaceUser` (`granteeOrganizationId + granteeSpaceId + granteeUserId`), `CustomerRef`, `Integration`. Membership grantees cascade with the membership: a grant dies when the member leaves, the content does not. Fields carried over from FilePermission: `expiresAt`, `fromVersion`, `preserveOnRevoke`. One live grant per artifact × grantee (partial uniques over live rows). **Revoke = soft delete**: ArtifactPermission is audit-enabled, so who granted and revoked is in the audit log.

An `Integration` grantee is not reachable by any presenting path in template yet: it is meant for an integration's own server credential, never for a user token bound to that integration.

### 3.5 File (the file kind's own table)

```prisma
model File {
  id, createdAt, updatedAt
  artifactId   String @unique   // identity, owner, name, access and placement live on the Artifact
  sourceFileId String?          // set when this File is a lazy-copy snapshot
  versions FileVersion[]; bindings ResourceBinding[]
}
```

### 3.5.1 FileVersion (content)

One row per uploaded version. Current version = highest active (`WHERE status = 'active' ORDER BY version DESC LIMIT 1`). Revert = a new row at `max + 1` reusing the prior version's `key` (no byte copy); the key is refcounted before purge. The File tombstones once all its versions reach `purged`.

```prisma
model FileVersion {
  id           String @id @default(uuid())
  fileId       String
  version      Int
  key          String                  // S3 key; not @unique — a revert reuses a prior version's key
  contentType  String
  size         Int
  status       String @default("pending")   // pending → active → purging → purged | failed
  revertedFrom Int?

  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt

  file         File @relation(fields: [fileId], references: [id])

  @@unique([fileId, version])
}
```

### 3.6 ResourceBinding (Usage Layer)

What role an artifact (a File, or any other kind) — or an external URL — plays on a resource (logo, avatar, …): the "use". Two false-poly axes: the **source** (`Artifact | url`; `Artifact` is a real FK, `url` a sentinel) and the **resource** it is bound to (real FK per arm, fork-extensible — the email builder adds `EmailTemplate`/`EmailComponent`, inixiative adds `Event`). `bindingType` is a registry key, not a DB enum, so types extend per fork. No access lives here — public read is the file's `access` (§6); a `requiresPublic` type presupposes it (enforced, below).

```prisma
model ResourceBinding {
  id               String @id @default(uuid())

  sourceModel      ResourceBindingSource     // File | url
  fileId           String? @db.VarChar(36)
  url              String?

  resourceModel    ResourceBindingResource   // Organization | Space | User | CustomerRef
  organizationId   String? @db.VarChar(36)
  spaceId          String? @db.VarChar(36)
  userId           String? @db.VarChar(36)
  customerRefId    String? @db.VarChar(36)

  bindingType      String                    // key into shared/resourceBinding
  order            Int      @default(0)       // ordering for many-cardinality types
  media            Json?                     // overrides the type's default render settings
  conditions       Json?                     // device / viewport / darkMode

  createdAt        DateTime @default(now())
  updatedAt        DateTime @updatedAt
}
```

**Binding-type registry** (`packages/shared/src/resourceBinding`) — start minimal, extend as resources need it:

```ts
// binding types
{
  logo:   { cardinality: 'single', accepts: ['image'], source: 'both', requiresPublic: true },
  avatar: { cardinality: 'single', accepts: ['image'], source: 'both', requiresPublic: true },
}
// resource -> allowed types
{
  Organization: ['logo'],
  Space:        ['logo'],
  User:         ['avatar'],
  CustomerRef:  ['avatar'],
}
```

**`requiresPublic` is a validated invariant** (a `requiresPublic` binding pins its file's own `access = public` — the file's own column, not an inherited state, so the guard reads one column rather than a subtree), checked both ways: creating such a binding **requires** the file's `access` is `public`; changing it away from `public` is **blocked** while any `requiresPublic` binding references the file. A **`removeAllBindings(file)`** call clears the dependencies so the file can then go private.

**Follow / track (deferred, not built):** a party wants to track an artifact — and keep it if it is withdrawn — even while it is public. Public readers ride the artifact's `access`, so they hold no permission row to carry `preserveOnRevoke`. Following is therefore a **binding** (a declared dependency with no render slot) from the follower's own resource (User first) to the artifact. It sits on the artifact model unchanged: the binding targets the `File` today and generalises to any `Artifact` (`sourceModel: Artifact`) when a non-file kind needs it. The existing trigger path covers it: the artifact leaves `public` (its own column, or its last public container goes) → the access diff of §6 finds the follower's binding → lazy copy into the follower's `__preserved/` for kinds with `lazyCopy`, a notification otherwise. Follow-up, with empty-slot semantics and which resources may follow still open.

**Upload limits:** none enforced server-side on pure files. The UI validates size/type for files with a planned purpose (it knows the intended binding). The one server invariant is `accepts`, checked at *bind* time.

### 3.7 How the layers interact

- **Upload** — create the `file` Artifact + File + FileVersion(`pending`), presign POST, client uploads, confirm HEAD-verifies, FileVersion → `active`. Uploading into a folder places the artifact in it with `access: inherit`, so it takes the folder's audience; the uploading member gets an owner grant on what they created.
- **Download** — resolve access (`checkArtifactAccess`, §6), presign GET the current version's key.
- **Bind** — create a ResourceBinding (§3.6); a `requiresPublic` type presupposes the file's own `access = public`.
- **Public serve** — a file whose access resolves public (its own column, or `inherit` under a public container) serves through the CDN proxy with no auth (§8).
- **Lazy copy** — an active binding or `preserveOnRevoke = true` snapshots the File into the owner's `__preserved/` folder when access is lost (§6); no job table — the snapshot's versions sit `pending` and serve from the source key until the sweeper copies bytes.

---

## 4. Bucket Architecture

### Two buckets (per environment)

| Bucket | Purpose | Contents |
|--------|---------|----------|
| **system** | Platform assets — default avatars, email templates, branding | Fixed platform keys |
| **user** | All user/org/space uploads | Flat: `{fileVersionId}-{filename}` at the root |

Railway auto-provisions per environment: 2 buckets × N environments.

**Keys are immutable and flat.** A `user`-bucket key is `{fileVersionId}-{filename}` at the bucket root — no owner/space/folder prefix. Containment and ownership live only in Postgres (`ArtifactContainer` edges + `Artifact.ownerModel`). Moves and renames are pure DB row updates; nothing ever re-keys S3. One version = one key; a revert reuses a prior version's key (§3.5.1). Cross-owner adoption stays copy → new File → new FileVersion → new key.

**System bucket** — no org scoping, pure platform assets:
```
system-bucket/
  defaults/avatar.png
  email/header.png
  branding/logo.svg
```
Org-specific "system" assets (e.g. a white-label email header) are `user`-bucket files with a ResourceBinding to the org's config — not system-bucket files.

### Ownership by owner FK

| `ownerModel` | Who pays | Survives user leaving org? |
|--------------|----------|----------------------------|
| `User` | User / platform | Yes — personal files persist |
| `Organization` | Org | Org keeps bytes; departed user loses access |
| `Space` | The space's org | N/A |

---

## 5. Container Graph & Traversal

Containment is a graph of `ArtifactContainer` edges, not a materialized path: an artifact may sit in several containers. Every walk is level by level with Prisma `findMany` (no raw SQL, no recursive CTE), keeps a visited set, and stops at depth 10.

| Helper | Where | Does |
|---|---|---|
| `loadArtifactGraph(ids)` | `modules/artifact/services/` | the artifacts and every ancestor container, with their grants (soft-deleted containers included) |
| `listArtifactDescendants(id)` | same | the subtree below a container: subtree listing, the "N dependents" view for a move |
| `artifactAncestorDepth(id)` | same | how deep a container already sits, for the depth cap |
| `findReferenceCycle(map, start)` | `packages/shared/src/graph/` | the loop an edge would close (moved from the segment reference graph; segments use it too) |

**Writes are serialized for container kinds.** Placing a container inside another checks for a loop and then adds the edge, so it holds `withOwnerLock(owner, 'containers')`; containers never nest across owners, so one owner's lock suffices. Placing a non-container (a file) can't close a loop and takes no lock.

**Navigation** has no primary parent: an item shows its direct parents ("above") and children ("below"), and an expanded view of the whole graph above it (`GET /artifact/:id/ancestors`, each shared ancestor once). The top of the browser is the root view: artifacts in the owner's root with no other placement in their owner. See ARTIFACTS.md § Navigating.

---

## 6. Access Control

### Resolution

Implemented in `apps/api/src/modules/artifact/services/` — `resolveArtifactAccess` (actor-free) and `checkArtifactAccess` (for an actor).

**The node's own `access`:**

| `access` | Public? | Takes its containers' grants? |
|---|---|---|
| `inherit` | if **any** container resolves public | yes, from every container (the union) |
| `public` | yes | yes (public only widens) |
| `private` | no | **no** — the artifact has only its own permissions; you can keep your own things in a public folder. Most should inherit |

**Grants an artifact carries:** its own live `ArtifactPermission` rows (expired ones dropped), plus an implicit owner grant — the owning user, or `OrganizationManager`/`SpaceManager` for org/space-owned (owners and admins of the owner, at their role; FEAT-009's ReBAC inheritance), or `OrganizationOwner` for org-user content (§10). Through a non-private node, each container's grants pass down at their role.

**This replaces "most specific wins".** The earlier design resolved one grant by path specificity (`ORDER BY specificity DESC LIMIT 1`), so a file could be narrower than its folder. Under the union, nothing beneath a container is narrower than it through inheritance. The only ways to narrow are an explicit `private` (which takes nothing from containers) or removing the edge. There is no public grant and no `publicUntil`, so time-limited *public* links are gone (time-limited shares to a grantee stay, via `expiresAt`).

**An actor's role on an artifact** is the strongest grant it holds, each capped by what the actor holds on the grantee:

| Grantee | The actor holds it when | Cap |
|---|---|---|
| `User` U | the actor is U | its own role on U (session: owner; User token: the token's role) |
| `Organization` / `Space` | it is a member | its effective role there (membership ∧ token) |
| `OrganizationManager` / `SpaceManager` | its effective role there is admin or owner | that role |
| `OrganizationUser` / `SpaceUser` | it is that user, acting as a member | the token's role, if any |
| `CustomerRef` | it holds the CustomerRef's customer party | as above for that party |
| `Integration` | never yet (§3.4) | — |

Roles map to actions as everywhere else: viewer → read, member → operate, admin → manage, owner → own. A superadmin holds everything. A caller with no read gets **404** (no id probing); read but not the action gets 403.

**Creation.** An artifact created with `inherit` (or no access) gets its kind's `defaultAccess` (files and folders private; the `artifactAccess` hook). `createArtifact` places it in its owner's root and, if asked, in a container with `inherit`, in one `db.txn` under the owner lock. The root confers nothing, so an artifact only at its root is effectively private.

**Placement writes** go through `placeArtifact` / `removeArtifactFromContainer`. Placing needs `manage` on the artifact and `operate` on the container (the Google Drive shape). Removing a same-owner placement needs the same; removing one from another owner's container needs either `operate` on that container (eviction) or `manage` on the artifact (withdrawal). The root placement can't be removed. Across owners, inherited access is capped at read (`CROSS_OWNER_INHERITED_ROLE`). Every placement write holds `withOwnerLock(owner, 'containers')` before its transaction.

**Deleting.** Deleting a container deletes the container, never its contents: its placements are tombstoned with it, and the contents stay in their owner's root. Deleting the contents is a separate action: `GET /artifact/:id/exclusiveContents` lists what sits only in that container, and the deletes go through `/v1/batch` (`transactionAll`, one transaction). Deleting an artifact always needs `own` and removes all its placements. Deleted bytes are reclaimed by the orphan sweeper (§16).

**Grants can't exceed the granter.** Creating or raising a grant needs `manage` on the artifact and a role no higher than the granter's own.

**Not in this cut: edge-level access.** An edge carries no access of its own; access is the node's column plus the container's. A per-edge setting (in this channel public, in that one private) is a noted extension.

### Access scenarios

| Scenario | How |
|----------|-----|
| User uploads personal file | user-owned, private |
| Member uploads into a space folder | space-owned, `inherit`; the member gets an owner grant (SpaceUser) |
| Customer submits to Space | CustomerRef `viewer` grant + attachment binding |
| Set as org logo | the file's own `access = public` + logo binding |
| Admin shares an org folder with a Space | Space grant on the folder; `inherit` members take it |
| Admin shares with a specific User | User grant on the file or folder |
| Time-limited share | grant with `expiresAt` |
| Keep one file private inside a shared folder | the file's `access = private` |

### Boundary crossing — within-scope = move, cross-scope = copy

| Operation | Same owner? | Effect |
|-----------|-------------|--------|
| Move between folders in one scope | yes | rewrite container edges; no S3 |
| Submit personal file to org/space | no | temporary ArtifactPermission grant; no copy |
| Org/space adopts a submission | no | copy bytes → new File (new owner, new key); original stays |
| Share org folder with a space | same org | ArtifactPermission grant; no copy |

Ownership never moves: ownership = billing boundary, and the original stays for audit/rollback. Adopting another owner's file (taking ownership) is a copy. Showing it somewhere else is not: a file may be placed in another owner's container as a use, read-capped for that audience, with the bytes still the original owner's. Containers never cross owners.

**Space transfer** (§15), **user leaves org**, **space soft-delete**: ownership FKs never change; grants are re-issued or deleted per the transfer disposition; org-scoped files stay with the org; the user's own (`ownerModel: User`) files are untouched. Soft-delete sets `Artifact.deletedAt`; S3 bytes wait for the retention sweeper (§16).

### Lazy copy (copy-on-revoke)

Grantees can build on a file they don't own (bind it, depend on it). Revoking access shouldn't silently break those dependents — so when access is lost, they get a frozen snapshot.

**Fires** when a dependent loses access to the source file, or the source is soft-deleted, *and* the grantee is a dependent:
- an **active ResourceBinding** points at the file (automatic), or
- the grantee's ArtifactPermission has **`preserveOnRevoke = true`** (opt-in).

Under the union, access to a bound file can be lost several ways: a grant on it or any ancestor is deleted or expires, an edge is removed, or a container's `access` changes. Each such write diffs the resolved access of the bound files under the changed node before and after; that one diff fires lazy copy and the `Cache-Tag` purge (§8).

**The snapshot** is a new File owned by the dependent, in their `__preserved/` folder, `sourceFileId` set for provenance. It copies every version `>= fromVersion`; those FileVersions start `pending` and serve from the source key until the sweeper (§16) copies bytes, then go `active`. No job table. The dependent's bindings repoint to the snapshot. Who triggered it is the audit log's job — no snapshot actor fields on File.

**`__preserved/`** is a per-scope `system` folder — a landing zone, not a jail; users can move copies out.

**No auto-heal.** If access is later re-granted, the user keeps both the snapshot and renewed live access; manual reconnect is a deferred follow-up (§17).

### "Shared with me" virtual view

A query over ArtifactPermission where one of the user's principals is grantee (active, unexpired): shared folders browse naturally; individually-shared files show as a flat list. Items are role-limited by the grant. `__preserved/` copies are real owned files and also appear in normal browsing.

---

## 7. Upload Flow (Presigned POST)

### Why presigned POST

`createPresignedPost` pins the exact key + content-type at the bucket level (an extracted URL can't be abused); the browser uploads straight to the bucket with no API memory pressure.

### Sequence

```
1. Client → POST /files/presign { filename, contentType, containerArtifactId? }
   permix check for upload in the target scope; operate on the container.
2. API creates the `file` Artifact + File + FileVersion(status: "pending",
   key = {fileVersionId}-{filename}) through `createArtifact`: inside a container
   it is `inherit`, and the uploading member gets an owner grant.
3. API returns a presigned POST (short TTL) with exact-key + content-type conditions.
4. Client → Bucket: POST directly.
5. Client → POST /files/:id/confirm → API HEADs the object, FileVersion → "active".
```

Status lives on FileVersion; the File is current at its highest `active` version. No server-side size/type limit on pure files (§3.6) — the UI validates for planned-purpose uploads, and `accepts` is enforced at bind time. Who uploaded it is the audit log's job — no uploader field, no S3 user metadata. Stale `pending` and failed versions are reconciled by the sweeper (§16).

---

## 8. Download & Public Serving

### Internal downloads

```
GET /files/:id/download
1. Load File → resolve the current version's key.
2. Check access (`checkArtifactAccess`, §6).
3. Presign GET (TTL ~15 min) → 302 or { url, expiresAt }.
```

### Public serving via Cloudflare

A file is publicly served iff its access resolves public (§6): its own `access = public`, or `inherit` under a public container — never via a ResourceBinding.

```
Client → yourapp.com/public/files/:id
  → Cloudflare CDN (cache hit → serve)
  → miss: API confirms the file resolves public → presign GET → stream with cache headers

Cache-Control: public, max-age=86400
Cache-Tag: file-{fileId}
ETag: from bucket response
```

Stable URLs that don't expire; global edge cache; purge by `Cache-Tag` when the file stops resolving public (§6's access diff) or the current version changes. No auth check — public access is the authorization.

---

## 9. Permission Model (permix integration)

### Artifact actions

Artifacts use the standard actions (read, operate, manage, own) and are checked by `validateArtifactAccess(action)` (`apps/api/src/middleware/validations/`), which runs `checkArtifactAccess` — the grants leg is resolved from the database, so artifacts are not a ReBAC schema entry.

| Org/Space Role | read | operate (upload) | manage | own |
|----------------|------|-----------------|--------|-----|
| viewer | via ArtifactPermission | no | no | no |
| member | via ArtifactPermission | yes | what they created (owner grant) | no |
| admin | all in org/space | yes | all in scope | no |
| owner | all | yes | all | yes |

### ArtifactPermission roles (ABAC layer)

| ArtifactPermission role | Allows |
|---------------------|--------|
| `viewer` | See metadata, download content |
| `member` | Viewer + place things into it (operate), basic operations |
| `admin` | Member + rename, move it, delete, share, manage permissions |
| `owner` | Admin + grant/revoke access ownership, permanent delete |

This is the existing `Role` enum — one vocabulary across the system. Public read is not a grant; it is the artifact's `access` (§6).

**Org/space owners/admins don't need ArtifactPermission records** — they get implicit
broad access as `OrganizationManager`/`SpaceManager` (§6). An ArtifactPermission `role = owner` is
*access* ownership (management authority) on a specific artifact, distinct from
`Artifact.ownerModel` storage ownership.

---

## 10. System Folder Auto-Creation

Hooks auto-create `system` folders (undeletable, unrenameable) as scopes come into being:

| Event | Folder | Owner | access | Grant |
|-------|--------|-------|--------|-------|
| Organization created | org root (`ownerRoot`, built) | Organization | private | — |
| Space created | space root (`ownerRoot`, built) | Space | private | — |
| OrgUser created | `org_user` | Organization | private | owner grant to that OrganizationUser |
| User created | user root (`ownerRoot`, built) | User | private | — |
| First lazy copy in a scope | `__preserved/` | scope owner | private | — |

**One visibility system (Aron, 2026-10-17).** There is no separate listing flag: the earlier `FolderVisibility.private` ("hidden from admins in normal browse") is gone. Privacy is ownership + `access` + grants. Work you want kept apart from what you share with your organization is made as an org user: the `org_user` folder is an `organizationUserFolder` artifact, owned by the Org (bytes stay with the org when the user leaves), private, and granted to the member. **Org admins do not reach it; org owners do** (`ownerReach: 'owners'` → the `OrganizationOwner` principal) as deliberate governance access, with tooling to come. An explicit grant always works. Filing something into a team folder shares it with that folder's audience. Auto-creating the folder on membership is part of the system-folder hooks below. Other `__` system folder names remain TBD.

## 11. Infrastructure

### Railway Bucket Setup

- Add to init script: `bucketSetup.ts` / `bucketSteps.ts`
- Two buckets per environment: `{project}-system` and `{project}-user`
- Env vars: `SYSTEM_BUCKET_*` and `USER_BUCKET_*` (NAME, ACCESS_KEY_ID, SECRET_ACCESS_KEY, ENDPOINT, REGION)

### Storage adapter (already exists)

The storage adapter ships today (`apps/api/src/lib/storage/`, see ADAPTERS.md): `system`/`user` buckets, `presignPost` (content-length-range), `presignGet`, `headObject`, `copyObject`, `deleteObject`, `tagObject`. The services below build on it; NoopStorageClient slots into `makeAdapterRouter` env routing rather than being bespoke. Buckets are flat — no key hierarchy in `user`.

### Dependencies

- `@aws-sdk/client-s3` — S3 operations (type stubs already exist in `optionalDeps.d.ts`)
- `@aws-sdk/s3-request-presigner` — presigned URL generation (type stubs exist)
- `@aws-sdk/s3-presigned-post` — presigned POST with conditions (Carde pattern)

### API Module Structure

```
apps/api/src/modules/file/
├── routes/
│   ├── filePresign.ts              — POST /files/presign
│   ├── fileConfirm.ts              — POST /files/:id/confirm
│   ├── fileRead.ts                 — GET /files/:id
│   ├── fileReadMany.ts             — GET /files
│   ├── fileDownload.ts             — GET /files/:id/download
│   ├── fileUpdate.ts               — PATCH /files/:id
│   ├── fileDelete.ts               — DELETE /files/:id
│   └── filePublicDownload.ts       — GET /public/files/:id (served on the `public` grant, §8)
├── controllers/
├── validations/
├── services/
│   ├── s3Client.ts                 — configured S3 clients (system + user buckets)
│   ├── presign.ts                  — presigned POST URL generation
│   └── (access, containment and traversal come from modules/artifact)
└── tests/

apps/api/src/modules/artifact/              — built (PR #72): the node, its edges and grants
├── routes/  artifactRead, artifactReadAccess, artifactUpdate, artifactDelete,
│            artifactReadManyArtifacts (members), artifactReadManyArtifactContainers,
│            artifactCreateArtifactContainer, artifactCreateArtifactPermission,
│            artifactReadManyArtifactPermissions
├── services/ resolveArtifactAccess, checkArtifactAccess, actorPrincipalRole, loadArtifactGraph,
│            listArtifactDescendants, createArtifact, placeArtifact, listArtifactUses, ensureOwnerRoot,
│            removeArtifactFromContainer, assertNoContainerCycle, artifactWebhookAudience
└── tests/
apps/api/src/modules/artifactContainer/     — artifactContainerDelete
apps/api/src/modules/artifactPermission/    — artifactPermissionUpdate, artifactPermissionDelete
me / organization / space                   — {owner}CreateArtifact (plain kinds: folder)
```

### NoopStorageClient (dev/testing)

From Zealot's `NoopAssetsClient` pattern:
- Presign returns dummy URLs
- Confirm always succeeds
- Download returns placeholder content
- Full API test suite runs without bucket credentials

---

## 12. Open Decisions

- [ ] **Personal file billing** — who pays for `ownerModel: User` files? Platform? Plan tier?
- [ ] **Soft delete retention** — how long before purge? 30d? 90d?
- [ ] **Virus scanning** — scan on confirm? Skip for v1?
- [ ] **Image processing** — thumbnails on upload? Defer?
- [x] **Max folder depth** — containers nest at most 10 deep, refused on the edge write.
- [ ] **System folder names** — what `__` system folders does each scope actually need?
- [ ] **Cloudflare setup** — part of init script? Or manual DNS setup?
- [ ] **Lazy copy quota** — do preserved copies count toward the recipient's quota? (Probably — they own the bytes now)
- [ ] **`__preserved/` folder creation timing** — eagerly with scope, or lazily on first copy?

### 12.1 UI Concept: Split-Pane File Browser

> **NOTE:** This describes the UX concept, not a spec. Details will be refined during implementation.

Side-by-side file browser — when working in a space, you can open a second pane showing org-level or personal folders. Enables drag-and-drop across scopes visually.

```
┌─────────────────────────┬─────────────────────────┐
│  Space: Design Team     │  Personal: My Drafts    │
│  ─────────────────────  │  ─────────────────────  │
│  📁 assets/             │  📁 drafts/             │
│  📁 deliverables/       │    📄 new-logo-v3.png   │
│  📄 brand-guide.pdf     │    📄 sketch-rough.ai   │
│                         │  📁 references/          │
│                         │    📄 competitor.png     │
│  [Drop zone]            │  [Drag from here]       │
└─────────────────────────┴─────────────────────────┘
```

**Allowed pane combinations:**

| Left pane | Right pane | Allowed? | Why |
|-----------|------------|----------|-----|
| Space | Personal | Yes | Submit personal work to space |
| Space | Org | Yes | Browse org assets while in space context |
| Org | Personal | Yes | Submit personal work to org |
| Space A | Space B (same org) | Yes | Cross-space sharing within org |
| Org A | Org B | **No** | Cross-org = data leak risk, never allowed |

**Cross-scope drag behavior:**
- Within same owner → real move (update `path`, DB only)
- Across owners → triggers the submit/adopt flow (§6, boundary crossing)
- Drag from personal → space = "submit as draft" (temporary share, no copy yet)
- UI should make it clear this is a submission, not a move

Uses the existing split-detail pane component from the template.

---

## 13. Implementation Phases

> **Priority lens:** Usage tooling + permission boundaries first. Systems invariants (delete safety,
> reconciliation, cross-scope semantics) before product features (search, previews, bulk UX).
> The goal is a workflow-first file system, not a generic Dropbox.

### Phase 1: Core — Storage + Versioning + Permissions + Usage + Invariants

Build the whole graph at once — versioning and bindings are core, not follow-ups.

- [x] Prisma models (Artifact, ArtifactContainer, ArtifactPermission, File, FileVersion, ResourceBinding)
- [x] Kind catalog; access resolution (union over containers, private override, inherit → private without a container); edge guard (both ends), loop and depth refusal; grant ceiling
- [x] Artifact webhooks: grant and edge changes fire the parent Artifact to its owner + grantees (§17 Webhooks)
- [ ] Storage adapter wiring (system + user buckets, flat keys) + NoopStorageClient via `makeAdapterRouter`
- [ ] FileVersion lifecycle: `pending → active → purging → purged | failed`; current = highest `active`; revert = new version reusing a prior key (refcounted)
- [x] Container traversal helpers (DB-only moves, §5)
- [ ] System folder auto-creation hooks (org, space, org_user, user, `__preserved/`)
- [ ] Presigned POST upload + confirm (HEAD-verify) flow
- [ ] Download (access resolution is built: `checkArtifactAccess`)
- [x] ArtifactPermission (false-poly grantee; `Role` enum; `fromVersion`, `preserveOnRevoke` default false)
- [ ] File module routes (upload, confirm, download); the artifact routes are built
- [ ] Init script: Railway Bucket setup (2 buckets)
- [ ] Cross-owner copy vs within-scope move (move = edge rewrite; cross = copy → new File → new key; the edge already refuses cross-owner files)
- [ ] Duplicate/collision handling (policy: allow same name, ids are canonical)
- [ ] ResourceBinding + binding registry (logo/avatar); `requiresPublic` invariant + `removeAllBindings`
- [ ] Public serving via resolved public access (Cloudflare proxy + Cache-Tag purge)
- [ ] Delete lifecycle: soft-delete `deletedAt` → retention → purge (no dependents + refcount 0) → tombstone
- [ ] Single `FileVersion.status` sweeper (upload completion + lazy copy + purge, §16)
- [ ] Lazy copy as a pending-snapshot File (trigger: active binding or `preserveOnRevoke`; copies versions `>= fromVersion`; repoints bindings)
- [ ] `sourceFileId` provenance on File
- [ ] File audit events (upload, download, move, copy, share, revoke, delete, restore, lazy_copy, binding_repoint)
- [ ] "Shared with me" virtual view query

### Phase 2: Workflow Integration

Wire the file graph into app workflows — the SaaS differentiator.

- [ ] Avatar/logo/banner upload → ResourceBinding (replace URL columns)
- [ ] Cross-scope submit/adopt flow (personal → org/space draft → promote)
- [ ] Update `transferSpace` handler with grant cascade + per-dependent disposition (§15)
- [ ] Audit downstream models for transfer cascade gaps

### Phase 3: DX & Discovery

Make it easy to find, share, and manage files at scale.

- [ ] Search & filtering (filename/title/description, type, owner, scope)
- [ ] Time-limited shares (ArtifactPermission with expiresAt)
- [ ] Explicit org→space folder sharing UI
- [ ] Permission management UI (who has access, revoke)
- [ ] Version history UI (browse/restore previous versions — mechanism is core, §3.5.1)
- [ ] Metadata extraction pipeline (dimensions, duration, page count)
- [ ] Thumbnail/preview generation (derivatives as sibling files)

### Phase 4: Scale & Polish

Product surface that matters once there are many files and users.

- [ ] Size/quota enforcement (per-org, per-user)
- [ ] Content identity / checksums (SHA-256 on confirm)
- [ ] File browser UI component (split-pane, section 12.1)
- [ ] Multipart/resumable uploads (large files)
- [ ] Bulk operations (multi-select, bulk move/delete)
- [ ] Notifications (shared with you, submission accepted, quota warning)
- [ ] Folder move with permission-change preview (the access diff of §6)

---

## 14. Prior Art: Carde.io & Zealot

### Carde.io (organized-play-api + monorepo-v2)

**Two-tier image model** — `Image` + `ResourceImage`:
- `Image`: url, title, metadata, polymorphic ownership (`ownerType`/`ownerId`)
- `ResourceImage`: join to any resource with `imageType`, `order`, `attributions`, `css`, `conditions`
- One Image reused across multiple resources

**S3 presigned POST with conditions** (adopted):
- `createPresignedPost()` with content-length-range, exact key, content-type enforcement
- Object tagging for lifecycle management (no actor metadata — audit covers "who")
- **Notable TODO**: `"object ownership needs to be revisited"` — same problem we're solving

### Zealot (Backend)

**URL-only columns** (validates our approach):
- Scattered URL fields, no file model, no ownership tracking
- Shows what happens without proper file management

**NoopAssetsClient** (adopted):
- No-op implementation for testing without storage credentials

### What we adopted

| Pattern | Source | How we use it |
|---------|--------|--------------|
| Presigned POST with conditions | Carde S3 | Upload flow — bucket-level enforcement |
| S3 object tagging | Carde S3 | Lifecycle rules |
| ResourceImage (generalized) | Carde Prisma | ResourceBinding — usage layer |
| NoopAssetsClient | Zealot | NoopStorageClient for dev/testing |

---

## 15. Space Transfer Cascade Audit

Current handler (`apps/api/src/modules/inquiry/handlers/transferSpace/index.ts`) only updates `Space.organizationId`.

### Must update on transfer

| Model | Action | Rationale |
|-------|--------|-----------|
| **Space** | Update `organizationId` | Already done |
| **SpaceUser** | Update `organizationId` | Composite key includes orgId |
| **ArtifactPermission** (SpaceUser grantees) | Update `granteeOrganizationId` | The SpaceUser composite FK includes orgId |
| **ArtifactPermission** | Grant new org on the space root; delete old org's | New org admins manage; old org loses authority |
| **Token** (space-scoped) | Revoke | Old org's tokens shouldn't reach the new org's space |

### Must audit

| Model | Question | Risk if ignored |
|-------|----------|-----------------|
| **WebhookSubscription** | Survive transfer? | Old org gets events from new org's space |
| **CustomerRef** | Move with space? | Customers lose access or data leaks |
| **Inquiry** (pending) | Cancel on transfer? | Stale inquiries in wrong org context |

### Should NOT change

| Model | Rationale |
|-------|-----------|
| **AuditLog** | Historical — must reflect state at time of action |
| **Artifact owner FK** | Storage ownership is immutable — the original owner pays |

### Grant disposition — bindings follow the asset, permissions follow the authority

Cross-owner transfer is negotiated (same inquiry vehicle). Per dependent, the receiving owner picks:

| Disposition | Grant | Binding | Result |
|---|---|---|---|
| **maintain** | re-issued under new authority | keeps pointing at the transferred original | live sync, consensual |
| **sever** (default) | revoked | repointed to a lazy-copy snapshot (or nothing if `preserveOnRevoke: false`) | clean boundary, nothing 404s |

Default is sever — fail-closed for the tenant boundary, lazy copy as the net. Both compose from machinery already in this ticket (grant issue/revoke, binding repoint, lazy copy). The "N active dependents" list shown at transfer time falls out of the bidirectional graph (§2).

### Recommended implementation

```typescript
handleApprove: async (db, inquiry) => {
  const spaceId = inquiry.sourceSpaceId as SpaceId;
  const newOrgId = inquiry.targetOrganizationId as OrganizationId;

  await db.$transaction(async (tx) => {
    const space = await tx.space.findUniqueOrThrow({ where: { id: spaceId } });
    const oldOrgId = space.organizationId;

    await tx.space.update({ where: { id: spaceId }, data: { organizationId: newOrgId } });
    await tx.spaceUser.updateMany({ where: { spaceId }, data: { organizationId: newOrgId } });
    await tx.token.updateMany({ where: { spaceId, isActive: true }, data: { isActive: false } });

    await tx.artifactPermission.updateMany({
      where: { granteeModel: 'SpaceUser', granteeSpaceId: spaceId },
      data: { granteeOrganizationId: newOrgId },
    });
    const spaceRoot = await tx.artifact.findFirst({
      where: { system: true, kind: 'folder', ownerModel: 'Space', spaceId },
    });
    if (spaceRoot) {
      await tx.artifactPermission.create({
        data: {
          artifactId: spaceRoot.id,
          granteeModel: 'Organization', granteeOrganizationId: newOrgId,
          role: 'viewer',
        },
      });
      await tx.artifactPermission.deleteMany({
        where: {
          artifactId: spaceRoot.id,
          granteeModel: 'Organization', granteeOrganizationId: oldOrgId,
        },
      });
    }
  });
};
```

---

## 16. Orphan Sweeper Service

One idempotent sweeper reconciles the whole `FileVersion.status` pipeline against S3 — upload completion, lazy-copy snapshots, and purge — plus a bucket scan for stray objects. Since a `key` is not unique (reverts share keys), purge refcounts a key before deleting the object.

### What it sweeps

| Case | Detection | Action |
|------|-----------|--------|
| **Stale pending** | `FileVersion.status = pending`, older than 1h | HEAD → `active` if present, else `failed` |
| **Lazy-copy snapshot** | pending version on a File with `sourceFileId` | copy bytes from the source key → `active` |
| **Failed** | `status = failed`, older than 24h | if key refcount 0, delete object → tombstone version |
| **Purging** | `status = purging` | delete object (refcount 0) → HEAD-confirm gone → `purged` |
| **Soft-deleted past retention** | the file's `Artifact.deletedAt` older than retention, no dependents | mark active versions `purging` → sweep → tombstone the File |
| **No-DB-record object** | bucket scan: parse `fileVersionId` from key, no match | quarantine (tag) → delete after grace |

Deletion is always: delete object → HEAD-confirm gone → mark `purged`, idempotent on retry. Tombstoned File/FileVersion rows are kept, not hard-deleted; a far-future, refcount-gated GC reaps ancient tombstones. Right-to-be-forgotten uses the existing `redact` mechanism.

### Implementation sketch

```typescript
async function sweepVersions(db, storage) {
  // pending → active | failed
  for (const v of await db.fileVersion.findMany({ where: { status: 'pending', createdAt: { lt: oneHourAgo() } } })) {
    const present = await storage.headObject(v.key);
    await db.fileVersion.update({ where: { id: v.id }, data: { status: present ? 'active' : 'failed' } });
  }

  // purging → purged (refcount the key before deleting the object)
  for (const v of await db.fileVersion.findMany({ where: { status: 'purging' } })) {
    const refs = await db.fileVersion.count({ where: { key: v.key, status: { not: 'purged' }, id: { not: v.id } } });
    if (refs === 0) await storage.deleteObject(v.key);
    if (!(await storage.headObject(v.key))) await db.fileVersion.update({ where: { id: v.id }, data: { status: 'purged' } });
  }

  // soft-deleted past retention, no dependents → begin purge
  for (const f of await db.file.findMany({ where: { deletedAt: { lt: retentionCutoff() } } })) {
    if (await hasDependents(db, f.id)) continue;
    await db.fileVersion.updateMany({ where: { fileId: f.id, status: 'active' }, data: { status: 'purging' } });
  }
}
```

### Configuration

| Setting | Default | Notes |
|---------|---------|-------|
| Pending timeout | 1 hour | HEAD check after this |
| Failed cleanup | 24 hours | Delete after this |
| Soft-delete retention | TBD (30d? 90d?) | See open decisions |
| Object quarantine grace | 7 days | Bucket-scan strays |
| Sweep interval | Hourly | Cron |

---

## 17. Follow-Up Tickets

> **When Phase 1 is complete**, break these out into individual tickets. They're documented here
> so the design accounts for them, but none are blockers for the core file system.

### Manual reconnect on regrant

No automatic heal. When a snapshot in `__preserved/` has a `sourceFileId` the user can access again, offer a manual **reconnect**: repoint the binding(s) from the snapshot back to the live original, then discard the snapshot. Detection is an access check on `sourceFileId`; the mechanic is the existing binding-repoint. Deferred — break (keep the snapshot) is current behavior.

### History / provenance

### How the design got here (2026)

1. **Folder tree** (#72, first draft). `File` + `Folder` with a materialized `path`, a `FilePermission` with a `public` sentinel, "most specific wins", and `FolderVisibility` for admin-hidden folders.
2. **Artifact + containers.** One `Artifact` node with a `kind`; a folder is a container kind, `ArtifactContainer` is the edge, and `ArtifactPermission` grants targets artifacts only. Access became the node's own column plus grants, resolved as a union over containers (`private` takes nothing from them). `FolderVisibility` was dropped for one visibility system.
3. **Multi-parent within one owner.** An item may sit in several containers ("compliance" under both "legal" and "operations"), but every container edge stays within one owner, so the container graph never crosses a billing and tenancy boundary.
4. **Owner root.** Every owner gets a root container that takes back anything losing its last container: no orphan state. Containment organises; grants give access.
5. **Ownership transfer as an Inquiry** (next). Changing who owns an artifact is a request between parties, approved or auto-approved like any other Inquiry, and never a side effect of moving it.

### Prior art, and where we differ

**Anti-orphaning.**
- **Unix hard links.** A file (inode) can have several names (directory entries). It keeps a link count and is freed only when the last name goes and nothing holds it open (POSIX `link`/`unlink`). Ours is the same refcount idea with a guaranteed home: the owner root means the last placement leaving never frees anything; deleting is always explicit. *(General knowledge; not separately cited.)*
- **Gmail labels and All Mail.** A message can carry many labels; removing them all leaves it in All Mail, and only deleting it removes it ([UC Santa Barbara guide](https://connect.ucsb.edu/training-support/connect-user-guides/google-workspace-email/using-archive-rather-delete), [University of Alaska KB](https://service.alaska.edu/TDClient/36/Portal/KB/Article/239/Gmail-Labels-Are-Different-From-Folders)). All Mail is our owner root. *(Third-party help pages; Google's own article not found.)*
- **Google Drive's multi-parent era.** Drive let an item sit in several folders. When a shared folder's owner deleted it, files the user owned were left with no folder: still taking storage, invisible in My Drive, findable only with the `is:unorganized owner:me` search ([UW–Madison KB](https://kb.wisc.edu/googleapps/138027), [BetterCloud](https://www.bettercloud.com/monitor/the-academy/find-rehome-orphaned-files-google-drive/), [How-To Geek](https://www.howtogeek.com/747579/how-to-remove-orphaned-files-taking-up-space-in-google-drive/)). In March 2020 Google announced that from **30 September 2020** every item would have exactly one location, with shortcuts for the rest ([Google Workspace blog, "Simplifying Google Drive's folder structure and sharing models"](https://workspace.google.com/blog/product-announcements/simplifying-google-drives-folder-structure-and-sharing-models)). It then migrated existing multi-location items to shortcuts, a migration moved from 2021 to 2022 ([Workspace Updates, Dec 2021](https://workspaceupdates.googleblog.com/2021/12/timeline-update-for-migration-of-multi-location-drive-files.html), [Google admin help](https://support.google.com/a/answer/10686746)). The difference: in Drive, placement was tangled with ownership and sharing, since where a file sat decided who could reach it and who owned it. Here placement, grants and ownership are three separate records, so we keep multiple placements and fix orphaning with the owner root rather than giving multiple placements up. *(The causal reading, "because placement and ownership were tangled", is our interpretation; Google's post gives its reasons as simplifying the folder and sharing models.)*

**Anti-rug-pull.**
- **Figma libraries.** Deleting or unpublishing a main component does not immediately break its instances in other files; they keep rendering and can be detached or repaired. *(Community-forum sourced, e.g. [Figma forum](https://forum.figma.com/t/how-do-i-remove-a-shared-component-whose-original-component-is-deleted/668); no official Figma article found: unverified as documented behaviour.)*
- **npm after left-pad.** In March 2016 a package many builds depended on (left-pad) was unpublished and broke them. npm then restricted unpublishing: a package could only be removed within 24 hours of publishing, and older packages with dependents were protected ([InfoQ](https://www.infoq.com/news/2016/03/npm-package-removal-policy), [ADTmag](https://adtmag.com/articles/2016/03/30/npm-policy-changes.aspx), [Wikipedia: npm](https://en.wikipedia.org/wiki/Npm)). The current window is reported as 72 hours with no public dependents; unverified against npm's own docs.
- **Where we differ.** Each of these protects one product's one kind of dependency, and npm does it by refusing the removal. Ours is a general primitive for any use: any `ResourceBinding`, on any artifact kind, survives the source's owner revoking access or deleting it, by repointing to a copy the user owns (lazy copy, §6). The owner keeps the right to withdraw.

---

## Reference-Safe Delete

A file with active ResourceBindings or ArtifactPermission shares should not be hard-deletable without explicit override. Options:
- **Block delete** — "This file is used as a logo on 2 resources and shared with 3 users. Remove bindings first."
- **Cascade warning** — show what breaks, require confirmation
- **Soft delete only** — hard delete is always deferred to orphan sweeper after bindings are cleaned up

This interacts with the trash/restore UX below.

### Trash & Restore UX

`deletedAt` exists but needs a user-facing experience:
- Virtual "Trash" folder per scope (org, space, personal)
- Browse and restore soft-deleted files within retention window
- Auto-purge after retention period (handled by orphan sweeper, section 16)
- Admin override: "empty trash now" for storage reclamation
- Legal/admin hold: prevent auto-purge on specific files

### Multipart & Resumable Uploads

Presigned POST works for files up to ~5GB but has no resume support. For large uploads:
- S3 multipart upload (parts uploaded independently, assembled server-side)
- Resumable — client can retry individual parts without restarting
- Progress tracking per-part
- Likely needs a `FileUploadPart` tracking table or stateless part verification via ETag

### Content Identity (Checksums)

SHA-256 hash computed on upload confirmation:
- **Integrity** — verify S3 bytes match what the client sent
- **Dedup detection** — "This file already exists in this folder" (advisory, not enforced)
- **Copy verification** — cross-scope copy can verify source and destination match
- Store as `File.checksum` (nullable, computed async on confirm)

### Preview & Derivative Pipeline

Thumbnails, image resizes, PDF page previews, video thumbnails, maybe OCR later. These are sibling files, not overloaded into the base File record:
- Derivative linked to source File (`derivativeOf` FK or a `FileDerivative` join)
- Generated async after upload confirmation
- Stored in the same bucket under its own flat key; linked to the source File in Postgres
- System-managed, not user-editable

### Name Collision Rules

Two files named `report.pdf` in the same folder — policy options:
- **Auto-rename** — `report (1).pdf` (Google Drive pattern)
- **Block** — "A file with this name already exists" (strict uniqueness)
- **Allow** — files are identified by id, not name (filename is display-only)

Recommendation: allow in v1 (filenames are display-only, ids are canonical), add optional uniqueness enforcement later if users find it confusing.

### Folder Move Constraints

Cycle prevention and the depth cap (10) are built (§5). Still open:
- **Permission recalculation** — moving into a shared container grants its audience to every `inherit` artifact below; moving out may revoke. The UI should show the access diff (§6) before a move.

### Search & Indexing

Filename/title/description full-text search via Postgres `tsvector`:
- Filter by content type, uploader, date range, scope (org/space/personal)
- Container scoping (search within a container's subtree, `listArtifactDescendants`)
- Results respect access control (only return files the user can see)
- Consider: should search hit S3 metadata or just DB fields?

### Audit Events

File-specific event types for the existing AuditLog system:

| Event | Data |
|-------|------|
| `file.upload_requested` | fileId, folderId, contentType, size |
| `file.upload_confirmed` | fileId |
| `file.downloaded` | fileId, userId |
| `file.moved` | fileId, oldPath, newPath |
| `file.copied` | sourceFileId, newFileId, reason (cross-scope adopt) |
| `file.shared` | fileId, granteeId, granteeModel, role |
| `file.unshared` | fileId, granteeId |
| `file.deleted` | fileId (soft) |
| `file.restored` | fileId |
| `file.hard_deleted` | fileId (permanent, by sweeper or admin) |
| `file.publicized` | fileId, bindingId |
| `file.unpublicized` | fileId, bindingId |
| `file.lazy_copied` | sourceFileId, newFileId, reason, dependentId |
| `file.binding_repointed` | bindingId, oldFileId, newFileId, reason |

### Public URL Invalidation

When a file stops resolving public (its own `access` changes, or its last public container goes):
- Cloudflare Cache-Tag purge on `file-{fileId}` — immediate (< 300ms global propagation)
- Presigned GET URLs expire naturally (15 min TTL)
- The stable public URL (`/public/files/:id`) starts returning 404 immediately after access changes
- Edge case: if Cloudflare hasn't purged yet, stale content may be served briefly. Acceptable for most cases; for sensitive content, consider `Cache-Control: no-store`.

### Webhooks (built)

Artifact is a webhook model. A change to an `ArtifactPermission` or `ArtifactContainer` row fires an **Artifact** `update` event for the parent artifact — the grant's artifact, and both ends of an edge — through `webhookRelatedModels` (direct-model refs; the CustomerRef party refs stay unread until AUTH-006). The audience is the artifact's owner and every party granted access to it, through containers too (`artifactWebhookAudience`), plus the grantee named by a changed grant, so a revoked grantee hears its revocation. Nobody else. The event names the node; receivers fan out to its descendants themselves (a container's change reaches its `inherit` members only through that fan-out). Delivery is lossy (bounded retries, auto-disable after 5 failures, poisoning on repeated 400/422), so a receiver that indexes artifacts also reconciles. Builds on the AUTH-006 stopgap (template #201).

### Edge-level access (deferred)

An edge has no access of its own in this cut. A per-edge setting (the same post public in one channel, private in another) is the noted extension; it would be a column on `ArtifactContainer` read by `resolveArtifactAccess` where it walks a container.

### Org subscriptions hearing their spaces (follow-up)

An organization-level webhook subscription should be able to hear its spaces' artifacts: all spaces, a list, or none — a setting on the webhook subscription. Today a space-owned artifact reaches only the space's (and grantees') subscriptions. Owners-only content (org-user folders) reaches no org-level subscription.

### Integration grantee presenting path (later)

`Integration` grantees exist in the schema but no request presents as one yet.

### Quota & Accounting

Storage billing questions that need answers before pricing:
- Do cross-scope copies count toward both the source and destination owner's quota?
- Do derivatives (thumbnails, previews) count toward quota?
- Who pays for shared files? The storage owner (uploader's scope), not the viewer.
- Quota enforcement point: at presign time (reject before upload) or at confirm time (reject after)?
- Recommendation: enforce at presign (fail fast), with a grace buffer for in-flight uploads.

---

## 18. Design Review Addendum

Fully absorbed into §3 and its ripples: false-poly ownership (§3.1), flat immutable keys (§4), the FileVersion lifecycle and single sweeper (§3.5.1, §16), the binding registry and UI upload limits (§3.6, §7), transfer disposition (§15), and BigInt/storage-adapter notes (§11). Section retired.

---

## Reference

- S3 type stubs: `apps/api/src/types/optionalDeps.d.ts`
- Transfer handler: `apps/api/src/modules/inquiry/handlers/transferSpace/index.ts`
- Permissions client: `packages/permissions/src/client.ts`
- Carde Image model: `~/Carde.io/organized-play-api/src/db/postgres/prisma/models/Image.part.prisma`
- Carde ResourceImage: `~/Carde.io/organized-play-api/src/db/postgres/prisma/models/ResourceImage.part.prisma`
- Carde S3 presign: `~/Carde.io/organized-play-api/src/app/manage/inquiries/services/s3objects.ts`
- Zealot NoopClient: `~/Desktop/UserEvidence/Zealot-Backend/src/plugins/assets/NoopAssetsClient.ts`
