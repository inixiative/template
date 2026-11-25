# FEAT-032: File Browser & Sharing UI

> **Status:** Open (split from `tickets/FEAT-009-file-management.md`)
> **Depends on:** `tickets/FEAT-009-file-management.md`, `tickets/FEAT-029-file-storage-and-versioning.md`

## Scope

Frontend file management and sharing experience built on the `Artifact` + `ArtifactPermission` APIs:

- **Split-pane file browser:** owner root view (`GET /{owner}/artifacts`), folder navigation (`GET /artifact/:id` 1-step `parents` + `children`), and pinned **"Shared with me"** view (`GET /{owner}/artifactPermissions`) with place-into-folder and leave-share actions.
- **Search & filtering:** global search (`?search=...` / `searchFields` via `filterLens`), sorting, pagination.
- **Sharing & permissions UI:** grant/update/revoke `ArtifactPermission`s (including `expiresAt`, `preserveOnRevoke`, `fromVersion`), access mode toggle (`inherit` / `public` / `private`), and ownership transfer (`transferArtifact` Inquiry).
- **Uploads, versions & previews:** presigned upload dropzone, version history/restore UI, metadata extraction & thumbnail/preview derivatives, bulk move/delete (using `exclusive` children + `/v1/batch`), notifications, and storage quotas.
