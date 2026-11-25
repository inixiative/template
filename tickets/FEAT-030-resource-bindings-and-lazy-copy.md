# FEAT-030: ResourceBindings, Lazy Copy (Copy-on-Revoke) & Orphan Sweeper

> **Status:** Open (split from `tickets/FEAT-009-file-management.md`)
> **Depends on:** `tickets/FEAT-009-file-management.md`, `tickets/FEAT-029-file-storage-and-versioning.md`

## Scope

Build the usage layer (`ResourceBinding`), copy-on-revoke protection, and background sweeper on top of the schema columns landed in `FEAT-009` (`ResourceBinding`, `ArtifactPermission.preserveOnRevoke`, `ArtifactPermission.fromVersion`, `File.sourceFileId`):

- **ResourceBinding routes & invariants:** bind/unbind an artifact to a `User`, `Organization`, `Space`, or `CustomerRelationship` (`logo`, `avatar`, `banner`, `tracking`, etc. via `packages/shared/src/resourceBinding/registry.ts`); enforce `cardinality`, `accepts`, and `requiresPublic`; wire `removeAllBindings` on resource delete.
- **Workflow integration:** replace URL columns for avatars/logos/banners with `ResourceBinding`s.
- **Lazy copy (copy-on-revoke):** when a grant is revoked (or source artifact deleted) and either an active `ResourceBinding` depends on it or `preserveOnRevoke = true`, fork a snapshot `Artifact` + `File` (`sourceFileId` pointing to original) with pending `FileVersion`s `>= fromVersion`, owned by the grantee, and repoint dependent `ResourceBinding`s.
- **Single `FileVersion.status` sweeper:** background job handling stale `pending` uploads, copying bytes for pending lazy-copy snapshots, and purging unreferenced deleted objects (`refcount === 0` after retention).
- **Space transfer cascade:** update `transferSpace` with artifact grant cascade and per-dependent binding disposition (`FEAT-009` §15).
- **Cross-scope submit/adopt workflow:** personal draft → org/space submission → promote.
