# FEAT-013: Encryption

**Status**: 📋 Planned, parked as tier 2 (Aron 2026-11-27: "It's important, but it's not blocking")
**Assignee**: TBD
**Priority**: High
**Created**: 2026-03-02
**Updated**: 2026-11-27

---

## Decided plan (2026-11-27): KMS-wrapped data keys inside the existing engine

Rulings: R-2026-11-27-02 (AWS KMS inside the existing engine, template first, Kingdom after the PR is approved) and R-2026-11-27-03 (init may overwrite behind a double confirmation), in `~/code/inixiative/rulings/2026-11.md`. The plan below survived two rounds of four-pass adversarial review on 2026-11-27. It supersedes the escrow options table and the "Recommended approach" further down, which are kept for history.

### Why

Each keyring is three raw env vars (`{PREFIX}_ENCRYPTION_VERSION / _KEY_CURRENT / _KEY_PREVIOUS`) in Infisical `/api`. Anyone who reads the app's env holds every key for good. One deleted or overwritten Infisical secret loses every row under it. Only two versions can exist at once, and rotation is hand-edited env vars that have never run end to end. Aron wants every version kept, keys hard to delete by accident, and no second encryption system ("We already have a normal encryption system. Why would we build a second one?").

### What changes

Only where data keys come from. AES-256-GCM per field, `ENCRYPTED_MODELS`, the three columns, AAD, `encryptField` / `decryptField` and the rotation job all stay.

- **Storage.** Data keys become rows in a new append-only `EncryptionKey` table: `{ keyringName, version, wrappedDataKey, wrappingKeyId }`, unique on `(keyringName, version)`. Each one is wrapped by an AWS KMS key that never leaves AWS. The KMS encryption context is `{ keyringName, version, wrappingKeyId }`.
- **Read path.** `encryptionKeyringFromEnvironment` (`fieldEncryption.ts`) becomes `fetchEncryptionKeyring(keyringName)`. It unwraps through KMS and caches the plaintext in process memory only (`ENCRYPTION_KEYRING_CACHE_TTL_MS`). It unwraps only versions it doesn't hold yet, in parallel, with one in-flight promise shared by concurrent callers. Decrypt accepts any version, so the two-version limit goes.
- **Current version.** Encrypt reads the current version number through the existing Redis cache with clear-on-write. Only numbers go to Redis, never key material.
- **Wrapping-key client.** Chosen by `resolveAdapterForEnvironmentOrThrow`: AWS KMS for pr, staging and prod, and a local wrapping key (`ENCRYPTION_LOCAL_WRAPPING_KEY`, composing `makeEncryptionService`) for local and test. In test the local client derives data keys deterministically from `(keyringName, version)`, so table cleanup can't make parallel processes disagree. Deployed environments refuse a local `wrappingKeyId`, both at boot and on every row.
- **First version.** v1 is created by an upsert on the unique key the first time a keyring is fetched. There is no boot step and no lock.
- **Write guard.** A create must use the same `wrappingKeyId` as the keyring's existing rows, so a staging app pointed at the prod database can't write there.
- **Rotation.** A superadmin admin create on `encryptionKey` (`createRoute({ admin: true })`, controller `encryptionKeyCreate`, body `{ keyringName }`) writes v(n+1). `EncryptionKey` is in `AUDIT_ENABLED_MODELS`, so the actor is recorded. An afterCreate hook enqueues `rotateEncryptionKeys`. The job reads the current version fresh, re-encrypts every row with a version below it at exactly that version, and loops until none remain.
- **Protection.** `EncryptionKey` joins `APPEND_ONLY_MODELS` (`apps/api/src/hooks/preventHardDelete/hook.ts`), and that hook gains an update refusal for it.
- **Cutover.** A one-off release step imports each prefix's current `CURRENT` / `PREVIOUS` env key as a wrapped row at its existing version number. The env vars are then deleted, and the step is removed after the deploy. Without it every existing row (Jwks signing keys, TOTP, AuthProvider secrets, Kingdom credentials) would fail to decrypt.

### Init

A new AWS task asks once for AWS admin credentials (masked) and uses them only to provision. Per cloud environment it creates:
- a symmetric KMS key with a 30-day deletion window, plus an alias
- an IAM user whose policy allows only `GenerateDataKey` and `Decrypt` on that key
- that user's access key, plus the key ARN, written to Infisical `/api`

Each of these remote writes gets its own atomic progress flag (INIT_SCRIPT_PATTERNS.md §13). Running the step again reuses the existing key. Replacing it needs a double confirmation and re-wraps the existing rows instead of orphaning them. An Infisical read error is never treated as "missing". Step 8, which writes random keys into Infisical, is deleted.

### Honest claims

Railway has no OIDC to AWS, so the app's IAM key lives in Infisical `/api` beside `DATABASE_URL`. KMS makes key use **auditable** (CloudTrail) and **revocable** (one IAM key), and keys **undeletable for 30 days**. It does not hide keys from someone who already reads both the app's env and its database.

### Open decisions

1. **Offline sealed copy.** AWS cannot decrypt KMS ciphertext outside KMS, even with imported key material, so losing the AWS account loses every key. The only cover is to also seal each data key to an offline public key in a second column (`escrowWrappedDataKey`), ideally with two holders. Aron 11-27: "I don't know about offline backup being useful. Probably is."
2. **AWS account.** None exists yet.

### Dependency: an AWS connector in `@inixiative/infra`

AWS is a planned provider there (`src/core/providers.ts` `PLANNED_INFRA_PROVIDERS`) with no driver. Aron 11-27: "Needs one, so we can make this easy." Building it as the infra AWS driver (KMS key, alias, IAM user and policy, access key) lets template init and Kingdom both call it instead of each growing an AWS client. Template doesn't depend on `@inixiative/infra` yet; Kingdom does.

### Delete list (old model: env keyrings)

- **Engine:** `envValidation.ts` (+ test), `validation.ts` / `validateEncryptionVersions` (+ test), the `envValidation.ts` exemption in `scripts/ci/rules/no-inline-env-coercion.sh`, and the encryption fields in `apps/api/src/config/env.ts`. In `encryptionService.ts`, the current/previous pick and `validateKey`. In `types.ts`, `EncryptionKeyring`. In `rotateEncryptionKeys.ts`, the env read and `target - 1`. The keyring vars in `.env.*.example`.
- **Init:** Step 8 and `infisicalEncryptionKeySteps`, plus their progress keys in `init/utils/fetchProjectConfig.ts`, `init/tests/mocks/config.mock.ts` and `init/tasks/tests/infisicalResume.test.ts`.
- **Docs:** ENCRYPTION.md, JOBS.md, AUTH.md, API_ROUTES.md, FEATURES.md, README.md and INFRA-001; and the `.foundry` regions (encryption, secrets, jobs-cron, authentication, api-routes, environments-deploy, concurrency-locks, tokens-providers) plus GLOSSARY.
- **Naming:** registry `envPrefix` becomes `keyringName`. Hard cut.

### Tests

- Round trip on the local client (real DB, factories).
- A v1 row decrypts after two rotations, and the job leaves every row on the current version across processes.
- A wrapped key moved to another keyring, version or wrapping key fails to unwrap.
- Concurrent first fetch creates one v1.
- Delete and update of an `EncryptionKey` row are refused.
- A deployed environment refuses the local wrapping key.
- The rotate route is superadmin only and writes an audit row.
- The cutover import decrypts rows encrypted under the old env keys.

### Kingdom port (after the template PR is approved)

- `INTEGRATION_SECRETS` becomes a keyring like the others. Importing the live keys and then rotating re-encrypts every credential, which is its first rotation.
- Foundry viewer sessions (`foundryViewerSessions.ts:37`) and OAuth state (`oauthStateRecord.ts:42`) stay on `INTEGRATION_SECRETS` through `fetchEncryptionKeyring`. They are short-lived Redis values whose AAD already separates them, and every version is kept. Their catch-all `catch` must not hide a KMS outage as "no session".
- Kingdom's own copy of this ticket is updated at the same time.

---

## Overview

The template includes a robust AES-256-GCM field-level encryption system with automatic key rotation, registry-based auto-discovery, CI validation, and idempotent rotation jobs. This ticket tracks the encryption module as a first-class feature and addresses gaps — most critically, **encryption key escrow/backup** to prevent catastrophic data loss.

## Current State (Already Built)

The encryption module is fully functional in `@template/db/lib/encryption`:

- **AES-256-GCM field-level encryption** with per-field version tracking
- **Registry pattern** (`ENCRYPTED_MODELS`) — add model/field, rotation job auto-discovers it
- **Type-safe helpers** — `encryptField<M, K>()` and `decryptField()` with TypeScript generics
- **Automatic key rotation** — worker auto-enqueues rotation on startup, processes in parallel
- **Idempotent updates** — version precondition in WHERE clause prevents race conditions
- **CI validation** — blocks deployment on version downgrades, gaps, or mixed versions
- **Singleton locking** — Redis-based lock with heartbeat prevents concurrent rotation jobs
- **AAD (Additional Authenticated Data)** — binds ciphertext to immutable record fields

### Architecture

```
packages/db/src/lib/encryption/
├── types.ts              # EncryptedFieldData, EncryptionKeyring
├── registry.ts           # ENCRYPTED_MODELS — model → keys[] mapping
├── fieldEncryption.ts    # encryptField(), decryptField()
├── encryptionService.ts  # Low-level AES-256-GCM crypto operations
├── validation.ts         # CI version validation (pre-deploy)
├── envValidation.ts      # Environment schema validation
├── *.test.ts             # Tests for helpers, service, env, validation
```

### Schema Pattern (per encrypted field)

```prisma
encryptedSecrets                      String?
encryptedSecretsEncryptionMetadata    Json?    // { iv, authTag }
encryptedSecretsEncryptionKeyVersion  Int?     // 1, 2, 3...
@@index([encryptedSecretsEncryptionKeyVersion])
```

### Documentation

Full documentation exists at [docs/claude/ENCRYPTION.md](../docs/claude/ENCRYPTION.md).

---

## Objectives

### Critical: Key Escrow & Backup

- ✅ Prevent catastrophic data loss from accidental key deletion
- ✅ Provide key recovery mechanism independent of Infisical/env provider
- ✅ Audit trail for key access and rotation events

### Enhancement: Feature Completeness

- ✅ Document encryption as a headline template feature
- ✅ Add key escrow/backup system
- ✅ Add encryption key lifecycle management
- ✅ Consider admin UI for encryption status visibility

---

## Tasks

### 1. Key Escrow & Backup (Critical)

**Problem**: If encryption keys are deleted from Infisical (or any secrets manager), all encrypted data becomes permanently irrecoverable. There is currently no backup or escrow mechanism.

- [ ] Design key escrow strategy (options below)
- [ ] Implement encrypted key backup storage
- [ ] Add key recovery procedure and documentation
- [ ] Add warning/monitoring when keys are about to be rotated or removed
- [ ] Test recovery flow end-to-end

**Escrow Strategy Options:**

| Option | Pros | Cons |
|--------|------|------|
| **Encrypted file backup** (GPG-encrypted keys stored in secure S3 bucket) | Simple, offline-capable, cheap | Manual recovery, needs GPG key management |
| **Split key / Shamir's Secret Sharing** | No single point of failure, enterprise-grade | Complex setup, requires N-of-M participants for recovery |
| **Secondary secrets manager** | Automated sync, provider redundancy | Cost, sync complexity, two attack surfaces |
| **Database-stored key hashes** (verification only, not recovery) | Can detect key mismatch before data loss | Doesn't enable recovery, only detection |
| **Hardware Security Module (HSM)** via cloud KMS | Gold standard, tamper-proof | Expensive, vendor lock-in |

**Recommended approach**: Encrypted file backup (S3 + GPG) as baseline, with optional Shamir's for enterprise tier.

### 2. Key Lifecycle Management

- [ ] Add `lastRotatedAt` tracking per key in registry or database
- [ ] Add rotation age warnings (e.g., "Key hasn't been rotated in 90 days")
- [ ] Add pre-rotation validation (ensure backup exists before allowing rotation)
- [ ] Document key ceremony procedures (who generates, who stores, who approves)

### 3. Encryption Status Visibility

- [ ] Admin endpoint: encryption health check (versions in use, stale record counts)
- [ ] Admin UI panel: show per-model encryption status
- [ ] BullBoard: ensure rotation jobs are visible with progress
- [ ] Alert on mixed-version state persisting beyond expected rotation window

### 4. Documentation & Feature Marketing

- [ ] Add encryption to template feature list / README
- [ ] Create "Security" section in template marketing materials
- [ ] Document key escrow procedures in runbook
- [ ] Add encryption setup to init script (INFRA-001) — generate initial keys

---

## Open Questions

1. **Escrow strategy**: Which approach fits the template's philosophy? (Simple + optional enterprise?)
2. **Key backup frequency**: On every rotation? Or manual ceremony?
3. **Should init script auto-generate first encryption keys?** Currently manual `openssl rand -base64 32`
4. **Admin UI scope**: Full encryption dashboard or lightweight status indicator?

---

## Implementation Notes

### Current Env Pattern (per keyring)

```env
{ENV_PREFIX}_ENCRYPTION_VERSION=2
{ENV_PREFIX}_ENCRYPTION_KEY_CURRENT=<base64-32-bytes>
{ENV_PREFIX}_ENCRYPTION_KEY_PREVIOUS=<base64-32-bytes>
```

### Risk Scenario

```
1. Dev sets up encryption, keys stored in Infisical
2. Another dev accidentally deletes/overwrites the secret
3. No backup exists
4. All encrypted fields (auth provider secrets, API keys, etc.) are permanently lost
5. Downstream services break, users locked out
```

This is not hypothetical — secrets manager accidents happen. The escrow system is the safety net.

---

## Definition of Done

- [ ] Key escrow mechanism implemented and tested
- [ ] Recovery procedure documented and tested end-to-end
- [ ] Encryption health endpoint available in admin API
- [ ] Key lifecycle tracking (rotation dates, age warnings)
- [ ] Pre-rotation backup validation
- [ ] Encryption documented as template feature
- [ ] Tests cover escrow, recovery, and lifecycle flows

---

## Resources

- [ENCRYPTION.md](../docs/claude/ENCRYPTION.md) — full encryption documentation
- `packages/db/src/lib/encryption/` — implementation
- `apps/api/src/jobs/` — rotation job
- [ENVIRONMENTS.md](../docs/claude/ENVIRONMENTS.md) — env var patterns

---

## Related Tickets

- [INFRA-001: Init Script](./INFRA-001-init-script.md) — should auto-generate initial encryption keys
- [FEAT-005: Audit Logs](./archived/FEAT-005-audit-logs.md) — audit encryption key access/rotation events
- [AUTH-002: Unified Auth System](./AUTH-002-unified-auth-system.md) — uses encrypted secrets

---

## Comments

_2026-03-02: Created. Encryption module is already built and functional — this ticket primarily tracks key escrow/backup (critical gap) and feature visibility._
