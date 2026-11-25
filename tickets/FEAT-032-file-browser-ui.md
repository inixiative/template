# FEAT-032: File Browser & Sharing UI

> **Status:** Open (split from `tickets/FEAT-009-file-management.md`)
> **Depends on:** `tickets/FEAT-009-file-management.md`, `tickets/FEAT-029-file-storage-and-versioning.md`

## Scope

Frontend file management and sharing experience built on the `Artifact`, `ArtifactPlacement`, and `ArtifactPermission` APIs:

- **Split-pane file browser:** owner root view (`GET /{owner}/artifacts`), folder navigation (`GET /artifact/:id` 1-step `parents` + `children`), pinned/placed items view (`GET /{owner}/artifactPlacements` + root pin `POST /{owner}/artifactPlacements`), and pinned **"Shared with me"** view (`GET /{owner}/artifactPermissions`) with place-into-folder, pin-at-root, and leave-share actions.
- **Inline hover permission/visibility toggle:** quick hover control on each artifact row to switch visibility (`inherit` / `private` / `tenant` / `public`) via `PATCH /artifact/:id` and open a lightweight permissions popover (`POST/PATCH/DELETE /artifactPermission`).
- **Search & filtering:** global search (`?search=...` / `searchFields` via `filterLens`), sorting, pagination.
- **Sharing & permissions UI:** grant/update/revoke `ArtifactPermission`s (including `expiresAt`, `preserveOnRevoke`, `fromVersion`), access mode toggle (`inherit` / `private` / `tenant` / `public`), and ownership transfer (`transferArtifact` Inquiry).
- **Uploads, versions & previews:** presigned upload dropzone, version history/restore UI, metadata extraction & thumbnail/preview derivatives, bulk move/delete (using `exclusive` children + `/v1/batch`), notifications, and storage quotas.
