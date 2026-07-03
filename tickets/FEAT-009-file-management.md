# FEAT-009: File Management System

**Status**: Planning
**Priority**: High
**Created**: 2026-02-06
**Updated**: 2026-07-02 (reconciled §3.5–§18 to the §3 model — flat immutable keys, FileVersion lifecycle, no FileJob; §18 retired)
**Dependencies**: Railway Buckets, Space Transfer (inquiry system)

---

## 1. Overview

File upload, storage, access control, sharing, and resource binding for the template. Two Railway Buckets (system + user), S3-compatible, private-only. Ownership, access, and usage are separate concerns managed at the application layer.

**Design principles:**
- **This is not a filesystem.** It's usage tooling + permission boundaries for SaaS workflows. Upload, bind, share, serve — the storage mechanics should stay out of the way.
- Usage layer (ResourceBinding) and permission boundaries (scope/share model) are the SaaS core. Everything else should feel effortless.
- Users are first-class owners alongside orgs and spaces — personal files exist independent of any org
- Three-layer separation: storage (File/Folder) → access (FilePermission) → usage (ResourceBinding)
- Two kinds of ownership: storage (immutable, who pays) vs access (mutable, who manages)
- Materialized paths for hierarchy — no recursive queries
- Within-scope = move (same File, update `path` only — keys never change); cross-scope = copy (new File, new owner)
- Org/space owners and admins get implicit broad access via ReBAC; everyone else needs explicit ABAC
- Access is mutable (permission records with roles, expiry, inheritance via path)
- Public read is the `public` grant on FilePermission (access layer), inherited via folders like any permission
- System folders provide scaffolding; user folders provide flexibility
- De-emphasize elaborate folder features and power-user file browser UX in favor of strong workflow integration

> **NOTE: Model names are provisional.** Names like `ResourceBinding`, system folder names,
> etc. may change during implementation. The layer separation and patterns are the core decisions.

---

## 2. Architecture — Three Layers

| Layer | Concern | Model(s) | Answers |
|-------|---------|----------|---------|
| **Storage** | What's in the bucket | `File`, `FileVersion`, `Folder` | Where is it? Which version is current? Who owns it? |
| **Access** | Who can see/download/manage (internal) | `FilePermission` | Who has what role? When does it expire? Does it inherit? |
| **Usage** | What role a file plays on a resource | `ResourceBinding` | What role does this file play, and how is it rendered? |

Why three layers:
- **One model** breaks when access needs to vary per-user or expire
- **Two models** (file + permission) breaks when the same file is used as a logo AND an attachment — usage varies per binding, independent of the file
- **Three models** keeps each concern clean and independently queryable

**Public is a file-level grant, like Google Drive:** "public" is the `public` viewer permission on the file (§3.3), inherited via folders — not a per-usage property. A file's bytes have one access state; bindings only describe *where* it is used.

**Intent — bidirectional visibility is the whole point:**

Most SaaS apps treat files as write-once blobs. You upload, get a URL string, paste it into a column, and forget about it. The file and its usages are completely disconnected — the URL *is* the binding, and URLs don't know who's pointing at them. This leads to silent orphans (files nobody uses but nobody can safely delete), broken references (someone deletes a file and three pages lose their banner), and zero visibility in either direction ("what is this file doing?" / "where did this logo come from?").

This system is designed so that **every file knows what it's doing, and every usage knows where it comes from.** File → ResourceBinding gives you "this image is used as a logo on 2 spaces, an attachment on 3 inquiries, and shared with 4 users." ResourceBinding → File gives you "the banner on this space is owned by org Z and has 3 other usages elsewhere." This bidirectional graph is what makes delete safety, lazy copy, access revocation, and lifecycle management possible — you can't orphan silently because the system knows every reference.

**When writing code against this system:** never store a raw URL string to reference a file. Always go through ResourceBinding. If something displays a file, there should be a binding. If there's no binding, the file isn't in use and can be safely cleaned up. This invariant is what keeps the graph complete. The one exception is URL-only bindings (external assets not managed in our storage) — these still go through ResourceBinding, they just don't have a File record behind them.

---

## 3. Data Model

### 3.1 File (container)

File holds identity, ownership, folder position, and name. The bytes live on FileVersion.

Ownership is false polymorphism (§18.1): `ownerModel` names the owner, with exactly one FK set.

```prisma
model File {
  id             String @id @default(uuid())

  ownerModel     FileOwnerModel        // User | Organization | Space
  userId         String? @db.VarChar(36)
  organizationId String? @db.VarChar(36)
  spaceId        String? @db.VarChar(36)

  folderId       String?
  path           String

  filename       String

  sourceFileId   String?               // set when this File is a lazy-copy snapshot

  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt
  deletedAt      DateTime?

  versions       FileVersion[]
  permissions    FilePermission[]
  bindings       ResourceBinding[]
}
```

### 3.1.1 FileVersion (content)

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

### 3.2 Folder (Storage Layer)

A folder is a tree node; ownership is false polymorphism (§18.1), same as File.

`path` is the materialized ancestor chain, and it exists **for permission checks**: a FilePermission on a folder applies to everything beneath it, so resolving access on a file walks `[file] + the folders in its path` up to the scope root in one query (`WHERE (targetId, targetModel) IN (...) ORDER BY specificity DESC LIMIT 1`, most-specific wins). File carries the same denormalized `path`, so the check is join-free. Moving a folder rewrites its descendants' paths — a DB update, no S3.

`visibility: "private"` is the owner-only scope: listed only for the owning member, hidden from admins in normal browse. Admins still resolve access via ReBAC, through a deliberate, audited governance view.

```prisma
model Folder {
  id             String @id @default(uuid())

  ownerModel     FileOwnerModel        // User | Organization | Space
  userId         String? @db.VarChar(36)
  organizationId String? @db.VarChar(36)
  spaceId        String? @db.VarChar(36)

  parentId       String?
  path           String
  name           String

  system         Boolean @default(false)      // auto-created scaffolding, undeletable
  visibility     String  @default("visible")  // visible | private
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt

  deletedAt      DateTime?

  parent         Folder?  @relation("FolderTree", fields: [parentId], references: [id])
  children       Folder[] @relation("FolderTree")
  files          File[]
  permissions    FilePermission[]
}
```

### 3.3 FilePermission (Access Layer — ABAC)

An explicit grant of a `role` on a File or Folder to a principal. Two false-poly axes, both real FKs (§18.1): the **target** (File | Folder) and the **grantee** (User | Organization | Space | OrgUser | SpaceUser | CustomerRef — models, PascalCase — plus the lowercase `public` sentinel: no FK, capped at `viewer`). A grant on a **Folder** inherits to everything beneath it, resolved by the path-ancestor walk (§3.2). `role = owner` here is *access* ownership (mutable management authority), distinct from `File.ownerModel` (immutable storage ownership).

```prisma
model FilePermission {
  id               String @id @default(uuid())

  targetModel      FilePermissionTarget     // File | Folder
  fileId           String? @db.VarChar(36)
  folderId         String? @db.VarChar(36)

  granteeModel     FilePermissionGrantee    // User | Organization | Space | OrgUser | SpaceUser | CustomerRef | public
  userId           String? @db.VarChar(36)
  organizationId   String? @db.VarChar(36)
  spaceId          String? @db.VarChar(36)
  orgUserId        String? @db.VarChar(36)
  spaceUserId      String? @db.VarChar(36)
  customerRefId    String? @db.VarChar(36)

  role             Role
  fromVersion      Int      @default(1)      // floor: this version and every later one
  preserveOnRevoke Boolean  @default(false)  // opt-in copy-on-revoke; an active binding forces it regardless

  expiresAt        DateTime?
  createdAt        DateTime @default(now())
  updatedAt        DateTime @updatedAt
}
```

Uniqueness (one grant per target × grantee) rides the Contact partial-index false-poly pattern. **Revoke = delete the row** — expiry (`expiresAt`) and revocation both just remove access; who/when is the audit log's job, so there is no `revokedAt`/`revokedBy`. On revoke, lazy copy fires when the grantee has an active ResourceBinding **or** `preserveOnRevoke = true`, duplicating every version `>= fromVersion`.

### 3.4 ResourceBinding (Usage Layer)

What role a File — or an external URL — plays on a resource (logo, avatar, …). Two false-poly axes: the **source** (`File | url`; `File` is a real FK, `url` a sentinel) and the **resource** it is bound to (real FK per arm, fork-extensible — the email builder adds `EmailTemplate`/`EmailComponent`, inixiative adds `Event`). `bindingType` is a registry key, not a DB enum, so types extend per fork. No access lives here — public read is the `public` grant (§3.3); a `requiresPublic` type presupposes it (enforced, below).

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

**`requiresPublic` is a validated invariant** (a `requiresPublic` binding implies its file carries the `public` grant), checked both ways: creating such a binding **requires** the `public` grant already exists; removing the `public` grant is **blocked** while any `requiresPublic` binding references the file. A **`removeAllBindings(file)`** call clears the dependencies so `public` can then be revoked.

**Upload limits:** none enforced server-side on pure files. The UI validates size/type for files with a planned purpose (it knows the intended binding). The one server invariant is `accepts`, checked at *bind* time.

### 3.5 How the layers interact

- **Upload** — create File + FileVersion(`pending`), presign POST, client uploads, confirm HEAD-verifies, FileVersion → `active`. Uploading into a space/org folder adds a Space/Org `viewer` grant; ReBAC covers owners/admins.
- **Download** — resolve access (ReBAC membership chain → FilePermission ABAC, §6), presign GET the current version's key.
- **Bind** — create a ResourceBinding (§3.4); a `requiresPublic` type presupposes the file's `public` grant.
- **Public serve** — a `public` viewer grant on the file, directly or via a folder ancestor, serves through the CDN proxy with no auth (§8).
- **Lazy copy** — an active binding or `preserveOnRevoke = true` snapshots the File into the owner's `__preserved/` folder when access is lost (§6); no job table — the snapshot's versions sit `pending` and serve from the source key until the sweeper copies bytes.

---

## 4. Bucket Architecture

### Two buckets (per environment)

| Bucket | Purpose | Contents |
|--------|---------|----------|
| **system** | Platform assets — default avatars, email templates, branding | Fixed platform keys |
| **user** | All user/org/space uploads | Flat: `{fileVersionId}-{filename}` at the root |

Railway auto-provisions per environment: 2 buckets × N environments.

**Keys are immutable and flat.** A `user`-bucket key is `{fileVersionId}-{filename}` at the bucket root — no owner/space/folder prefix. The folder tree and ownership live only in Postgres (`Folder` + `File.path` + `File.ownerModel`). Moves and renames are pure DB row updates; nothing ever re-keys S3. One version = one key; a revert reuses a prior version's key (§3.1.1). Cross-owner adoption stays copy → new File → new FileVersion → new key.

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

## 5. Materialized Path & Traversal

`File.path` / `Folder.path` are the materialized folder-ancestor chain (§3.2) — a DB concern only; the S3 key carries no path. They drive permission inheritance and subtree listing without recursion.

### Path queries

```sql
-- Subtree (recursive descendants)
WHERE path LIKE '{folderPath}/%'
-- Direct children only
WHERE path LIKE '{folderPath}/%' AND depth = {n}
-- Move a folder: pure DB rewrite of descendant paths, no S3
UPDATE "Folder" SET path = REPLACE(path, '{oldPath}', '{newPath}') WHERE path LIKE '{oldPath}%';
UPDATE "File"   SET path = REPLACE(path, '{oldPath}', '{newPath}') WHERE path LIKE '{oldPath}%';
```

### Traversal helpers

```typescript
getAncestors(path)                   // split path into ancestor segments
getDescendantsQuery(path)            // LIKE prefix query
getBreadcrumb(path)                  // parse path + batch lookup
moveFolder(folderId, newParentId)    // rewrite path + descendants (DB only)
validateNoCircular(folderId, targetId)
```

---

## 6. Access Control

### Resolution (internal)

```
Can user X do action A on file Y?

1. Relationship (else 404 — prevents id probing):
   - X resolves to the file's owner (ownerModel), or
   - X is a member of the owning Organization/Space, or
   - X (or an org/space/orgUser/... it maps to) has a FilePermission on Y
     or an ancestor folder.
2. Authorization (first match):
   a. ReBAC — X is owner/admin of the owning org or space → broad manage access.
   b. ABAC — a FilePermission on Y or an ancestor folder (§3.2 path walk)
      grants a role sufficient for A.
```

A direct FilePermission share passes the boundary *and* authorizes in one check — no membership required.

**ReBAC inheritance:** org/space `owner`/`admin` get implicit broad access to every file their org/space owns — no FilePermission row. Regular `member`/`viewer` see only what a FilePermission grants (directly or by folder inheritance) — this prevents the over-grant where every member can reach every file.

**Sharing is explicit.** Org-owned files are not auto-visible to a space; grant a FilePermission on the org folder (`granteeModel: Space`, `folderId` set) and it inherits to descendants. Same mechanism for user→user, org→user, space→user.

### Public

A file is public iff it carries a `public` viewer grant (§3.3), directly or via a folder ancestor. Public serving (§8) checks only for that grant — never a ResourceBinding. FilePermission is the sole access layer; `public` is just its open sentinel, capped at `viewer`.

### Access scenarios

| Scenario | FilePermission | ResourceBinding |
|----------|----------------|-----------------|
| User uploads to Space | User (owner) + Space (viewer) | — |
| User uploads personal file | User (owner) | — |
| Customer submits to Space | CustomerRef (viewer) | attachment |
| Set as org logo | `public` (viewer) grant | logo |
| Set as internal attachment | — | attachment |
| Admin shares org folder to Space | Space grant on folder | — |
| Admin shares to specific User | User grant on file/folder | — |
| Time-limited share link | grant with `expiresAt` | — |

Org/space owners/admins need no FilePermission row (ReBAC). Only regular members and cross-scope sharing do.

### Boundary crossing — within-scope = move, cross-scope = copy

| Operation | Same owner? | Effect |
|-----------|-------------|--------|
| Move between folders in one scope | yes | DB `path` update; no S3 |
| Submit personal file to org/space | no | temporary FilePermission grant; no copy |
| Org/space adopts a submission | no | copy bytes → new File (new owner, new key); original stays |
| Share org folder with a space | same org | FilePermission grant; no copy |

Cross-owner is always copy, never move: ownership = billing boundary, and the original stays for audit/rollback.

**Space transfer** (§15), **user leaves org**, **space soft-delete**: ownership FKs never change; grants are re-issued or deleted per the transfer disposition; org-scoped files stay with the org; the user's own (`ownerModel: User`) files are untouched. Soft-delete sets `File.deletedAt`; S3 bytes wait for the retention sweeper (§16).

### Lazy copy (copy-on-revoke)

Grantees can build on a file they don't own (bind it, depend on it). Revoking access shouldn't silently break those dependents — so when access is lost, they get a frozen snapshot.

**Fires** when a FilePermission is revoked or expired, or the source File is soft-deleted, *and* the grantee is a dependent:
- an **active ResourceBinding** points at the file (automatic), or
- the grantee's FilePermission has **`preserveOnRevoke = true`** (opt-in).

**The snapshot** is a new File owned by the dependent, in their `__preserved/` folder, `sourceFileId` set for provenance. It copies every version `>= fromVersion`; those FileVersions start `pending` and serve from the source key until the sweeper (§16) copies bytes, then go `active`. No job table. The dependent's bindings repoint to the snapshot. Who triggered it is the audit log's job — no snapshot actor fields on File.

**`__preserved/`** is a per-scope `system` folder (`visibility: visible`) — a landing zone, not a jail; users can move copies out.

**No auto-heal.** If access is later re-granted, the user keeps both the snapshot and renewed live access; manual reconnect is a deferred follow-up (§17).

### "Shared with me" virtual view

A query over FilePermission where the user is grantee (active, unexpired): shared folders browse naturally; individually-shared files show as a flat list. Items are role-limited by the grant. `__preserved/` copies are real owned files and also appear in normal browsing.

---

## 7. Upload Flow (Presigned POST)

### Why presigned POST

`createPresignedPost` pins the exact key + content-type at the bucket level (an extracted URL can't be abused); the browser uploads straight to the bucket with no API memory pressure.

### Sequence

```
1. Client → POST /files/presign { filename, contentType, folderId? }
   permix check for upload in the target scope.
2. API creates File + FileVersion(status: "pending", key = {fileVersionId}-{filename}),
   a FilePermission(owner) for the uploader, and — into a space/org folder —
   a Space/Org viewer grant.
3. API returns a presigned POST (short TTL) with exact-key + content-type conditions.
4. Client → Bucket: POST directly.
5. Client → POST /files/:id/confirm → API HEADs the object, FileVersion → "active".
```

Status lives on FileVersion; the File is current at its highest `active` version. No server-side size/type limit on pure files (§3.4) — the UI validates for planned-purpose uploads, and `accepts` is enforced at bind time. Who uploaded it is the audit log's job — no uploader field, no S3 user metadata. Stale `pending` and failed versions are reconciled by the sweeper (§16).

---

## 8. Download & Public Serving

### Internal downloads

```
GET /files/:id/download
1. Load File → resolve the current version's key.
2. Check access (ReBAC → ABAC, §6).
3. Presign GET (TTL ~15 min) → 302 or { url, expiresAt }.
```

### Public serving via Cloudflare

A file is publicly served iff it carries a `public` viewer grant (§6), directly or via a folder ancestor — never via a ResourceBinding.

```
Client → yourapp.com/public/files/:id
  → Cloudflare CDN (cache hit → serve)
  → miss: API confirms the `public` grant → presign GET → stream with cache headers

Cache-Control: public, max-age=86400
Cache-Tag: file-{fileId}
ETag: from bucket response
```

Stable URLs that don't expire; global edge cache; purge by `Cache-Tag` when the grant is removed or the current version changes. No auth check — the `public` grant is the authorization.

---

## 9. Permission Model (permix integration)

### New permix resource

```typescript
const FileAction = { ...StandardAction } as const;
// Inherits: read, operate, manage, own
```

| Org/Space Role | read | operate (upload) | manage | own |
|----------------|------|-----------------|--------|-----|
| viewer | via FilePermission | no | no | no |
| member | via FilePermission | yes | own files | no |
| admin | all in org/space | yes | all in scope | no |
| owner | all | yes | all | yes |

### FilePermission roles (ABAC layer)

| FilePermission role | Allows |
|---------------------|--------|
| `viewer` | See metadata, download content |
| `member` | Viewer + upload into folder, basic operations |
| `admin` | Member + rename, move, delete, share, manage permissions |
| `owner` | Admin + grant/revoke access ownership, permanent delete |

This is the existing `Role` enum — one vocabulary across the system. The `public` grantee sentinel (§3.3) is capped at `viewer`.

**Org/space owners/admins don't need FilePermission records** — they get implicit
broad access via ReBAC inheritance (§6). A FilePermission `role = owner` is
*access* ownership (management authority) on a specific file/folder, distinct from
`File.ownerModel` storage ownership.

---

## 10. System Folder Auto-Creation

Hooks auto-create `system` folders (undeletable, unrenameable) as scopes come into being:

| Event | Folder | Owner | visibility | Grant |
|-------|--------|-------|------------|-------|
| Organization created | org root | Organization | visible | — |
| Space created | space root | Space | visible | — |
| OrgUser created | `org_user` | Organization | **private** | membership-scoped grant to the user |
| User created | user root | User | visible | — |
| First lazy copy in a scope | `__preserved/` | scope owner | visible | — |

The `org_user` folder is owned by the Org (bytes stay with the org when the user leaves) but scoped private to the member: `visibility: private` lists it only for that member and hides it from admins in normal browse — admins still reach it via ReBAC through a deliberate, audited governance view (§3.2). Other `__` system folder names remain TBD.

---

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
│   ├── filePermissionCreate.ts     — POST /files/:id/permissions
│   ├── filePermissionDelete.ts     — DELETE /files/:id/permissions/:permId
│   └── filePublicDownload.ts       — GET /public/files/:id (served on the `public` grant, §8)
├── controllers/
├── validations/
├── services/
│   ├── s3Client.ts                 — configured S3 clients (system + user buckets)
│   ├── presign.ts                  — presigned POST URL generation
│   ├── accessCheck.ts              — ABAC permission resolution + path inheritance
│   └── pathBuilder.ts              — materialized path computation + traversal
└── tests/

apps/api/src/modules/folder/
├── routes/
│   ├── folderCreate.ts             — POST /folders
│   ├── folderRead.ts               — GET /folders/:id
│   ├── folderReadMany.ts           — GET /folders
│   ├── folderUpdate.ts             — PATCH /folders/:id (rename, system=false only)
│   ├── folderMove.ts               — POST /folders/:id/move (reparent + path update)
│   └── folderDelete.ts             — DELETE /folders/:id (system=false only)
├── controllers/
├── validations/
├── services/
│   └── folderTree.ts               — traversal helpers, cycle detection, system folder creation
└── tests/
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
- [ ] **Max folder depth** — unbounded? Or cap at N levels?
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

- [ ] Prisma models (File, FileVersion, Folder, FilePermission, ResourceBinding)
- [ ] Storage adapter wiring (system + user buckets, flat keys) + NoopStorageClient via `makeAdapterRouter`
- [ ] FileVersion lifecycle: `pending → active → purging → purged | failed`; current = highest `active`; revert = new version reusing a prior key (refcounted)
- [ ] Materialized path builder + traversal helpers (DB-only moves)
- [ ] System folder auto-creation hooks (org, space, org_user private, user, `__preserved/`)
- [ ] Presigned POST upload + confirm (HEAD-verify) flow
- [ ] Download + access resolution (ReBAC → ABAC via path walk)
- [ ] FilePermission (false-poly grantee incl. `public` sentinel; `Role` enum; `fromVersion`, `preserveOnRevoke` default false)
- [ ] File + Folder module routes; permix `FileAction`
- [ ] Init script: Railway Bucket setup (2 buckets)
- [ ] Cross-owner copy vs within-scope move (move = DB `path` update; cross = copy → new File → new key)
- [ ] Duplicate/collision handling (policy: allow same name, ids are canonical)
- [ ] ResourceBinding + binding registry (logo/avatar); `requiresPublic` invariant + `removeAllBindings`
- [ ] Public serving via the `public` grant (Cloudflare proxy + Cache-Tag purge)
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
- [ ] Time-limited share links (FilePermission with expiresAt)
- [ ] Explicit org→space folder sharing UI
- [ ] Permission management UI (who has access, revoke)
- [ ] Version history UI (browse/restore previous versions — mechanism is core, §3.1.1)
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
- [ ] Folder move with full descendant path update + permission recalculation

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
| **FilePermission** | Grant new org on the space folder; delete old org's | New org admins manage; old org loses authority |
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
| **File owner FK** | Storage ownership is immutable — the original owner pays |

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

    const spaceFolder = await tx.folder.findFirst({
      where: { system: true, ownerModel: 'Space', spaceId },
    });
    if (spaceFolder) {
      // One folder-level grant inherits to all descendants
      await tx.filePermission.create({
        data: {
          targetModel: 'Folder', folderId: spaceFolder.id,
          granteeModel: 'Organization', organizationId: newOrgId,
          role: 'viewer',
        },
      });
      // Revoke = delete the old org's grant (audit records who/when)
      await tx.filePermission.deleteMany({
        where: {
          targetModel: 'Folder', folderId: spaceFolder.id,
          granteeModel: 'Organization', organizationId: oldOrgId,
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
| **Soft-deleted past retention** | `File.deletedAt` older than retention, no dependents | mark active versions `purging` → sweep → tombstone the File |
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

### Reference-Safe Delete

A file with active ResourceBindings or FilePermission shares should not be hard-deletable without explicit override. Options:
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

Beyond cycle prevention (already in traversal helpers):
- **Max depth** — enforce a cap (e.g., 10 levels) to prevent pathological nesting
- **Permission recalculation** — moving a folder into a shared parent may grant new users access; moving out may revoke. UI should warn about permission changes on move.
- **Move into shared folder** — if dest folder has Space/User FilePermissions, do moved files inherit? Yes (by path inheritance), but the UI should surface this.

### Search & Indexing

Filename/title/description full-text search via Postgres `tsvector`:
- Filter by content type, uploader, date range, scope (org/space/personal)
- Path-based scoping (search within a folder subtree)
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

When the `public` grant is removed from a file:
- Cloudflare Cache-Tag purge on `file-{fileId}` — immediate (< 300ms global propagation)
- Presigned GET URLs expire naturally (15 min TTL)
- The stable public URL (`/public/files/:id`) starts returning 404 immediately after the grant is revoked
- Edge case: if Cloudflare hasn't purged yet, stale content may be served briefly. Acceptable for most cases; for sensitive content, consider `Cache-Control: no-store`.

### Quota & Accounting

Storage billing questions that need answers before pricing:
- Do cross-scope copies count toward both the source and destination owner's quota?
- Do derivatives (thumbnails, previews) count toward quota?
- Who pays for shared files? The storage owner (uploader's scope), not the viewer.
- Quota enforcement point: at presign time (reject before upload) or at confirm time (reject after)?
- Recommendation: enforce at presign (fail fast), with a grace buffer for in-flight uploads.

---

## 18. Design Review Addendum

Fully absorbed into §3 and its ripples: false-poly ownership (§3.1), flat immutable keys (§4), the FileVersion lifecycle and single sweeper (§3.1.1, §16), the binding registry and UI upload limits (§3.4, §7), transfer disposition (§15), and BigInt/storage-adapter notes (§11). Section retired.

---

## Reference

- S3 type stubs: `apps/api/src/types/optionalDeps.d.ts`
- Transfer handler: `apps/api/src/modules/inquiry/handlers/transferSpace/index.ts`
- Permissions client: `packages/permissions/src/client.ts`
- Carde Image model: `~/Carde.io/organized-play-api/src/db/postgres/prisma/models/Image.part.prisma`
- Carde ResourceImage: `~/Carde.io/organized-play-api/src/db/postgres/prisma/models/ResourceImage.part.prisma`
- Carde S3 presign: `~/Carde.io/organized-play-api/src/app/manage/inquiries/services/s3objects.ts`
- Zealot NoopClient: `~/Desktop/UserEvidence/Zealot-Backend/src/plugins/assets/NoopAssetsClient.ts`
