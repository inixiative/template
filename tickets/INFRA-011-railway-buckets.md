# INFRA-011: Railway Buckets + S3 Storage Adapter

**Status**: 🚧 In Progress
**Priority**: Medium
**Created**: 2026-05-26
**Dependencies**: INFRA-001 (init script), INFRA-009 (adapter primitives)
**Blocks**: FEAT-009 Phase 1 (file management)

---

## 1. Overview

Set up the storage foundation that FEAT-009 (file management) will sit on top of. Two parts:

1. **Bucket provisioning** — Railway Buckets for preview/staging/prod, MinIO for local dev + tests
2. **One S3 storage adapter** — uses `@aws-sdk/client-s3` against any S3-compatible endpoint (Railway, MinIO, AWS, R2, GCS, B2). Provider choice = config, not code.

Scope is the storage *primitive*. File model, permissions, materialized paths, ResourceBinding — all FEAT-009 concerns. This ticket only delivers "bytes can go in, bytes can come out, in every environment."

---

## 2. Core decisions

### One adapter, configured per environment

S3 is the universal storage wire protocol. R2, GCS, MinIO, Railway, AWS S3, Backblaze B2 all speak it. The adapter pattern collapses to **one implementation** parameterized by endpoint + credentials.

A second adapter only becomes necessary if the template ever needs a non-S3 backend (Azure Blob, IPFS, local filesystem). That's a fork's problem, not a v1 concern.

### No `local` or `noop` adapters

Earlier design considered filesystem (`local`) and in-memory stub (`noop`) drivers. Both rejected:

| Driver | Why dropped |
|---|---|
| `local` (filesystem) | Solving "develop without docker" — but the template already needs docker for Postgres, Redis, MinIO. Nobody runs this without docker. |
| `noop` (in-memory) | "Production adapter that lies." Mocks belong at the **interface level** (`vi.mock()` of `StorageClient`), not as a registered adapter where production code could accidentally select it. |

Result: ~300 lines of dev-route code, multipart parsers, HMAC dev-signing, and boot guards never get written. ~30 lines of MinIO docker compose config replaces them.

### MinIO for local dev + tests

Same S3 wire protocol as production. Same SDK. Same code path. Dev/prod fidelity is essentially perfect — the only differences are endpoint URL and credentials.

### Frontend is storage-agnostic

The FE has ONE upload hook (`useFileUpload`) that implements the presign → upload → confirm protocol. It does not know which driver is active. It just POSTs to whatever `uploadUrl` the server returned. This is the whole point of the adapter pattern — never leak implementation choice across boundaries.

---

## 3. Adapter architecture

Follows the **Option β pattern** used by `email/client/` and (after refactor) `errorReporter/`:

- Root file (`storage/index.ts`) is the **adapter** — uses `makeAdapterRouter` from `@template/shared/adapter` for env-keyed selection.
- Providers live in a `client/` subfolder, one file per provider.
- The interface (`StorageClient`) is in `types.ts` at the module root — provider-agnostic.

### Module layout

```
apps/api/src/lib/storage/
├── index.ts              # env reads + makeAdapterRouter → exports `storage`
├── types.ts              # StorageClient interface, Bucket, all input/output types
└── client/
    └── s3.ts             # createS3Client(config) — implements StorageClient via @aws-sdk/client-s3
                          # Module-level singleton: __client cached on first call
```

Future providers (Azure Blob, GCS-native if ever needed) drop in as `client/azureBlob.ts`, `client/gcs.ts` — same pattern.

### Interface

```typescript
export type Bucket = 'system' | 'user';

export type StorageClient = {
  presignPost: (input: PresignPostInput) => Promise<PresignPostResult>;
  presignGet: (input: PresignGetInput) => Promise<PresignGetResult>;
  headObject: (input: HeadObjectInput) => Promise<HeadObjectResult | null>;
  copyObject: (input: CopyObjectInput) => Promise<void>;
  deleteObject: (input: DeleteObjectInput) => Promise<void>;
  tagObject: (input: TagObjectInput) => Promise<void>;
};
```

Every input carries `bucket: Bucket` so a single adapter instance handles both `system` and `user` buckets. Cross-bucket ops (`copyObject` with `sourceBucket: 'system'`, `targetBucket: 'user'`) are trivial.

### Adapter wiring (`storage/index.ts`)

```typescript
import { makeAdapterRouter } from '@template/shared/adapter';
import { createS3Client } from '#/lib/storage/client/s3';
import type { StorageClient } from '#/lib/storage/types';

const required = (name: string): string => {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required env var: ${name}`);
  return value;
};

const s3 = createS3Client({
  endpoint: required('STORAGE_ENDPOINT'),
  region: required('STORAGE_REGION'),
  accessKeyId: required('STORAGE_ACCESS_KEY_ID'),
  secretAccessKey: required('STORAGE_SECRET_ACCESS_KEY'),
  forcePathStyle: process.env.STORAGE_FORCE_PATH_STYLE === 'true',
  buckets: {
    system: required('STORAGE_BUCKET_SYSTEM'),
    user: required('STORAGE_BUCKET_USER'),
  },
});

export const storage = makeAdapterRouter<StorageClient>({
  default: s3,
});
```

All envs route to the same S3 client today (config differs per env via env vars). The `makeAdapterRouter` seam exists so env-divergent provider selection becomes a one-line change later (e.g., `test: noopStorage`) without touching application code.

### Convention rule

**Every adapter-pattern module in this codebase uses `makeAdapterRouter` at the root**, not a direct client export. Same shape as `errorReporter/index.ts`. Use `makeBroadcastRegistry` only when fan-out across multiple providers is needed (e.g., messaging across channels) — storage is pick-one-per-env, not fan-out.

---

## 4. Two buckets per environment

| Bucket | Purpose | Ownership |
|---|---|---|
| **system** | Platform assets — default avatars, email templates, branding | Platform |
| **user** | All user/org/space uploaded content | Tenant |

Different lifecycle, different access patterns, different deletion rules. Don't merge.

| Environment | System bucket | User bucket |
|---|---|---|
| Local (slot 0 / main) | `${PROJECT_NAME}-system` | `${PROJECT_NAME}-user` |
| Local (slot N worktree) | `${PROJECT_NAME}-system-wt-${SLOT}` | `${PROJECT_NAME}-user-wt-${SLOT}` |
| Test (slot 0 / main) | `${PROJECT_NAME}-system-test` | `${PROJECT_NAME}-user-test` |
| Test (slot N worktree) | `${PROJECT_NAME}-system-test-wt-${SLOT}` | `${PROJECT_NAME}-user-test-wt-${SLOT}` |
| Preview | `${PROJECT_NAME}-system-preview-${PR}` | `${PROJECT_NAME}-user-preview-${PR}` |
| Staging | `${PROJECT_NAME}-system-staging` | `${PROJECT_NAME}-user-staging` |
| Production | `${PROJECT_NAME}-system-prod` | `${PROJECT_NAME}-user-prod` |

Naming is uniform: `{system|user}` + env suffix. No special cases.

---

## 5. Access policy split (route layer, not adapter)

The two buckets have fundamentally different access patterns. The adapter stays **mechanical** — it signs URLs and talks to S3. **Policy is enforced at the route layer** where permix is already wired.

### Comparison

| | System bucket | User bucket |
|---|---|---|
| **Who writes** | Platform / superadmin only | Authenticated users (permission-gated) |
| **Who reads** | Effectively public (anonymous OK) | Permission-gated by default; public exposure via ResourceBinding |
| **Key shape** | Curated paths: `defaults/`, `email/`, `branding/`, `templates/` | Materialized paths: `org_{id}/...`, `user_{id}/...` |
| **Lifecycle** | Long-lived, version-controlled, rare changes | Active, frequently changing, deleted with orgs |
| **PII risk** | None — pure platform assets | High — tenant data, strict boundaries |
| **CDN strategy** | Aggressive cache, stable URLs | Cache-tagged, purgeable, ResourceBinding-driven |

### Why writes to system must be superadmin-only

System bucket holds assets that apply to **all tenants**. A regular user writing to system would be a privilege escalation — their file becomes everyone's default avatar / email header / brand asset. No legitimate non-superadmin use case.

### Why reads to system should be effectively public

System assets are referenced from public marketing pages, login flows (pre-auth), email recipients (anonymous), and default-avatar contexts (shown to logged-out users). Forcing presigned GETs is the wrong shape — no PII to protect, want CDN caching, want stable URLs.

### Why the adapter stays mechanical

Mixing auth concerns into the adapter couples them. Different upload flows have different auth needs:

- User upload flow → permission check
- Superadmin admin UI → role check
- Deployment seeding → no user context
- Worker job → service-account context

The adapter is a transport — it just signs URLs and talks to S3. The API route layer is the right gate for policy, mirroring how `Db` doesn't know about permissions (permix does, above it).

### Route mapping (planned in FEAT-009, captured here for completeness)

```
POST   /files/presign           → bucket: 'user'   → authenticated user + permix check
POST   /system/presign          → bucket: 'system' → superadmin only
GET    /files/:id/download      → bucket: 'user'   → permission check, 302 to presigned GET (15 min)
GET    /public/system/:key      → bucket: 'system' → NO auth, 302 to presigned GET (1h), aggressive cache headers
GET    /public/files/:id        → bucket: 'user'   → ResourceBinding visibility check
```

The adapter is **one consistent surface**; the API exposes **two distinct policy surfaces**.

### Implications for v1 (this ticket)

- **Adapter (§3)**: unchanged. Just `bucket: 'system' | 'user'` in input, no auth knowledge inside.
- **FEAT-009 routes** (downstream): separate prefixes, separate middleware stacks per bucket.
- **MinIO + Railway bucket policies**: stay private at the S3 level. Public exposure is via API + Cloudflare, not S3 bucket policies. Same model in prod and dev.

---

## 6. Local: MinIO via docker compose

### Compose service

Add to `docker-compose.yml`:

```yaml
minio:
  container_name: ${PROJECT_NAME}_minio
  image: minio/minio:latest
  ports:
    - "9000:9000"   # S3 API
    - "9001:9001"   # Web console (dev convenience)
  environment:
    MINIO_ROOT_USER: minioadmin
    MINIO_ROOT_PASSWORD: minioadmin
  volumes:
    - minio_data:/data
  command: server /data --console-address ":9001"
  healthcheck:
    test: ["CMD", "mc", "ready", "local"]
    interval: 5s
    timeout: 3s
    retries: 5

mc-init:
  container_name: ${PROJECT_NAME}_mc_init
  image: minio/mc:latest
  depends_on:
    minio:
      condition: service_healthy
  entrypoint: >
    sh -c "
      mc alias set local http://minio:9000 minioadmin minioadmin &&
      echo 'mc alias configured'
    "
  restart: "no"

volumes:
  minio_data:
```

One MinIO container, one shared port. Per-slot isolation via bucket naming (see §6).

### Default credentials

Local dev only — `minioadmin`/`minioadmin`. Documented as such, not a secret. Real credentials are Railway env vars, never committed.

---

## 7. Worktree integration

Mirrors the existing slot pattern in `scripts/worktree/create.sh` (Postgres DBs, Redis logical DBs).

### Slot-derived bucket names

After the existing slot block (`create.sh` ~line 121):

```bash
STORAGE_BUCKET_SYSTEM="${PROJECT_NAME}-system-wt-${SLOT}"
STORAGE_BUCKET_USER="${PROJECT_NAME}-user-wt-${SLOT}"
STORAGE_BUCKET_SYSTEM_TEST="${PROJECT_NAME}-system-test-wt-${SLOT}"
STORAGE_BUCKET_USER_TEST="${PROJECT_NAME}-user-test-wt-${SLOT}"
```

### Env file rewrites

Parallel to the DATABASE_URL block (`create.sh` ~line 163-166):

```bash
# .env.local
sedi "s|^STORAGE_BUCKET_SYSTEM=.*|STORAGE_BUCKET_SYSTEM=${STORAGE_BUCKET_SYSTEM}|" "$WT_ENV"
sedi "s|^STORAGE_BUCKET_USER=.*|STORAGE_BUCKET_USER=${STORAGE_BUCKET_USER}|"       "$WT_ENV"

# .env.test
sedi "s|^STORAGE_BUCKET_SYSTEM=.*|STORAGE_BUCKET_SYSTEM=${STORAGE_BUCKET_SYSTEM_TEST}|" "$WT_TEST_ENV"
sedi "s|^STORAGE_BUCKET_USER=.*|STORAGE_BUCKET_USER=${STORAGE_BUCKET_USER_TEST}|"       "$WT_TEST_ENV"
```

### Bucket creation step

After the Postgres database creation block (`create.sh` ~section 6):

```bash
MINIO_CONTAINER="${PROJECT_NAME}_minio"
echo -e "${BLUE}Creating MinIO buckets on $MINIO_CONTAINER...${NC}"
if docker ps --format '{{.Names}}' | grep -qx "$MINIO_CONTAINER"; then
  for BUCKET in "$STORAGE_BUCKET_SYSTEM" "$STORAGE_BUCKET_USER" \
                 "$STORAGE_BUCKET_SYSTEM_TEST" "$STORAGE_BUCKET_USER_TEST"; do
    docker exec "$MINIO_CONTAINER" mc mb --ignore-existing "local/${BUCKET}"
  done
  echo -e "${GREEN}Created: 4 buckets for slot ${SLOT}${NC}"
else
  echo -e "${YELLOW}Warning: $MINIO_CONTAINER not running — skipping bucket creation.${NC}"
fi
```

### Destroy script mirror

In `scripts/worktree/destroy.sh`, parallel to the DB drop block:

```bash
for BUCKET in "$STORAGE_BUCKET_SYSTEM" "$STORAGE_BUCKET_USER" \
               "$STORAGE_BUCKET_SYSTEM_TEST" "$STORAGE_BUCKET_USER_TEST"; do
  docker exec "$MINIO_CONTAINER" mc rb --force "local/${BUCKET}" || true
done
```

---

## 8. Env var contract

### `.env.local.example` (committed)

```bash
# Storage (local dev — MinIO via docker compose)
STORAGE_ENDPOINT=http://localhost:9000
STORAGE_REGION=us-east-1
STORAGE_ACCESS_KEY_ID=minioadmin
STORAGE_SECRET_ACCESS_KEY=minioadmin
STORAGE_FORCE_PATH_STYLE=true
STORAGE_BUCKET_SYSTEM=${PROJECT_NAME}-system
STORAGE_BUCKET_USER=${PROJECT_NAME}-user
```

### `.env.test.example` (committed)

```bash
STORAGE_ENDPOINT=http://localhost:9000
STORAGE_REGION=us-east-1
STORAGE_ACCESS_KEY_ID=minioadmin
STORAGE_SECRET_ACCESS_KEY=minioadmin
STORAGE_FORCE_PATH_STYLE=true
STORAGE_BUCKET_SYSTEM=${PROJECT_NAME}-system-test
STORAGE_BUCKET_USER=${PROJECT_NAME}-user-test
```

### Railway (preview/staging/prod)

`STORAGE_ENDPOINT` points at Railway Buckets endpoint, credentials are Railway-issued service account keys, `STORAGE_FORCE_PATH_STYLE=false` (Railway uses subdomain-style like AWS).

---

## 9. Init script integration (INFRA-001)

The init wizard has a dedicated `Railway Buckets Setup` action (sibling to `Railway Postgres Setup`), implemented in:

- `init/tasks/railwayBucketsSetup.ts` — task logic
- `init/tasks/railwayBucketsSteps.ts` — progress summary groups
- `init/views/RailwayBucketsSetupView.tsx` — TUI view
- `init/api/railway.ts` — `getProjectBuckets`, `ensureBucket`, `createBucket`, `getBucketCredentials` methods
- `init/utils/getProjectConfig.ts` + `init/utils/progressTracking.ts` — config schema + progress action types

### Provisioning is fully automated via Railway's GraphQL API

Railway's **official docs** say Buckets are UI-provisioned only (their `/guides/storage-buckets` page). The CLI also doesn't support buckets — `railway add` only handles `postgres | mysql | redis | mongo`.

**However**, Railway's GraphQL API (downloadable collection at `https://gql-collection-server.up.railway.app/railway_graphql_collection.json`) exposes a full bucket lifecycle:

| Operation | What it does |
|---|---|
| `mutation bucketCreate(input: BucketCreateInput!)` | Creates a project-level bucket |
| `mutation bucketUpdate(id, input)` | Renames a bucket |
| `mutation bucketCredentialsReset(bucketId, environmentId, projectId)` | Rotates S3 credentials |
| `query bucketS3Credentials(bucketId, environmentId, projectId)` | Returns `{ accessKeyId, bucketName, endpoint, region, secretAccessKey, urlStyle }` per environment |
| `query project($id) { buckets { id name } }` | Lists existing buckets (for idempotency) |

These are not officially documented but are publicly accessible in Railway's API collection. **They could change without notice** — if they break, the fallback is manual provisioning + credential entry.

### Bucket lifecycle model

- Buckets are **project-level** (one bucket exists across all environments)
- Credentials are **per-environment** (different `accessKeyId/secretAccessKey` for prod vs staging)
- This template creates 4 buckets for full segregation: `${project}-prod-system`, `${project}-prod-user`, `${project}-staging-system`, `${project}-staging-user`. Each gets its own per-env credentials.

### User-facing flow

1. User selects "Railway Buckets Setup" from the init wizard.
2. The task lists existing buckets via `project.buckets` query.
3. For each missing bucket (system + user × prod + staging-if-enabled), calls `bucketCreate(input: { projectId, name })`.
4. Fetches per-environment credentials via `bucketS3Credentials(bucketId, environmentId, projectId)`.
5. Writes `STORAGE_*` secrets to **Infisical** at `/api` for the matching environment.

No manual Railway UI steps. The user just runs the init task.

### Secrets manager: Infisical, not Doppler

The init script uses Infisical (`init/tasks/infisicalSetup.ts`) as the cloud secrets manager. Earlier drafts of this ticket said "Doppler" — that was incorrect. All env writes go through `setSecretAsync(infisicalProjectId, environment, key, value, '/api')`.

### Validation

Post-store HEAD check is currently deferred (would call the storage adapter against the Railway endpoint with the just-stored credentials). Not yet implemented — fail-loud happens at first upload from the deployed app instead.

---

## 10. Test strategy

### Unit tests
Mock `StorageClient` interface at the import boundary via `vi.mock()`. No real I/O. Fast.

### Integration tests
Real MinIO via the test bucket pair (`${PROJECT_NAME}-system-test-wt-${SLOT}`, `${PROJECT_NAME}-user-test-wt-${SLOT}`). Each test file's `beforeAll` creates a unique key prefix (e.g., `${testRunId}/${testFileName}/...`). `afterAll` deletes the prefix.

Cross-test isolation is enforced by **prefix uniqueness**, not by bucket recreation — bucket creation is too slow for per-test cycles.

### CI
MinIO as a GitHub Actions service container:

```yaml
services:
  minio:
    image: minio/minio:latest
    env:
      MINIO_ROOT_USER: minioadmin
      MINIO_ROOT_PASSWORD: minioadmin
    ports:
      - 9000:9000
    options: >-
      --health-cmd "curl -f http://localhost:9000/minio/health/live"
      --health-interval 5s
      --health-timeout 3s
      --health-retries 5
```

Plus a setup step to create the CI test buckets before tests run.

---

## 11. Implementation phases

### Phase 1 — Local dev + tests (does not require Railway)

- [x] Add MinIO + mc-init services to `docker-compose.yml`
- [x] Add `STORAGE_*` vars to `.env.local.example` and `.env.test.example`
- [x] Define `StorageClient` interface in `apps/api/src/lib/storage/types.ts`
- [x] Implement `createS3Client(config)` in `apps/api/src/lib/storage/client/s3.ts` using `@aws-sdk/client-s3`
- [x] Wire `storage/index.ts` with env reads + `makeAdapterRouter`
- [x] Refactor `errorReporter/` to Option β (providers under `client/`, `create*` naming) — pattern parity
- [x] `mc-init` auto-creates slot-0 buckets via compose (no separate `bun run setup` step needed)
- [x] Update `scripts/worktree/create.sh` — slot-derived bucket vars + creation block
- [x] Update `scripts/worktree/destroy.sh` — bucket teardown block
- [x] Adapter smoke integration test against MinIO (5 tests covering presignPost, presignGet, headObject null+hit, copyObject, deleteObject, tagObject, size-limit enforcement)

### Phase 2 — Railway provisioning (depends on INFRA-001)

- [x] Add `railwayBuckets` config schema (`init/utils/getProjectConfig.ts`)
- [x] Add `RailwayBucketsAction` progress types (`init/utils/progressTracking.ts`)
- [x] Add bucket detection + credential fetch methods to `railwayApi` (`init/api/railway.ts`)
- [x] `railwayBucketsSetup.ts` task — detect bucket services, capture credentials, write to Infisical
- [x] `railwayBucketsSteps.ts` — progress summaries (mirrors `railwayPostgresSteps.ts`)
- [x] `RailwayBucketsSetupView.tsx` — TUI view with manual-creation instructions
- [x] Wire into `init/app.tsx` + `init/views/MainMenu.tsx`
- [x] Infisical writes for `STORAGE_*` per environment (`/api` folder)
- [ ] Post-provision validation (HEAD check from init script)
- [ ] CI integration (MinIO service container in GitHub Actions)

### Phase 3 — Hardening

- [ ] Connection pooling / SDK retry policy review
- [ ] Observability — emit storage operation timings to logger
- [ ] Error mapping — bucket errors → application error types
- [ ] Bucket policy review (CORS for direct-upload origins, lifecycle rules)

---

## 12. Out of scope (FEAT-009 concerns)

This ticket explicitly does NOT cover:

- `File`, `Folder`, `FilePermission`, `ResourceBinding`, `FileJob` Prisma models
- Materialized path computation + traversal
- ABAC/ReBAC permission resolution
- System folder auto-creation hooks
- Lazy copy on revoke
- `useFileUpload` hook on the FE (lives with FEAT-009 Phase 1)
- Orphan sweeper / FileJob reconciliation
- Cloudflare proxy for public file serving

FEAT-009 imports `StorageClient` from this module and builds the application layer on top.

---

## 13. References

- INFRA-001 (Init Script) — owns the Railway provisioning wizard
- INFRA-009 (Adapter Primitives) — provides `makeAdapterRouter`/`makeAdapterRegistry` if multi-adapter ever needed
- FEAT-009 §11 (File Management — Infrastructure) — downstream consumer
- `scripts/worktree/create.sh` — slot pattern this ticket mirrors
- `scripts/worktree/destroy.sh` — teardown counterpart
- `docker-compose.yml` — where MinIO service lives
