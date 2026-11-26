# FEAT-029: File Storage, Upload/Download & FileVersion Lifecycle

> **Status:** Open (split from `tickets/FEAT-009-file-management.md`)
> **Depends on:** `tickets/FEAT-009-file-management.md` (Artifact graph & permissions), `tickets/INFRA-011-railway-buckets.md`, `tickets/INFRA-010-cloudflare-waf-and-asset-serving.md`

## Scope

Wire physical object storage onto the `File` / `FileVersion` tables introduced in `FEAT-009`:

- **Storage adapter wiring:** system + user buckets (flat object keys), `NoopStorageClient` for dev/test via `makeAdapterRouter`, Railway bucket setup in `init/`.
- **Upload flow (Presigned POST):** `POST /artifact` (file kind) / `POST /file/:id/versions` returns presigned POST fields (`status: pending`), followed by a confirm endpoint that HEAD-verifies size/content-type/checksum and flips `FileVersion.status` to `active`.
- **FileVersion lifecycle:** `pending → active → purging → purged | failed`; current version = highest `active`; revert = new version reusing a prior object key (refcounted).
- **Authenticated download:** presigned GET URL gated on `db:Artifact` `read`.
- **Public serving:** Cloudflare proxy + Cache-Tag purge driven by materialized `Artifact.effectiveReadAccess === 'public'` (`INFRA-010`).
- **Multipart / resumable uploads & SHA-256 content checksums** on confirm.
- **File audit events:** upload, confirm, download, revert.
