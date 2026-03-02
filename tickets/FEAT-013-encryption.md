# FEAT-013: Encryption

**Status**: 🆕 Not Started
**Assignee**: TBD
**Priority**: High
**Created**: 2026-03-02
**Updated**: 2026-03-02

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
├── helpers.ts            # encryptField(), decryptField()
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
- [FEAT-005: Audit Logs](./FEAT-005-audit-logs.md) — audit encryption key access/rotation events
- [AUTH-002: Unified Auth System](./AUTH-002-unified-auth-system.md) — uses encrypted secrets

---

## Comments

_2026-03-02: Created. Encryption module is already built and functional — this ticket primarily tracks key escrow/backup (critical gap) and feature visibility._
