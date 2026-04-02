# FEAT-009: File Management System

**Status**: Planning
**Priority**: High
**Created**: 2026-02-06
**Updated**: 2026-03-29
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
- Within-scope = move (same File, update path/key); cross-scope = copy (new File, new owner)
- Org/space owners and admins get implicit broad access via ReBAC; everyone else needs explicit ABAC
- Access is mutable (permission records with roles, expiry, inheritance via path)
- Public exposure is a usage concern (ResourceBinding visibility), not an access concern
- System folders provide scaffolding; user folders provide flexibility
- De-emphasize elaborate folder features and power-user file browser UX in favor of strong workflow integration

> **NOTE: Model names are provisional.** Names like `ResourceBinding`, system folder names,
> etc. may change during implementation. The layer separation and patterns are the core decisions.

---

## 2. Architecture — Three Layers

| Layer | Concern | Model(s) | Answers |
|-------|---------|----------|---------|
| **Storage** | What's in the bucket | `File`, `Folder` | Where is it? How big? What type? Who uploaded it? |
| **Access** | Who can see/download/manage (internal) | `FilePermission` | Who has what role? When does it expire? Does it inherit? |
| **Usage** | Where it's displayed, is it public | `ResourceBinding` | What role does this file play? Is it publicly exposed? |

Why three layers:
- **One model** breaks when access needs to vary per-user or expire
- **Two models** (file + permission) breaks when the same file is used as a logo AND an attachment, or when public exposure needs to be per-binding, not per-file
- **Three models** keeps each concern clean and independently queryable

**Key distinction from Google Drive:**
- In Drive, "public" is a sharing permission on the file
- Here, "public" is a property of a ResourceBinding — the same file can be public when bound as a logo and private when bound as an internal attachment

**Intent — bidirectional visibility is the whole point:**

Most SaaS apps treat files as write-once blobs. You upload, get a URL string, paste it into a column, and forget about it. The file and its usages are completely disconnected — the URL *is* the binding, and URLs don't know who's pointing at them. This leads to silent orphans (files nobody uses but nobody can safely delete), broken references (someone deletes a file and three pages lose their banner), and zero visibility in either direction ("what is this file doing?" / "where did this logo come from?").

This system is designed so that **every file knows what it's doing, and every usage knows where it comes from.** File → ResourceBinding gives you "this image is used as a logo on 2 spaces, an attachment on 3 inquiries, and shared with 4 users." ResourceBinding → File gives you "the banner on this space was uploaded by Y, owned by org Z, and has 3 other usages elsewhere." This bidirectional graph is what makes delete safety, lazy copy, access revocation, and lifecycle management possible — you can't orphan silently because the system knows every reference.

**When writing code against this system:** never store a raw URL string to reference a file. Always go through ResourceBinding. If something displays a file, there should be a binding. If there's no binding, the file isn't in use and can be safely cleaned up. This invariant is what keeps the graph complete. The one exception is URL-only bindings (external assets not managed in our storage) — these still go through ResourceBinding, they just don't have a File record behind them.

---

## 3. Data Model

### 3.1 File (Storage Layer)

The file IS the asset. It holds storage metadata, ownership, and its position in the hierarchy.

```prisma
model File {
  id              String    @id @default(uuid())
  organizationId  String?                         // null for user-personal files
  uploadedBy      String                          // userId or customerRefId
  uploadedByModel String    @default("User")      // "User" | "CustomerRef"

  folderId        String?                         // null = root level (no folder)
  path            String                          // materialized path (MUTABLE — updates on move)
  depth           Int       @default(0)           // 0 = root, 1 = first level, etc.

  key             String    @unique               // S3 object key (MUTABLE — kept in sync with path on move)
  filename        String                          // original filename
  contentType     String                          // MIME type
  size            Int                             // bytes
  status          String    @default("pending")   // pending | active | failed
  title           String?                         // human-readable title
  description     String?
  metadata        Json?                           // { width, height, duration, pages, etc. }

  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt
  deletedAt       DateTime?

  organization    Organization? @relation(fields: [organizationId], references: [id])
  folder          Folder?       @relation(fields: [folderId], references: [id])
  permissions     FilePermission[]
  versions        FileVersion[]
  // bindings     ResourceBinding[]              // v2: usage layer (what role a file plays on a resource)
}
```

**Ownership rules:**
- `organizationId` set → org owns it, org pays for storage
- `organizationId` null + `uploadedBy` set → user's personal file, user owns it
- Ownership never changes. If a user uploads to an org, the org owns it.

### 3.1.1 FileVersion (Storage Layer)

Each version is a separate record with its own S3 key. The File record points to the current version; previous versions are accessible but not default.

```prisma
model FileVersion {
  id          String    @id @default(uuid())
  fileId      String
  version     Int                               // monotonic: 1, 2, 3, ...
  key         String    @unique                 // S3 object key for this version
  size        Int                               // bytes (may differ per version)
  contentType String                            // MIME type (may differ if format changes)
  metadata    Json?                             // version-specific metadata (dimensions, etc.)
  uploadedBy  String                            // userId who uploaded this version
  current     Boolean   @default(false)         // true = this is the active version

  createdAt   DateTime  @default(now())

  file        File      @relation(fields: [fileId], references: [id])

  @@unique([fileId, version])                   // one version number per file
}
```

**S3 key pattern per version:**
```
{file.path}/file_{id}/v{version}/{filename}
// e.g. org_abc/space_123/file_xyz/v1/logo.png
//      org_abc/space_123/file_xyz/v2/logo.png
```

**Version lifecycle:**
- Upload creates version 1 (and the File record)
- Replace creates version N+1, sets `current = true` on new, `current = false` on old
- File.key stays in sync with the current version's key
- Old versions are retained in S3 until the file is hard-deleted or retention expires
- ResourceBindings always resolve to the current version unless explicitly pinned (future)

### 3.2 Folder (Storage Layer)

Self-referential tree with materialized paths. Two types: system folders (auto-created, enforce structure) and user folders (created by users, provide flexibility).

```prisma
model Folder {
  id              String    @id @default(uuid())
  organizationId  String?                         // null for user-personal folders
  createdBy       String                          // userId — for personal folders, this is the owner
  parentId        String?                         // null = root folder
  name            String
  path            String                          // materialized path
  depth           Int       @default(0)
  system          Boolean   @default(false)        // true = auto-created, can't delete/rename
  visibility      String    @default("visible")    // visible | admin-only | hidden

  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt
  deletedAt       DateTime?

  organization    Organization? @relation(fields: [organizationId], references: [id])
  parent          Folder?       @relation("FolderTree", fields: [parentId], references: [id])
  children        Folder[]      @relation("FolderTree")
  files           File[]
  permissions     FilePermission[]
}
```

### System folders (`system: true`)

Auto-created via DB hooks when orgs, spaces, and org memberships are created. Cannot be deleted or renamed by users. Provide the structural scaffolding.

> **NOTE:** The specific system folder names below are illustrative — they explain the concept
> of system vs user folders. The actual folder names and structure will be determined during
> implementation based on real use cases.

```
org_{id}/                                     -- system, auto-created with org
├── __[tbd]/                                  -- system, admin-only (e.g., internal docs, exports)
├── __[tbd]/                                  -- system, visible (e.g., shared resources)
├── space_{id}/                               -- system, auto-created per space
│   └── [user-created folders]                -- user, nested freely
├── org_user_{id}/                            -- system, auto-created per org membership
│   └── [user-created folders]                -- user, personal org-scoped folders
```

`__` prefix = internal/system convention (consistent with codebase `__` = internal, `_` = unused).

**Visibility on system folders:**
- `visible` — all org members can see and browse
- `admin-only` — only owners/admins can see (e.g., audit exports, system configs)
- `hidden` — not shown in file browser (internal system use only)

**User folders** (`system: false`) are created freely within system folders. They can be nested, renamed, moved, and deleted by users with appropriate roles.

### 3.3 FilePermission (Access Layer — ABAC)

Polymorphic target (File OR Folder). Uses existing roles (viewer/member/admin/owner) — same vocabulary as OrganizationUser/SpaceUser. This is the ABAC join that supplements RBAC (permix) for fine-grained, per-resource access control.

```prisma
model FilePermission {
  id            String    @id @default(uuid())
  targetId      String                            // fileId OR folderId
  targetModel   String                            // "File" | "Folder"
  granteeId     String
  granteeModel  String                            // User | Organization | Space | CustomerRef
  role          String    @default("viewer")       // viewer | member | admin | owner
  expiresAt     DateTime?
  createdBy     String                            // userId who created this permission
  revokedAt     DateTime?                         // null = active, set = revoked
  revokedBy     String?                           // userId who revoked (for audit)

  createdAt     DateTime  @default(now())

  // Polymorphic FK: targetId → File or Folder, granteeId → User/Org/Space/CustomerRef
  // Uses the template's existing false polymorphism pattern (app-level validation, no DB FK constraint)
  // Same approach as Token.ownerModel, CustomerRef, AuditLog.subjectModel

  @@unique([targetId, targetModel, granteeId, granteeModel])
  // Re-granting after revoke: clear revokedAt/revokedBy on the existing record
  // rather than creating a new one. The unique constraint prevents duplicates.
}
```

**Two kinds of ownership (distinct concepts):**

| Concept | Where it lives | Mutable? | Answers |
|---------|---------------|----------|---------|
| **Storage ownership** | `File.organizationId`, `File.uploadedBy` | No — immutable | Who pays for the bytes? Who uploaded it? |
| **Access ownership** | `FilePermission.role = "owner"` | Yes — can be granted/revoked | Who has highest management authority on this file/folder? |

Storage ownership is set at upload and never changes. Access ownership (`owner` role on FilePermission) is a grant that can be assigned, transferred, or revoked — it means "this entity has full administrative control over this resource."

**FilePermission roles (same vocabulary as OrganizationUser/SpaceUser):**

| Role | On files/folders | Equivalent |
|------|-----------------|------------|
| `viewer` | See metadata, download content | Drive viewer |
| `member` | Upload into folder, basic operations | Drive commenter |
| `admin` | Full manage, share, move, delete, manage permissions | Drive editor |
| `owner` | Admin + transfer access ownership, permanent delete | Drive owner |

**How FilePermission fits the existing permission system:**
- **RBAC** (permix): Capability gate — does the user's org/space role allow file operations?
- **ReBAC** (membership chain): Org/space owners and admins get implicit broad access to files in their scope (see section 6)
- **ABAC** (FilePermission): Fine-grained — explicit grants for specific users/entities on specific files/folders
- RBAC scopes the boundary (org/space membership required); ReBAC provides implicit scope-level access for owners/admins; ABAC provides explicit sharing and exceptions
- See section 6 for full access resolution flow

**Permission inheritance via path:**
FilePermission on a Folder inherits to everything inside. Most specific match wins.

```typescript
// File path: /org_abc/space_123/folder_456/file_789
// Check permissions at each ancestor:
const ancestors = [
  { id: 'file_789', model: 'File' },       // direct on file
  { id: 'folder_456', model: 'Folder' },    // folder level
  { id: 'space_123', model: 'Folder' },     // space system folder
  { id: 'org_abc', model: 'Folder' },       // org root folder
];
// Single query: WHERE (targetId, targetModel) IN (...) ORDER BY depth DESC LIMIT 1
```

### 3.4 ResourceBinding (Usage Layer) — v2

> **STUB — not implemented in Phase 1.** The usage layer (what role a file plays on a resource,
> whether it's publicly exposed) is deferred to v2. The design is captured here so the File
> model doesn't accumulate display/usage concerns that belong on a separate join.

When implemented, ResourceBinding will answer:
- What role does this file play? (logo, avatar, banner, attachment, cover, thumbnail)
- On what resource? (Organization, Space, User, Event, Inquiry — polymorphic)
- Is it publicly exposed? (`visibility: internal | public | unlisted`)
- In what order? (for galleries)
- How should it be rendered in this context? (media — sizing, crop, etc.)
- Is this a managed file or an external URL?

**Key principles (for when this is built):**
- Visibility lives on the binding, not the file or permission. Same file can be public as a logo and private as an attachment.
- Swapping a logo = update binding to point at different File, not delete + re-upload
- One File → many ResourceBindings
- `Space.logoUrl` becomes a query: `ResourceBinding WHERE resourceType=Space, resourceId=spaceId, bindingType=logo` → resolve via `sourceModel` (File lookup or direct URL)
- **File is optional.** A binding can reference a managed File (full lifecycle, access control, lazy copy) OR an external URL (no lifecycle management, just a pointer). This keeps ResourceBinding as the single source of truth for "what asset is used here" — even when the asset isn't in our storage. The invariant is: if something displays an asset, there's a binding. Always.

```prisma
model ResourceBinding {
  id              String    @id @default(uuid())
  sourceModel     ResourceBindingSourceModel @default(File) // "File" | "Url"
  fileId          String?   @db.VarChar(36)       // FK to File — required when sourceModel = "File"
  url             String?                         // external URL — required when sourceModel = "Url"
  resourceType    String                          // "Organization" | "Space" | "User" | "Event" | "Inquiry" | ...
  resourceId      String
  bindingType     String                          // "logo" | "avatar" | "banner" | "attachment" | "cover" | "thumbnail" | "og:image" | "favicon"
  visibility      String    @default("internal")  // "internal" | "public" | "unlisted"
  order           Int       @default(0)           // for galleries, ordered lists
  media           Json?                           // rendering data — dimensions, crop, format, quality
  conditions      Json?                           // contextual rules — when/where this binding applies

  createdBy       String                          // userId
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt

  file            File?     @relation(fields: [fileId], references: [id])

  // False polymorphism on source — same pattern as Token.ownerModel, EmailTemplate.ownerModel
  // sourceModel = "File" → fileId required (real FK with Prisma relation)
  // sourceModel = "Url"  → url required, no FK (same as EmailOwnerModel.default — enum value with no FK)
}

enum ResourceBindingSourceModel {
  File
  Url
}
```

**Registry entry:**
```typescript
ResourceBinding: {
  axes: [
    {
      field: 'sourceModel',
      fkMap: {
        File: ['fileId'],    // real FK → File model
        // Url: no FK — url field is required but not an FK (app-level validation)
      },
    },
  ],
}
```

`sourceModel = "Url"` follows the same pattern as `EmailOwnerModel.default` and `InquiryResourceModel.admin` — an enum value with no FK field in the registry. The `url` field is required when `sourceModel = "Url"` but isn't a foreign key — it's validated via a custom rule in db middleware (same layer as the false polymorphism hook):

```typescript
// DB middleware — custom validation for ResourceBinding Url source
// Runs alongside the false polymorphism hook on create/update
{
  model: 'ResourceBinding',
  action: ['create', 'update'],
  validate(data) {
    if (data.sourceModel === 'Url') {
      if (!data.url) throw new Error('ResourceBinding with sourceModel "Url" requires url');
      if (data.fileId) throw new Error('ResourceBinding with sourceModel "Url" cannot have fileId');
      // URL format validation (basic — protocol + domain)
    }
    if (data.sourceModel === 'File') {
      if (data.url) throw new Error('ResourceBinding with sourceModel "File" cannot have url');
      // fileId presence is enforced by the false polymorphism hook via fkMap
    }
  },
}
```

The false polymorphism hook handles `File` → `fileId` via the registry. The custom rule handles `Url` → `url` plus cross-field exclusion (can't have both). One layer, one pass, same middleware.

**Managed (`File`) vs external (`Url`):**

| | `sourceModel: File` | `sourceModel: Url` |
|---|---|---|
| Required field | `fileId` (FK to File) | `url` (string, app-validated) |
| Access control | Full (FilePermission, ReBAC) | None — URL is public or externally managed |
| Lazy copy on revoke | Yes | N/A — nothing to copy |
| Delete safety | Yes — binding prevents orphaning | No — URL can 404 silently |
| Lifecycle visibility | Full — "where is this file used?" | Partial — "this resource uses an external URL" |
| `media`/`conditions` | Yes | Yes — rendering context still applies |
| Migration path | — | Upload asset, set fileId, set sourceModel to File, clear url |

The external URL path is a pragmatic escape hatch — not everything needs to be a managed file. But the binding still exists, so you still have visibility into "what asset does this resource use?" and you have a clear migration path when someone wants to bring an external asset into the system.

**`media` and `conditions` on the binding:**

The binding carries two kinds of contextual data — *how* to render and *when* to apply. Same instinct as Cloudinary's transformation URLs and Carde's `ResourceImage.css`/`ResourceImage.conditions` fields — these are properties of the *usage*, not the *file*. These apply to both managed files and external URLs.

Two separate JSON fields, not one blob:

**`media`** — how this binding should be rendered:

```typescript
// ResourceBinding.media (Json, nullable)
{
  width?: number;           // desired display width (px)
  height?: number;          // desired display height (px)
  crop?: 'fill' | 'fit' | 'cover' | 'contain';  // how to fit into dimensions
  gravity?: 'center' | 'face' | 'top' | 'auto';  // crop anchor point
  quality?: number;         // 1-100 (for lossy formats)
  format?: 'webp' | 'avif' | 'png' | 'jpg';      // preferred output format
  aspectRatio?: string;     // e.g. "16:9", "1:1"
  // extensible — add fields as rendering needs grow
}
```

**`conditions`** — when/where this binding applies:

```typescript
// ResourceBinding.conditions (Json, nullable)
{
  device?: 'mobile' | 'desktop' | 'tablet';       // device-specific bindings
  viewport?: { min?: number; max?: number };       // breakpoint range (px)
  locale?: string;          // locale-specific assets (e.g. "ja" logo variant)
  darkMode?: boolean;       // light/dark mode variant
  // extensible — feature flags, time-based rules, A/B variants, etc.
}
```

**How they work together:** Multiple ResourceBindings can exist for the same `(resourceId, bindingType)` with different conditions. The consumer picks the best match:

```
Space "Design Team" has two logo bindings:
  1. file: full-logo.svg,   media: { width: 200 },  conditions: { device: "desktop" }
  2. file: icon-mark.svg,   media: { width: 40 },   conditions: { device: "mobile" }
```

When no conditions match or conditions is null, the binding is the default/fallback.

**Typical usage by binding type:**

Both fields are optional — most bindings are simple (just a file in a role). `media` and `conditions` are available when the use case calls for it.

| Binding type | `media` | `conditions` | Example |
|-------------|---------|-------------|---------|
| `logo` | width, format | device, darkMode | Full wordmark on desktop, icon-mark on mobile, inverted on dark mode |
| `avatar` | width, height, crop: fill | — | Always square, always cropped to face |
| `banner` | width, height, aspectRatio | device, viewport | Hero image at 16:9 on desktop, taller crop on mobile |
| `cover` | aspectRatio | — | Consistent ratio, browser scales |
| `thumbnail` | width, height, quality | — | Small, lower quality for fast loading |
| `attachment` | — | — | Just a file reference, no rendering concerns |
| `og:image` | width: 1200, height: 630 | — | Fixed OG dimensions per spec |
| `favicon` | width: 32, format: png | — | Fixed size/format |

**No server-side preprocessing in v2** — `media` is consumed by the frontend to set CSS/`<img>` attributes and request appropriate sizes. The file is served as-is from S3/CDN. Server-side transforms (resize, reformat, derivative generation) are a future capability that could grow from `media` — if we ever add a processing pipeline, the rendering data is already there telling it what to generate. Cloudinary-style on-the-fly transforms are the north star but not a v2 requirement.

**Until v2:** files are just files. No `purpose` field, no binding. Code that needs "the org logo" queries files directly by convention (e.g., folder path or ad-hoc).

### 3.5 How the layers interact

```
Upload flow (v1):
  1. Create File (storage record + presigned upload to bucket)
  2. Create FilePermissions:
     - Uploader gets "owner" role
     - If uploading to space/org: Space/Org gets "viewer" role (so members can see it)
     // Org/space owners/admins get broader access via ReBAC — no extra permission needed

Download flow (v1):
  1. Look up File
  2. Check access: RBAC (permix) → ReBAC (membership chain) → ABAC (FilePermission)
  3. Generate presigned GET URL

Upload flow (v2, with ResourceBinding):
  1. Create File
  2. Create FilePermission
  3. Create ResourceBinding (where it appears + public/internal visibility)

Public download flow (v2, with ResourceBinding):
  1. Client → yourapp.com/public/files/:id
  2. Check ResourceBinding with visibility="public" exists
  3. Cloudflare proxy → presigned GET → cached at edge
  (FilePermission not checked — public binding = public access)
```

---

## 4. Bucket Architecture

### Two buckets (per environment)

| Bucket | Purpose | Ownership | S3 Key Prefix |
|--------|---------|-----------|---------------|
| **system** | Platform assets — default avatars, email templates, branding | Platform | `platform/` |
| **user** | All user/org/space uploaded content | User or Org | `user_{id}/`, `org_{id}/` |

Railway auto-provisions per environment, so: 2 buckets × N environments.

**System bucket** — no org scoping. Pure platform assets:
```
system-bucket/
  platform/
    defaults/
      avatar.png
      placeholder.png
    email/
      header.png
      footer.png
    branding/
      logo.svg
      favicon.ico
```

Org-specific "system" assets (e.g., custom email header for white-labeling) are user-bucket files with a ResourceBinding to the org's email config — not system-bucket files.

### User bucket — S3 key structure

Keys mirror the materialized path + filename. Navigable in Railway's S3 browser.

```
user-bucket/
  user_{id}/                              -- personal, survives leaving any org
    file_{id}/global-avatar.png
    __[tbd]/                              -- system folder (illustrative)
      file_{id}/data-export.zip

  org_{id}/                               -- org root
    file_{id}/org-logo.png
    __[tbd]/                              -- system folder, admin-only (illustrative)
      file_{id}/[example].pdf

    org_user_{id}/                        -- user's org-scoped personal space
      file_{id}/work-avatar.png
      user-created-folder/
        file_{id}/proposal.pdf

    space_{id}/                           -- space scope
      file_{id}/report.pdf
      user-created-folder/
        file_{id}/banner.png
```

**S3 key = materialized path + filename (kept in sync):**
```typescript
const key = `${file.path}/${file.filename}`;
// e.g. "org_abc/space_123/assets/file_xyz/banner.png"
```

**S3 keys stay in sync with logical paths via a durable move job.**

Moves are a multi-step process that can fail at any point. A durable job record
makes the intent resumable from wherever it left off.

All durable file operations — moves, lazy copies, and future job types — share a single `FileJob` table with a `type` discriminator. One table, one sweeper, one reconciliation loop.

```prisma
model FileJob {
  id              String    @id @default(uuid())
  type            String                          // "move" | "lazyCopy" (extensible for future ops)
  fileId          String                          // the file being acted on (source for copy, subject for move)

  // Shared fields — every job has a before/after S3 key pair
  sourceKey       String                          // current S3 location (move: old key, copy: source key)
  targetKey       String                          // desired S3 location (move: new key, copy: destination key)
  sourcePath      String?                         // logical path before (move only)
  targetPath      String?                         // logical path after (move only)

  // Lazy copy specific (null for moves)
  newFileId       String?                         // the snapshot File record (created upfront, status: "pending")
  reason          String?                         // "accessRevoked" | "accessExpired" | "sourceDeleted"
  triggeredBy     String?                         // userId who caused the revocation/deletion
  dependentId     String?                         // granteeId who gets the copy
  dependentModel  String?                         // "User" | "Organization" | "Space"

  // Job lifecycle
  done            Boolean   @default(false)       // terminal flag
  attempts        Int       @default(0)
  error           String?
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt
}
```

**Why one table:**
- Same durability contract (Postgres = intent, BullMQ = fast path, sweeper = safety net)
- Same idempotent reconciliation philosophy (check actual state, converge)
- One sweeper loop picks up all stalled jobs by type
- New file operations (e.g., bulk copy, cross-scope adopt) just add a new `type` — no new table, no new sweeper

**Reconciliation — dispatch by type, each handler is idempotent:**

```typescript
async function reconcileFileJob(job: FileJob, db, s3) {
  switch (job.type) {
    case 'move': return reconcileMove(job, db, s3);
    case 'lazyCopy': return reconcileLazyCopy(job, db, s3);
    default: throw new Error(`Unknown FileJob type: ${job.type}`);
  }
}

async function reconcileMove(job: FileJob, db, s3) {
  // 1. Does target key exist in S3? No → copy it.
  const targetExists = await s3.headObject(job.targetKey).catch(() => false);
  if (!targetExists) {
    await s3.copyObject(job.sourceKey, job.targetKey);
    if (!await s3.headObject(job.targetKey).catch(() => false)) return; // retry next cycle
  }

  // 2. Does DB point to target key? No → swap it.
  const file = await db.file.findUnique({ where: { id: job.fileId } });
  if (file.key !== job.targetKey) {
    await db.file.update({
      where: { id: job.fileId },
      data: { key: job.targetKey, path: job.targetPath },
    });
  }

  // 3. Does source key still exist in S3? Yes → delete it.
  await s3.deleteObject(job.sourceKey);   // idempotent — no error if already gone

  // All three conditions met → done
  await db.fileJob.update({ where: { id: job.id }, data: { done: true } });
}

async function reconcileLazyCopy(job: FileJob, db, s3) {
  // 1. Does target key exist in S3? No → copy it.
  const targetExists = await s3.headObject(job.targetKey).catch(() => false);
  if (!targetExists) {
    await s3.copyObject(job.sourceKey, job.targetKey);
    if (!await s3.headObject(job.targetKey).catch(() => false)) return; // retry next cycle
  }

  // 2. Is the new File record active? No → activate it.
  const newFile = await db.file.findUnique({ where: { id: job.newFileId } });
  if (newFile.status !== 'active') {
    await db.file.update({
      where: { id: job.newFileId },
      data: { status: 'active' },
    });
  }

  // 3. Are ResourceBindings repointed? No → repoint them.
  await db.resourceBinding.updateMany({
    where: { fileId: job.fileId, resourceOwnerId: job.dependentId },
    data: { fileId: job.newFileId },
  });

  // All three conditions met → done
  await db.fileJob.update({ where: { id: job.id }, data: { done: true } });
}
```

**Three questions, three idempotent actions.** `sourceKey`/`targetKey` define the
desired state. The worker just converges reality toward it. If it crashes
at any point, the next run re-checks and picks up where it left off.

**Reads never 404 because of execution order:**

| New key in S3? | DB points to? | Old key in S3? | Read works? |
|----------------|--------------|----------------|-------------|
| No | old key | Yes | Yes — old object serves |
| Yes | old key | Yes | Yes — old object serves (copy done, swap pending) |
| Yes | new key | Yes | Yes — new object serves (cleanup pending) |
| Yes | new key | No | Yes — new object serves (done) |

**Two execution paths (fast + safe):**

```
Request path (fast):
  1. Postgres transaction:
     - Create FileJob (type: "move", sourceKey/targetKey, sourcePath/targetPath)
     - File.path and File.key stay unchanged (reads work, S3 key valid)
  2. Enqueue BullMQ job with FileJob.id
  3. BullMQ worker runs reconcileFileJob → dispatches to reconcileMove:
     copy S3 → update File.path + File.key in DB → delete old S3 key

Sweeper path (safety net):
  - Cron runs every N minutes (same sweeper as section 16)
  - Picks up FileJob records NOT in terminal state (done/failed)
  - Dispatches by type — same reconciliation functions
  - Catches anything BullMQ drops (Redis flush, worker crash, lost job)
```

Both paths are idempotent — running both on the same job is harmless.
BullMQ is the fast path (sub-second). The DB table + sweeper is the
durability guarantee. The Postgres record IS the source of truth, not Redis.

Moves are rare; reads are constant. The copy+delete cost only hits at move time.
Railway Buckets don't charge for API operations, so cost = latency only.

### Ownership by path scope

| Path prefix | Who owns it | Who pays | Survives leaving org? |
|-------------|------------|----------|----------------------|
| `user_{id}/...` | User | User / platform | Yes — personal files persist |
| `org_{id}/...` | Organization | Org | N/A |
| `org_{id}/org_user_{id}/...` | Organization | Org | No — org keeps files, user loses access |
| `system-bucket/...` | Platform | Platform | N/A |

---

## 5. Materialized Path & Traversal

### Path format

```
/{scope_prefix}_{id}/{model_prefix}_{id}/.../{model_prefix}_{id}

Examples:
/org_abc                                    -- org root
/org_abc/space_123                          -- space within org
/org_abc/space_123/folder_456              -- user folder in space
/org_abc/org_user_789                       -- user's personal org scope
/user_abc                                   -- user's global personal scope
```

### Path queries (no recursion needed)

```sql
-- All files inside a folder (recursive descendants)
WHERE path LIKE '/org_abc/space_123/folder_456/%'

-- Direct children only
WHERE path LIKE '/org_abc/space_123/folder_456/%' AND depth = 3

-- Breadcrumb (ancestors) — split the path string in application code

-- Move a folder (copy-first-then-swap):
-- Step 1: S3 copy all affected files to new keys (async, idempotent)
-- Step 2: On all copies complete, DB update (atomic):
UPDATE "File" SET
  path = REPLACE(path, '/old/parent/', '/new/parent/'),
  key = REPLACE(key, '/old/parent/', '/new/parent/')
WHERE path LIKE '/old/parent/%'
-- Step 3: Queue S3 delete of old keys (async, idempotent)
```

### Traversal helpers

```typescript
getAncestors(path: string): string[]            // split path into ancestor segments
getDescendantsQuery(path: string): WhereClause   // LIKE prefix query
getBreadcrumb(path: string): { id, name }[]      // parse path + batch lookup
moveFolder(folderId, newParentId): void           // update path + all descendants
validateNoCircular(folderId, targetId): boolean   // prevent cycles
```

---

## 6. Access Control

### Access resolution (internal downloads)

```
Can user X perform action A on file Y?

Step 1 — Relationship check (at least one must be true):
  a) User is the file's storage owner (uploadedBy)
  b) User is a member of the file's org (organizationId)
  c) User is a member of the file's space (via folder path)
  d) User has an explicit FilePermission grant on file Y (or ancestor folder)

  None → 404. Stop. (User has no relationship to this file at all.)

Step 2 — Authorization (first match wins, checked in order):
  a) ReBAC inheritance: Is user an owner/admin of the file's org or space?
     Yes → implicit broad access to all files in that scope (manage-level).
  b) ABAC: FilePermission record for user X on file Y (or ancestor folder)
     with sufficient role for action A?
  c) Neither → 404.

Step 1 prevents random users from probing file IDs.
Step 2 determines what level of access the relationship grants.
An explicit FilePermission share (1d) passes the boundary AND authorizes (2b)
in a single check — no org/space membership required for direct shares.
```

**ReBAC inheritance (scope owners/admins):**
- Org `owner` / `admin` → implicit broad access to ALL files under `org_{id}/`
- Space `owner` / `admin` → implicit broad access to ALL files under `org_{id}/space_{id}/`
- This mirrors the existing org→space permission waterfall — scope ownership flows down
- No FilePermission record needed for these users; their org/space role IS the authorization

**Regular members/viewers need explicit access:**
- Org `member` / `viewer` → only see files where a FilePermission exists (directly or via folder inheritance)
- Space `member` / `viewer` → same, only what's explicitly shared
- This prevents the over-grant where every org member can access every file

**Org→space sharing (explicit, not implicit):**
Files in `org_{id}/` (org-scoped) are NOT automatically visible to spaces. If the org wants a space to access an org-level folder:

```
Create a FilePermission:
  targetId    = orgFolderId
  targetModel = "Folder"
  granteeId   = spaceId
  granteeModel = "Space"
  role        = "viewer" | "member" | "admin" | "owner"

→ Permission inherits to all descendants of that folder
→ Space members can access via their space membership + this ABAC grant
```

This keeps the org root private by default. Sharing is explicit. Inheritance does the heavy lifting. The same mechanism works for user→user, org→user, org→space, and space→user shares.

### Public access resolution (v2, via ResourceBinding only)

```
Is file Y publicly accessible?

1. Does file Y have a ResourceBinding with visibility="public"?
   Yes → serve via Cloudflare proxy, no auth check
   No  → fall through to internal access resolution

Public access is NEVER granted via FilePermission.
FilePermission is internal access only (user/org/space/customer).
Public exposure is exclusively a ResourceBinding concern.
```

### Access scenarios

| Scenario | FilePermission created | ResourceBinding |
|----------|----------------------|-----------------|
| User uploads to Space | User (owner) + Space (viewer) on file | — (no binding yet) |
| User uploads personal file | User (owner) only | — |
| Customer submits to Space | CustomerRef (viewer) on file | attachment, internal |
| Set as org logo | — (existing permissions sufficient) | logo, **public** |
| Set as internal attachment | — | attachment, internal |
| Admin shares org folder to Space | Space FilePermission (viewer) on folder | — |
| Admin shares to specific User | User FilePermission (viewer) on file/folder | — |
| Time-limited share link | FilePermission with `expiresAt` | — |

**Note:** Org/space owners and admins don't need explicit FilePermission records —
they get implicit access to all files in their scope via ReBAC inheritance.
Only regular members/viewers and cross-scope sharing require FilePermission records.

### Boundary crossing

**Core rule: within-scope = move, cross-scope = copy.**

| Operation | Same owner? | What happens | File record |
|-----------|------------|--------------|-------------|
| Move file between folders in same org | Yes | Update path/key, sync S3 | Same File, updated path |
| Move file between folders in same user scope | Yes | Update path/key, sync S3 | Same File, updated path |
| Submit personal file to org/space | No (user→org) | Reference/share only | Original File stays, no copy yet |
| Promote/adopt submitted file into org/space | No (user→org) | Copy bytes to new org-owned File | New File record, new S3 key, new owner |
| Share org folder with space | Same org | FilePermission grant | Same File, no copy |

**Personal → org/space submission flow:**

```
1. Artist uploads to personal folder       → user_{id}/drafts/artwork.png
                                              File(uploadedBy=user, organizationId=null)

2. Artist submits as draft to org/space    → NO copy, NO move, NO ownership change
                                              Create temporary FilePermission:
                                                targetId = fileId
                                                granteeModel = "Organization" or "Space"
                                                granteeId = orgId/spaceId
                                                role = "viewer"
                                              (Optional: submission/review record — v2)

3. Org/space admin reviews and accepts     → COPY bytes to org scope:
                                              New File(organizationId=orgId, uploadedBy=user)
                                              New S3 key: org_{id}/space_{id}/artwork.png
                                              Original personal file stays at user_{id}/drafts/artwork.png
                                              Revoke temporary FilePermission from step 2

4. User optionally deletes personal copy   → User's choice, not automatic
```

**Why copy, not move, across owners:**
- Ownership boundary = billing boundary. Moving silently changes who pays.
- Audit trail: the original upload is preserved with its original context
- No "where did my file go?" surprises for the submitter
- Cleaner rollback: if the org rejects later, the user still has their original

**Space transfer:**
- File ownership (`organizationId`) does NOT change — original org owns the bytes
- FilePermissions for the Space stay intact (linked to targetId, not orgId)
- Add Org-level FilePermission for new org so admins can manage transferred files
- SpaceUser cascade gives new org members access through space membership

**User leaves org:**
- User-specific FilePermissions scoped to that org's files → revoked
- Space/Org permissions remain (other members still need access)
- Org-scoped personal files (`org_{id}/org_user_{id}/`) → org keeps them, user loses access
- User's global files (`user_{id}/`) → unaffected

**Space deleted (soft delete):**
- Files soft-deleted with the space (`deletedAt` set)
- FilePermissions remain (for potential restore)
- S3 objects NOT deleted immediately — cleanup job handles retention

### Lazy Copy (Copy-on-Revoke)

When a user is given access to a file they don't own, they can use it — bind it as a logo, reference it in a space, depend on it. Today that creates a tension: either you hard-copy the file immediately (independent but never updated) or you use a live pointer (stays current but breaks if access is revoked or the file is deleted).

Lazy copy is a third semantic: **use the live original, but automatically create a local copy if the source becomes inaccessible.** The user stays up-to-date while access exists. If access is revoked or the file is deleted, dependent users get a snapshot copy so nothing breaks.

**Why this should be the default:**
- If a user had access, they could have copied the file at any time. Revoking access without preserving their dependencies just breaks things for no real gain.
- The real value of revocation is cutting off *future* access, not retroactively removing what someone already built on.
- Prevents broken ResourceBindings, missing logos, dead references — the kinds of silent failures that erode trust.

#### Triggers

Lazy copy fires when **any** of these occur and there are active dependents:

| Event | What happens |
|-------|-------------|
| **FilePermission revoked** (`revokedAt` set) | Users/entities who lose access but have active dependencies get copies |
| **FilePermission expired** (`expiresAt` passed) | Same — expiry is just automatic revocation |
| **File soft-deleted** (`deletedAt` set) | All external dependents (anyone other than the storage owner) get copies |
| **File hard-deleted** (orphan sweeper) | Safety net — if any unresolved dependencies remain, copy before destroying bytes |

#### What counts as a dependent

Two ways a user/entity can be a dependent:

1. **Active ResourceBinding** (automatic) — if entity X has a ResourceBinding pointing at this file (logo, avatar, attachment, etc.), they're a dependent. This is the primary trigger — bindings would break without the copy.

2. **`preserveOnRevoke` flag on FilePermission** (opt-in) — even without a ResourceBinding, a user can express "I want to keep watching this file, and if my access ever goes away, give me a copy." This is an option on the FilePermission itself — essentially a subscription to lazy copy.

```prisma
model FilePermission {
  // ... existing fields ...
  preserveOnRevoke  Boolean   @default(true)  // lazy copy: create a local copy if access is lost
  fromVersion       Int       @default(1)     // earliest version grantee can access (1 = all, current version number = from now onward)
}
```

Default is `true` — opt-out rather than opt-in. Users who explicitly don't want preservation can set it to `false`.

**`fromVersion`** — the explicit version number the grantee's access starts from, captured at grant creation time:

| Value | Behavior | Use case |
|-------|----------|----------|
| `1` | Access to every version (1 through latest) | Default — full history, the normal share |
| `N` (current version at grant time) | Only version N and above | "You can use this going forward, but the history before you got access isn't yours" |

Set at permission creation time — either `1` (all versions) or the file's current version number at that moment. This is an explicit snapshot of intent, not a timestamp inference. The version number is immutable after grant — it doesn't shift as new versions are created.

This also prevents the sharer from gaming revocation by replacing the file content with a blank before revoking — the grantee's version access is scoped to what existed during their grant window, and lazy copy preserves all versions they had access to (see below).

#### What the copy looks like

Lazy copy duplicates **all FileVersions the user had access to** (version >= `fromVersion`), not just the current version. This ensures the snapshot is a complete preservation of what the user could see — the owner can't hollow out the file before revoking to leave the grantee with nothing.

The lazy copy creates a **new File record** owned by the dependent user/org, stored in their scope:

| Field | Value |
|-------|-------|
| `organizationId` | Dependent's org (or null for personal) |
| `uploadedBy` | System (not the original uploader) |
| `folderId` | System folder: `__preserved/` within the dependent's scope |
| `path` | `{dependent_scope}/__preserved/{file_id}/{filename}` |
| `key` | Mirrors path (new S3 key, new bytes copied from original) |
| `status` | `active` |
| `sourceFileId` | Original file ID — provenance tracking |
| `snapshotAt` | Timestamp when the copy was created |
| `snapshotReason` | `accessRevoked` \| `accessExpired` \| `sourceDeleted` |
| `snapshotBy` | userId who triggered the revocation/deletion (for audit) |

New fields on File for provenance:

```prisma
model File {
  // ... existing fields ...
  sourceFileId     String?                          // if this is a lazy copy, the original file it came from
  snapshotAt       DateTime?                        // when the copy was created (null = this is a live/original file)
  snapshotReason   String?                          // "accessRevoked" | "accessExpired" | "sourceDeleted"
  snapshotBy       String?                          // userId who triggered the event that caused the copy
}
```

#### `__preserved/` system folder

A new system folder per scope that holds lazy-copied files:

| Scope | System folder | Auto-created |
|-------|--------------|-------------|
| User personal | `user_{id}/__preserved/` | On first lazy copy (or with user creation) |
| Org-scoped user | `org_{id}/org_user_{id}/__preserved/` | On first lazy copy |
| Org root | `org_{id}/__preserved/` | On first lazy copy |
| Space | `org_{id}/space_{id}/__preserved/` | On first lazy copy |

Properties: `system: true`, `visibility: "visible"`. Users can see their preserved copies and move them elsewhere if they want. The folder is a landing zone, not a jail.

#### Durability

Lazy copy uses the unified `FileJob` table (section 3.5) with `type: "lazyCopy"`. Same Postgres-as-intent, BullMQ fast path, sweeper safety net. The `reconcileLazyCopy` handler is defined alongside `reconcileMove` — one sweeper loop, one dispatch.

#### UX indicators

Preserved copies must be clearly distinguishable from live files:

- **Snapshot badge** — visual flag indicating "this is the last version you had access to"
- **Reason label** — "Access revoked by [user] on [date]" or "Original file deleted by [user] on [date]" or "Access expired on [date]"
- **Source reference** — link to the original file ID (may show as "no longer accessible" if the user truly can't see it anymore)
- **No auto-update** — the file is frozen. The snapshot is the user's copy now. No re-grant flow — if access is later re-granted to the original, the user simply has both: their owned snapshot and renewed live access. No automatic merging or prompting.

#### Revocation flow (with lazy copy)

```
1. Admin revokes FilePermission for User B on File X
   (or: FilePermission expires, or File X is soft-deleted)

2. System checks: does User B have active dependencies on File X?
   a) Any ResourceBindings pointing at File X where the resource belongs to User B?
   b) Does User B's FilePermission have preserveOnRevoke = true?

3. If yes to either:
   a) Create new File record owned by User B (status: "pending", snapshot fields populated)
   b) Create FileJob record (type: "lazyCopy", durable intent)
   c) Enqueue BullMQ job with FileJob.id
   d) BullMQ worker (or sweeper fallback) runs reconcileLazyCopy:
      - Copy S3 bytes to User B's __preserved/ folder
      - Repoint User B's ResourceBindings from File X → new snapshot File
      - Mark new File as active, mark job as done
   Same unified FileJob table, same sweeper, fully idempotent.

4. Revoke/expire/soft-delete proceeds as normal
   (User B's copy is independent — the original can be fully deleted)
```

#### Interaction with soft-delete and hard-delete

- **Soft delete** (`deletedAt` set) triggers lazy copy immediately. The retention window is for the *owner* to restore, not for dependents to scramble. Dependents get their copies right away.
- **Hard delete** (orphan sweeper) also triggers lazy copy as a safety net — if any active external dependencies still exist at hard-delete time (e.g., soft-delete trigger failed, edge case race, or file was hard-deleted without soft-delete), create copies before destroying the bytes. This is defense-in-depth: soft-delete is the primary trigger, hard-delete is the last chance. Never destroy S3 bytes while unresolved dependencies exist.
- The `__preserved/` copies are fully independent files — they follow normal lifecycle rules for their owner's scope.

#### Audit events

| Event | Data |
|-------|------|
| `file.lazy_copied` | sourceFileId, newFileId, reason, snapshotBy, dependentId |
| `file.binding_repointed` | bindingId, oldFileId, newFileId, reason |

### "Shared With Me" Virtual View

Files and folders shared with a user (via FilePermission where the user is grantee) should appear in a navigable virtual view — similar to Google Drive's "Shared with me":

- **Shared folders** appear as a normal folder structure that the user can browse, nested naturally.
- **Shared individual files** (not inside a shared folder) appear in a flat list, since there's no parent folder context to display them in. Google Drive-style: a list of individually shared files with metadata about who shared them and when.
- This is a **virtual view**, not a real folder — it's a query against FilePermission where `granteeId = userId` and `granteeModel = "User"`, filtered to active (not revoked, not expired).
- Shared items are read-only or role-limited based on the FilePermission role.
- The `__preserved/` folder contents (lazy copies) can also appear here with their snapshot badge, or in the user's own file tree — or both. The preserved files are real files the user owns, so they show up in normal browsing too.

---

## 7. Upload Flow (Presigned POST)

### Why presigned POST (not PUT, not proxy)

- `createPresignedPost` enforces constraints at the bucket level (size, content-type) — even if someone extracts the URL, they can't abuse it
- No API memory pressure for large files
- Browser uploads directly to bucket

### Sequence

```
1. Client → API: POST /files/presign
   Body: { filename, contentType, size, folderId? }
   Auth: permix check for file upload in target scope

2. API validates:
   - File size within limits
   - Content type allowed
   - User has permission to upload to target folder/scope

3. API creates:
   - File record (status: "pending", path computed from folder)
   - FilePermission for uploader (role: "owner")
   - If uploading to a space/org folder: FilePermission for that Space/Org (role: "viewer")
     so regular members can see it without explicit sharing

4. API generates presigned POST URL (short TTL, ~15 min)
   With conditions: content-length-range, exact key, content-type
   Returns: { fileId, uploadUrl, fields, expiresAt }

5. Client → Bucket: POST file directly using presigned URL + fields

6. Client → API: POST /files/:id/confirm
   API: HEAD object on bucket to verify upload succeeded
   API: Update File status → "active"
   API: Tag S3 object (orgId, uploadedBy)
```

### S3 metadata & tags (from Carde patterns)

On upload, store in S3 object metadata:
- `x-amz-meta-original-user-id`: userId (defense-in-depth ownership record)
- `x-amz-meta-filename`: original filename

On confirm, tag the S3 object:
- `organization-id`: orgId (for lifecycle rules)
- `uploaded-by`: userId (for audit)

### Cleanup job

- Find files with `status: "pending"` older than 1 hour
- HEAD check — if object exists, mark active; if not, mark failed
- Files with `status: "failed"` older than 24h → hard delete record

---

## 8. Download & Public Serving

### Internal downloads

```
GET /files/:id/download

1. Load File
2. Check access (RBAC → ReBAC → ABAC, see section 6)
3. Generate presigned GET URL (TTL: 15 min)
4. Return: 302 redirect or { url, expiresAt } JSON
```

### Public serving via Cloudflare

For files with a `public` ResourceBinding (logos, avatars, banners on public pages):

```
Client → yourapp.com/public/files/:id
  → Cloudflare CDN (cache hit? serve directly)
  → Cache miss: your API validates public binding exists
    → Presigned GET from Railway Bucket
    → Stream response with cache headers

Headers:
  Cache-Control: public, max-age=86400
  Cache-Tag: file-{fileId}
  ETag: from bucket response
```

Gives stable URLs that don't expire. Cloudflare caches globally. When a file changes, purge by `Cache-Tag`.

**No auth check for public bindings** — the ResourceBinding with `visibility: "public"` is the authorization. If it exists, serve the file.

### Unlisted URLs

For `visibility: "unlisted"` bindings — accessible via direct URL but not listed in any index:
- Same as public serving but no `Cache-Tag` purge (lower priority)
- URL is the secret — anyone with the URL can access it
- Use case: shareable links, embed URLs

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

Same role names as OrganizationUser/SpaceUser. One vocabulary across the system.

**Org/space owners/admins don't need FilePermission records** — they get implicit
broad access via ReBAC inheritance (see section 6). FilePermission.role=owner is
for explicit grants on specific files/folders, independent of org/space role.

---

## 10. System Folder Auto-Creation

### DB hooks — auto-create system folders

| Event | System folder created | Properties |
|-------|----------------------|------------|
| Organization created | `org_{id}/` root folder | `system: true`, `visibility: "visible"` |
| Organization created | `org_{id}/__[tbd]/` (illustrative) | `system: true`, `visibility: "admin-only"` |
| Space created | `org_{id}/space_{id}/` | `system: true`, `visibility: "visible"` |
| OrgUser created | `org_{id}/org_user_{id}/` | `system: true`, `visibility: "visible"` + FilePermission(user=owner) |
| User created (global) | `user_{id}/` | `system: true`, `visibility: "visible"` |

> **NOTE:** The specific `__` system folder names and structure are TBD. The above illustrates
> the *pattern* — system folders auto-created via hooks, with `visibility` controlling who sees them.
> Actual names will be determined by real use cases during implementation.

### System folder rules

- `system: true` → cannot be deleted or renamed by users
- `system: true, visibility: "admin-only"` → only owners/admins see it in the file browser
- `system: true, visibility: "hidden"` → not shown in file browser (internal system use only)
- User folders (`system: false`) can be freely created, nested, renamed, moved, and deleted

---

## 11. Infrastructure

### Railway Bucket Setup

- Add to init script: `bucketSetup.ts` / `bucketSteps.ts`
- Two buckets per environment: `{project}-system` and `{project}-user`
- Env vars: `SYSTEM_BUCKET_*` and `USER_BUCKET_*` (NAME, ACCESS_KEY_ID, SECRET_ACCESS_KEY, ENDPOINT, REGION)

### Per-Integration API Keys for Spend Tracking

The adapter pattern (see `packages/shared/src/adapter/`) should support **per-integration segmented API keys** so that spend can be tracked per external service. Instead of a single S3 credential set, each integration (S3 upload, S3 download, S3 move/copy, CDN proxy) can have its own key. This applies broadly across all adapters — not just S3, but email (Resend), error reporting (Sentry), payment (Stripe), verification (Bouncer), etc.

**TODO:** Update the adapter pattern to accept multiple keys per integration, segmented by operation or concern. This enables:
- Per-operation cost attribution (uploads vs downloads vs copies)
- Rate limit isolation (a lazy copy storm doesn't exhaust the download key's rate limit)
- Granular revocation (rotate the upload key without touching downloads)
- Spend dashboards per integration and per operation type

This is a cross-cutting concern for the adapter layer, not file-system-specific. Captured here because S3 is the first integration where it matters at volume.

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
│   └── filePublicDownload.ts       — GET /public/files/:id (v2: driven by ResourceBinding visibility)
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

- [ ] **Size limits** — per-file max? Per-org quota? Per-user quota?
- [ ] **Personal file billing** — who pays for `user_{id}/` personal files? Platform? User plan tier?
- [ ] **Allowed content types** — whitelist by purpose? Or allow anything?
- [ ] **Soft delete retention** — how long before S3 objects are hard-deleted? 30d? 90d?
- [ ] **Virus scanning** — scan on confirm? Skip for v1?
- [ ] **Image processing** — thumbnails on upload? Defer?
- [ ] **Max folder depth** — unbounded? Or cap at N levels?
- [ ] **System folder names** — what `__` system folders does each scope actually need?
- [ ] **Cloudflare setup** — part of init script? Or manual DNS setup?
- [ ] **Lazy copy quota** — do preserved copies count toward the recipient's storage quota? (Probably yes — they own the bytes now)
- [x] **Re-grant after lazy copy** — no special handling. User keeps their snapshot and gets live access back independently. No merging, no prompting.
- [ ] **`__preserved/` folder creation timing** — create eagerly with scope (simpler) or lazily on first copy (less clutter)?
- [ ] **Lazy copy vs system custody** — two strategies for preventing broken references on revocation/deletion. Not mutually exclusive — could be system custody as default (cheap) with lazy copy as opt-in (full independence). Decision affects fan-out, storage cost, billing, and ownership model. See below.
- [ ] **Lazy copy fan-out limits** — theoretical concern at extreme scale (200 files x 50 users). In practice, revocations will typically be a handful of files affecting a few users — this is an uncommon action. Worth having a basic batch limit but don't over-engineer for a scenario that rarely occurs.
- [ ] **Race window during lazy copy** — between permission revocation and copy completion, ResourceBindings point at a file the user can no longer access. Options: defer revocation until copies complete (revoke is async), or serve from original during grace window (short-lived read-through even after revoke).

**Lazy copy vs system custody — tradeoff analysis:**

Both solve the same problem: preventing broken references when access is revoked or a file is deleted while others depend on it.

| | Lazy copy | System custody |
|---|---|---|
| **Mechanism** | Copy bytes to each dependent's scope | Platform takes ownership of the file, keeps serving it |
| **Fan-out** | N copies per dependent (potentially thousands) | Zero — one file, one ownership transfer |
| **Storage cost** | Multiplied per dependent | No increase |
| **Bindings** | Must repoint to new file IDs per dependent | Unchanged — same file, same ID |
| **Ownership model** | Clean — each dependent owns their copy | Exception to "ownership never changes" — platform takes over |
| **Billing** | Dependents pay for their copies | Platform pays — custody bucket grows forever |
| **Independence** | Full — each copy is a standalone file | Single point — if platform deletes, everyone loses |
| **Complexity** | High (FileJob fan-out, repointing, version copying) | Low (one ownership update, one S3 move at most) |

**Possible hybrid:** system custody as the default (cheap, no fan-out, bindings stay intact) and lazy copy as an explicit opt-in for users who want full independence and are willing to pay for the storage. `preserveOnRevoke` on FilePermission could control which strategy fires.
- [ ] **FileVersion `current` flag concurrency** — two concurrent version uploads can race on setting `current = true/false`. Needs atomic swap in a transaction.
- [x] **Mutable vs immutable S3 keys** — keeping mutable path-mirroring keys. The debuggability win for superadmins navigating Railway's S3 browser is a daily operational benefit. Moves are rare; the FileJob system handles them cleanly. Not worth trading real-world usability for architectural purity.
- [ ] **FilePermission orphan cleanup** — false polymorphism means no cascade delete at DB level. Need a cleanup strategy (sweeper, or explicit cleanup on file/folder delete).
- [ ] **Lazy copy default** — `preserveOnRevoke: true` triggers copies for every revocation by default. At scale this is operationally expensive. Consider whether `false` (opt-in) is saner, or whether fan-out limits make `true` viable.

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
- Within same owner → real move (update path/key)
- Across owners → triggers the submit/adopt flow (section 6, boundary crossing)
- Drag from personal → space = "submit as draft" (temporary share, no copy yet)
- UI should make it clear this is a submission, not a move

Uses the existing split-detail pane component from the template.

---

## 13. Implementation Phases

> **Priority lens:** Usage tooling + permission boundaries first. Systems invariants (delete safety,
> reconciliation, cross-scope semantics) before product features (search, previews, bulk UX).
> The goal is a workflow-first file system, not a generic Dropbox.

### Phase 1: Core — Storage + Permissions + Invariants

Models, upload/download, and the hard systems rules that everything else depends on.

- [ ] Prisma models (File, FileVersion, Folder, FilePermission, FileJob)
- [ ] S3 client service (system + user buckets) + NoopStorageClient
- [ ] Materialized path builder + traversal helpers
- [ ] System folder auto-creation hooks (org, space, org_user, user)
- [ ] Presigned POST upload + confirm flow
- [ ] Download with RBAC + ReBAC + ABAC permission check
- [ ] Permission inheritance via materialized path
- [ ] Basic FilePermissions (org, space, user roles)
- [ ] File + Folder module routes
- [ ] Permix integration (FileAction)
- [ ] Init script: Railway Bucket setup (2 buckets)
- [ ] Cross-owner copy vs move rules (same scope = move, cross scope = copy+new File)
- [ ] Duplicate/collision handling (policy: allow same name, ids are canonical)
- [ ] Delete/reference safety (cannot hard delete while bound or shared; soft delete only)
- [ ] Trash lifecycle (soft delete → retention window → orphan sweeper hard deletes)
- [ ] S3 reconciliation job (orphan sweeper + FileJob sweeper — section 16)
- [ ] File-specific audit events (upload, download, move, copy, share, delete, restore)
- [ ] `preserveOnRevoke` field on FilePermission (default true)
- [ ] `sourceFileId`, `snapshotAt`, `snapshotReason`, `snapshotBy` fields on File
- [ ] `__preserved/` system folder auto-creation (on first lazy copy or with scope creation)
- [ ] Lazy copy via unified FileJob (type: "lazyCopy", same table as moves)
- [ ] Lazy copy trigger on FilePermission revoke/expire and File soft-delete
- [ ] "Shared with me" virtual view query (FilePermission-based, folders + individual files)

### Phase 2: Usage Layer + Workflow Integration

ResourceBinding makes files useful in app workflows. This is the SaaS differentiator.

- [ ] ResourceBinding model (usage layer — section 3.4)
- [ ] ResourceBinding visibility (public/internal/unlisted)
- [ ] ResourceBinding repointing on lazy copy (bindings follow the snapshot)
- [ ] Cloudflare proxy for public files with caching + Cache-Tag purge
- [ ] Public URL invalidation (Cache-Tag purge on binding removal)
- [ ] Avatar/logo/banner upload → ResourceBinding (replace URL columns)
- [ ] Cross-scope submit/adopt flow (personal → org/space draft → promote)
- [ ] Update `transferSpace` handler with permission cascade (section 15)
- [ ] Audit downstream models for transfer cascade gaps

### Phase 3: DX & Discovery

Make it easy to find, share, and manage files at scale.

- [ ] Search & filtering (filename/title/description, type, owner, scope)
- [ ] Time-limited share links (FilePermission with expiresAt)
- [ ] Explicit org→space folder sharing UI
- [ ] Permission management UI (who has access, revoke)
- [ ] Versioning (browse/restore previous versions)
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
- User ID in S3 metadata for ownership verification via `HeadObject`
- Object tagging for lifecycle management
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
| S3 metadata for uploader | Carde S3 | Defense-in-depth ownership record |
| S3 object tagging | Carde S3 | Lifecycle rules, audit |
| ResourceImage (generalized) | Carde Prisma | ResourceBinding — usage layer with visibility |
| NoopAssetsClient | Zealot | NoopStorageClient for dev/testing |

---

## 15. Space Transfer Cascade Audit

Current handler (`apps/api/src/modules/inquiry/handlers/transferSpace/index.ts`) only updates `Space.organizationId`.

### Must update on transfer

| Model | Action | Rationale |
|-------|--------|-----------|
| **Space** | Update `organizationId` | Already done |
| **SpaceUser** | Update `organizationId` | Composite key includes orgId |
| **FilePermission** | Add Org permission for new org | New org admins need file access |
| **Token** (space-scoped) | Revoke | Old org's tokens shouldn't access new org's space |

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
| **File.organizationId** | Ownership is immutable — original org pays |

### Recommended implementation

```typescript
handleApprove: async (db, inquiry) => {
  const spaceId = inquiry.sourceSpaceId as SpaceId;
  const newOrgId = inquiry.targetOrganizationId as OrganizationId;

  await db.$transaction(async (tx) => {
    // 0. Capture old org before transfer
    const space = await tx.space.findUniqueOrThrow({ where: { id: spaceId } });
    const oldOrgId = space.organizationId;

    // 1. Transfer the space
    await tx.space.update({
      where: { id: spaceId },
      data: { organizationId: newOrgId },
    });

    // 2. Update SpaceUser orgIds
    await tx.spaceUser.updateMany({
      where: { spaceId },
      data: { organizationId: newOrgId },
    });

    // 3. Revoke old org's space-scoped tokens
    await tx.token.updateMany({
      where: { spaceId, isActive: true },
      data: { isActive: false },
    });

    // 4. Grant new org access to space files via folder-level permission
    // One permission on the space folder — inherits to all descendants
    const spaceFolder = await tx.folder.findFirst({
      where: { system: true, name: `space_${spaceId}` },
    });
    if (spaceFolder) {
      await tx.filePermission.upsert({
        where: {
          targetId_targetModel_granteeId_granteeModel: {
            targetId: spaceFolder.id,
            targetModel: 'Folder',
            granteeId: newOrgId,
            granteeModel: 'Organization',
          },
        },
        create: {
          targetId: spaceFolder.id,
          targetModel: 'Folder',
          granteeId: newOrgId,
          granteeModel: 'Organization',
          role: 'viewer',
          createdBy: inquiry.resolvedBy,
        },
        update: {},
      });

      // 5. Revoke old org's explicit FilePermission on space files
      await tx.filePermission.updateMany({
        where: {
          granteeId: oldOrgId,
          granteeModel: 'Organization',
          targetId: spaceFolder.id,
          targetModel: 'Folder',
          revokedAt: null,
        },
        data: { revokedAt: new Date(), revokedBy: inquiry.resolvedBy },
      });
    }
  });
};
```

---

## 16. Orphan Sweeper Service

S3 objects can become orphaned when moves fail partway, uploads are abandoned, or DB records are deleted without S3 cleanup. A background service catches these.

### What it sweeps

| Orphan type | Detection | Action |
|-------------|-----------|--------|
| **Stale pending uploads** | `File.status = "pending"` older than 1h | HEAD check → mark active or failed |
| **Failed uploads** | `File.status = "failed"` older than 24h | Hard delete DB record + S3 object |
| **Stalled file jobs** | `FileJob.done = false`, `updatedAt` older than 5m | Run `reconcileFileJob` — dispatches by type (idempotent) |
| **Failed file jobs** | `FileJob.done = false`, `error IS NOT NULL` | Alert for manual review; source key still works |
| **Move remnants** | S3 objects at old keys after completed moves | Cross-reference DB keys, delete unmatched |
| **Soft-deleted files past retention** | `File.deletedAt` older than retention period | Hard delete DB record + S3 object |
| **S3 objects with no DB record** | Periodic bucket scan vs File table | Quarantine (tag, don't delete immediately) → delete after grace period |

### Implementation sketch

```typescript
// Scheduled job — runs every hour (or cron)
async function sweepOrphans(db: PrismaClient, s3: S3Client) {
  // 1. Stale pending → verify or fail
  const stalePending = await db.file.findMany({
    where: { status: 'pending', createdAt: { lt: oneHourAgo() } },
  });
  for (const file of stalePending) {
    const exists = await headObject(s3, file.key);
    await db.file.update({
      where: { id: file.id },
      data: { status: exists ? 'active' : 'failed' },
    });
  }

  // 2. Failed → hard delete
  const failed = await db.file.findMany({
    where: { status: 'failed', createdAt: { lt: oneDayAgo() } },
  });
  for (const file of failed) {
    await deleteObject(s3, file.key);
    await db.file.delete({ where: { id: file.id } });
  }

  // 3. Soft-deleted past retention → hard delete (only if no active references)
  const expired = await db.file.findMany({
    where: { deletedAt: { lt: retentionCutoff() } },
  });
  for (const file of expired) {
    const hasRefs = await db.filePermission.count({ where: { targetId: file.id } });
    // v2: also check ResourceBinding references
    if (hasRefs > 0) continue; // skip — still referenced, clean up refs first
    await deleteObject(s3, file.key);
    await db.file.delete({ where: { id: file.id } });
  }
}
```

### Move remnant detection

Each file move creates a `FileMoveJob` with `oldKey`/`newKey`. The reconciler (`reconcileMoveJob`) is the primary cleanup mechanism — it copies bytes, swaps the DB key, and deletes the old S3 object. If the reconciler completes successfully, no remnants exist.

If the reconciler fails partway (e.g., S3 copy succeeded but DB update didn't), the sweeper retries stalled jobs (`done = false`, `updatedAt` older than 5m) by re-running `reconcileMoveJob`, which is fully idempotent — it checks actual S3 and DB state, not flags.

For edge cases where both BullMQ and the sweeper miss a job (extremely unlikely), the periodic bucket scan catches S3 objects at old keys with no matching DB record. These are quarantined (tagged, not deleted) and hard-deleted after a 7-day grace period.

### Configuration

| Setting | Default | Notes |
|---------|---------|-------|
| Pending timeout | 1 hour | HEAD check after this |
| Failed cleanup | 24 hours | Hard delete after this |
| Soft-delete retention | TBD (30d? 90d?) | See open decisions |
| Orphan quarantine grace | 7 days | Don't delete immediately in case of race |
| Sweep interval | Hourly | Cron job |

---

## 17. Follow-Up Tickets

> **When Phase 1 is complete**, break these out into individual tickets. They're documented here
> so the design accounts for them, but none are blockers for the core file system.

### Versioning & Replace Semantics

When a file is "replaced" (e.g., new logo upload), should the File record stay the same with new bytes, or create a new File? Matters for:
- **ResourceBinding stability** — if bindings point to fileId, replacement should keep the id
- **Audit/history** — previous versions should be recoverable
- **Cache invalidation** — CDN needs to know the content changed

Likely design: `File.version` counter + old S3 keys kept with version suffix (`file_{id}/v1/logo.png`, `file_{id}/v2/logo.png`). Current version is the canonical key. Previous versions are accessible but not default.

**Versioning interacts with FilePermission and lazy copy:**
- `FilePermission.fromVersion` controls which versions a grantee can access (1 = all, N = from version N onward)
- Lazy copy duplicates all versions within the grantee's version scope, not just the current version
- This prevents the sharer from replacing content with a blank file before revoking to leave the grantee with nothing

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
- Stored in same bucket, different key pattern (`file_{id}/__derivatives/thumb_256.webp`)
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
| `file.lazy_copied` | sourceFileId, newFileId, reason, snapshotBy, dependentId |
| `file.binding_repointed` | bindingId, oldFileId, newFileId, reason |

### Public URL Invalidation

When a ResourceBinding visibility changes from `public` to `internal`, or a binding is deleted:
- Cloudflare Cache-Tag purge on `file-{fileId}` — immediate (< 300ms global propagation)
- Presigned GET URLs expire naturally (15 min TTL)
- The stable public URL (`/public/files/:id`) starts returning 404 immediately after binding removal
- Edge case: if Cloudflare cache hasn't purged yet, stale content may be served briefly. Acceptable for most use cases; for sensitive content, consider `Cache-Control: no-store` on the binding.

### Quota & Accounting

Storage billing questions that need answers before pricing:
- Do cross-scope copies count toward both the source and destination owner's quota?
- Do derivatives (thumbnails, previews) count toward quota?
- Who pays for shared files? The storage owner (uploader's scope), not the viewer.
- Quota enforcement point: at presign time (reject before upload) or at confirm time (reject after)?
- Recommendation: enforce at presign (fail fast), with a grace buffer for in-flight uploads.

---

## Reference

- S3 type stubs: `apps/api/src/types/optionalDeps.d.ts`
- Transfer handler: `apps/api/src/modules/inquiry/handlers/transferSpace/index.ts`
- Permissions client: `packages/permissions/src/client.ts`
- Carde Image model: `~/Carde.io/organized-play-api/src/db/postgres/prisma/models/Image.part.prisma`
- Carde ResourceImage: `~/Carde.io/organized-play-api/src/db/postgres/prisma/models/ResourceImage.part.prisma`
- Carde S3 presign: `~/Carde.io/organized-play-api/src/app/manage/inquiries/services/s3objects.ts`
- Zealot NoopClient: `~/Desktop/UserEvidence/Zealot-Backend/src/plugins/assets/NoopAssetsClient.ts`
