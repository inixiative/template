# Encryption

<!-- toc:start -->

## Contents

- [Overview](#overview)
  - [Key Features](#key-features)
- [Field-Scoped Encryption](#field-scoped-encryption)
  - [Database Schema Pattern](#database-schema-pattern)
  - [Registry Structure](#registry-structure)
- [Adding Encrypted Fields](#adding-encrypted-fields)
  - [1. Update Prisma Schema](#1-update-prisma-schema)
  - [2. Add Environment Variables](#2-add-environment-variables)
  - [3. Register in Encryption Registry](#3-register-in-encryption-registry)
  - [4. Use in Controllers](#4-use-in-controllers)
- [Key Rotation](#key-rotation)
  - [Automatic Process](#automatic-process)
  - [Manual Trigger](#manual-trigger)
  - [Idempotent Protection](#idempotent-protection)
  - [Version Constraints](#version-constraints)
- [Environment Variables](#environment-variables)
  - [Per Keyring (3 vars)](#per-keyring-3-vars)
  - [Example: Auth Provider Secrets](#example-auth-provider-secrets)
  - [Example: User-JWT Signing Keys](#example-user-jwt-signing-keys)
  - [Validation](#validation)
- [Deploy-Time Validation](#deploy-time-validation)
  - [Validation Rules](#validation-rules)
  - [Wiring It (not built)](#wiring-it-not-built)
- [Implementation Details](#implementation-details)
  - [Type Safety](#type-safety)
  - [Encryption Payload](#encryption-payload)
  - [Singleton Locking](#singleton-locking)
  - [Rotation Job Flow](#rotation-job-flow)
- [Deployment Checklist](#deployment-checklist)
- [FAQ](#faq)

<!-- toc:end -->


---

## Overview

AES-256-GCM field-level encryption with automatic key rotation. Encryption infrastructure lives in `@template/db/lib/encryption`.

```
encryption/
├── types.ts            # EncryptedFieldData, EncryptionKeyring
├── registry.ts         # ENCRYPTED_MODELS - model → { keyName: config } map, getFieldNames()
├── helpers.ts          # encryptField(), decryptField()
├── encryptionService.ts # Low-level crypto operations
├── validation.ts       # validateEncryptionVersions() — deploy-time version check (not wired, see below)
└── envValidation.ts    # Environment schema validation
```

### Key Features

- **Generic** — single rotation job for all models
- **Auto-discovery** — iterates registry automatically
- **Type-safe** — `encryptField<M, K>()` generics
- **Idempotent** — version precondition prevents races
- **Observable** — BullBoard monitoring

---

## Field-Scoped Encryption

Each encrypted field gets its own version tracking and metadata (not model-level).

### Database Schema Pattern

```prisma
model AuthProvider {
  id             String @id @default(dbgenerated("uuidv7()")) @db.VarChar(36)
  organizationId String

  encryptedSecrets           String // Base64 AES-256-GCM ciphertext
  encryptedSecretsMetadata   Json   // { iv, authTag }
  encryptedSecretsKeyVersion Int    // 1, 2, 3, etc.

  @@index([encryptedSecretsKeyVersion])
}
```

**Convention**: `encrypted{Key}`, `encrypted{Key}Metadata`, `encrypted{Key}KeyVersion`, where `{Key}` is the registry key name upper-first (`secrets` → `encryptedSecrets`). `getFieldNames(keyName)` derives all three; the registry never lists column names.

### Registry Structure

```typescript
// packages/db/src/lib/encryption/registry.ts
export const ENCRYPTED_MODELS = {
  authProvider: {
    model: 'authProvider', // Prisma accessor name
    keys: {
      secrets: {
        envPrefix: 'AUTH_PROVIDER_SECRETS',
        buildAAD: (r: Pick<AuthProvider, 'id' | 'organizationId'>) =>
          `authProvider:${r.id}:${r.organizationId}`,
      },
    },
  } satisfies EncryptedModelConfig<'authProvider'>,
  jwks: {
    model: 'jwks',
    keys: {
      privateKey: {
        envPrefix: 'JWKS_PRIVATE_KEY',
        buildAAD: (r: Pick<Jwks, 'id'>) => `jwks:${r.id}`,
      },
    },
  } satisfies EncryptedModelConfig<'jwks'>,
} as const;
```

`jwks.privateKey` is the private half of each user-JWT signing key ([AUTH.md → What lives where](./AUTH.md#what-lives-where)). BetterAuth's `jwt()` plugin reads and writes keys through `apps/api/src/lib/auth/jwksStore.ts`, which encrypts with `encryptField` and decrypts with `decryptField`, so the key is covered by the same rotation job as every other secret. Why: one scheme for secrets at rest, instead of BetterAuth's own encryption keyed off `BETTER_AUTH_SECRET`, which nothing rotates.

**AAD (Additional Authenticated Data)**: Only use **immutable** fields (id, organizationId). Never use mutable fields (name, provider, etc.) - changing them would make old ciphertext undecryptable.

---

## Adding Encrypted Fields

**Zero code changes needed** - just update schema, env, and registry.

### 1. Update Prisma Schema

```prisma
model ExistingModel {
  // ... existing fields ...

  encryptedApiKey           String?
  encryptedApiKeyMetadata   Json?
  encryptedApiKeyKeyVersion Int?

  @@index([encryptedApiKeyKeyVersion])
}
```

### 2. Add Environment Variables

```env
API_KEY_ENCRYPTION_VERSION=1
API_KEY_ENCRYPTION_KEY_CURRENT=<base64-32-bytes>
API_KEY_ENCRYPTION_KEY_PREVIOUS=  # Empty for initial version
```

Generate keys: `openssl rand -base64 32`

### 3. Register in Encryption Registry

```typescript
export const ENCRYPTED_MODELS = {
  // ...authProvider
  existingModel: {
    model: 'existingModel',
    keys: {
      apiKey: {
        envPrefix: 'API_KEY',
        buildAAD: (r: Pick<ExistingModel, 'id'>) => `existingModel:${r.id}`,
      },
    },
  } satisfies EncryptedModelConfig<'existingModel'>,
} as const;
```

### 4. Use in Controllers

```typescript
import { encryptField, decryptField } from '@template/db/lib/encryption/helpers';
import { ENCRYPTED_MODELS } from '@template/db/lib/encryption/registry';

// Encrypt before create
const body = c.req.valid('json');
const encryptedData = await encryptField(
  'existingModel',
  'apiKey',
  { ...body, apiKey: body.secrets }
);

const record = await db.existingModel.create({
  data: { ...body, ...encryptedData },
});

// Decrypt on read
const decrypted = await decryptField(
  'existingModel',
  'apiKey',
  record
);
```

**That's it!** The rotation job automatically handles the new field.

---

## Key Rotation

### Automatic Process

1. **Deploy with new key version**:
   ```env
   AUTH_PROVIDER_SECRETS_ENCRYPTION_VERSION=2
   AUTH_PROVIDER_SECRETS_ENCRYPTION_KEY_CURRENT=<new-key>
   AUTH_PROVIDER_SECRETS_ENCRYPTION_KEY_PREVIOUS=<old-key>
   ```

2. **Worker startup auto-enqueues rotation job**:
   - Iterates all models/keys in `ENCRYPTED_MODELS`
   - Finds records with `encryptedSecretsKeyVersion = 1`
   - Re-encrypts with version 2

3. **Job processes in parallel**:
   - Uses `resolveAll()` with db concurrency limits
   - Idempotent updates (version in where clause)
   - Logs progress to BullBoard

4. **Verify completion**:
   ```sql
   SELECT "encryptedSecretsKeyVersion", COUNT(*)
   FROM "AuthProvider"
   GROUP BY "encryptedSecretsKeyVersion";
   -- Should show only version 2
   ```

### Manual Trigger

All jobs can be manually triggered via enqueue endpoint (admin-only):

```bash
POST /admin/jobs/enqueue
{
  "handlerName": "rotateEncryptionKeys",
  "payload": {},
  "options": { "id": "manual-rotation" }
}
```

### Idempotent Protection

Uses `updateManyAndReturn` with version precondition:

```typescript
await delegate.updateManyAndReturn({
  where: {
    id: record.id,
    [fields.versionField]: fromVersion,  // Only if not already rotated
  },
  data: encryptedData,
});
```

If another process already rotated the record (changing the version), the where clause won't match → no duplicate work.

### Version Constraints

- **Max 2 versions at once**: Current + previous
- **One version gap only**: Can only rotate from v(n-1) → v(n)
- **Deploy-time check**: `validateEncryptionVersions` detects a >1 version gap, but nothing runs it yet (see [Deploy-Time Validation](#deploy-time-validation))

---

## Environment Variables

### Per Keyring (3 vars)

```env
# Required
{ENV_PREFIX}_ENCRYPTION_VERSION=2           # Integer, not "v2"
{ENV_PREFIX}_ENCRYPTION_KEY_CURRENT=<base64-32-bytes>

# Optional (for rotation)
{ENV_PREFIX}_ENCRYPTION_KEY_PREVIOUS=<base64-32-bytes>
```

**Previous version derived**: `currentVersion - 1` (e.g., 2 → 1)

### Example: Auth Provider Secrets

```env
AUTH_PROVIDER_SECRETS_ENCRYPTION_VERSION=2
AUTH_PROVIDER_SECRETS_ENCRYPTION_KEY_CURRENT=dGhpcyBpcyBhIDMyIGJ5dGUga2V5IGZvciBBRVM=
AUTH_PROVIDER_SECRETS_ENCRYPTION_KEY_PREVIOUS=b2xkIGtleSB0aGF0IHdhcyB1c2VkIGZvciB2ZXJzaW9uIDE=
```

### Example: User-JWT Signing Keys

```env
JWKS_PRIVATE_KEY_ENCRYPTION_VERSION=1
JWKS_PRIVATE_KEY_ENCRYPTION_KEY_CURRENT=<base64-32-bytes>
JWKS_PRIVATE_KEY_ENCRYPTION_KEY_PREVIOUS=
```

The API refuses to start without them, like every registered keyring.

### Validation

Env schema validates:
- Version is integer ≥ 1
- Keys are valid base64-encoded 32-byte values
- Keys decode to exactly 256 bits

---

## Deploy-Time Validation

**Not wired.** `validateEncryptionVersions(db)` (`packages/db/src/lib/encryption/validation.ts`) exists and is tested (`validation.test.ts`), but no script runs it: there is no `validate:encryption` package script and no `.github/workflows` in the repo. Until something calls it before a deploy, the version rules below are only as enforced as the person deploying.

### Validation Rules

For each model → key in the registry it compares the env version with the versions in the database and returns `{ valid, errors }` (it doesn't throw):

- Missing `{PREFIX}_ENCRYPTION_VERSION` / `_KEY_CURRENT`, or a non-integer version
- Version > 1 without `_KEY_PREVIOUS`; current and previous keys identical
- Version downgrade (env version < highest DB version)
- Version jump > 1
- Bump while records are still on more than one version
- More than 2 versions in the database

### Wiring It (not built)

The intended shape is a pre-deploy step that runs `validateEncryptionVersions` against the target database and fails the deploy when `valid` is false — part of the deploy pipeline that doesn't exist yet ([CICD.md](CICD.md)).

---

## Implementation Details

### Type Safety

**Generic helpers** work across all models:

```typescript
// Type-safe encryption
const encrypted = await encryptField<'authProvider', 'secrets'>(
  'authProvider',
  'secrets',
  recordWithData
);

// Helper type for decryption input
type DecryptInput = DecryptFieldInput<'authProvider', 'secrets'>;
const decrypted = await decryptField(modelName, keyName, record as DecryptInput);
```

**RuntimeDelegate**: Dynamic Prisma model access requires one cast:

```typescript
const delegate = db[modelConfig.model] as unknown as RuntimeDelegate;
const records = await delegate.findMany({ where: { ... } });
```

**Trade-off**: Better than `any`, but not fully type-safe. Intentional decision per plan review.

### Encryption Payload

```typescript
interface EncryptedFieldData {
  ciphertext: string;   // Base64 AES-256-GCM encrypted data
  version: number;      // 1, 2, 3 (not "v1", "v2")
  iv: string;           // Base64 IV (12 bytes)
  authTag: string;      // Base64 auth tag (16 bytes)
}
```

**Storage**: Split across 3 DB columns (encryptedField, metadata, version)

### Singleton Locking

```typescript
// apps/api/src/jobs/makeSingletonJob.ts
export const makeSingletonJob = <T>(handler: JobHandler<T>) => {
  return async (ctx, ...args) => {
    const identifier = (ctx.job.data as { id?: string })?.id ?? ctx.job.name;
    if (!identifier) throw new Error('Singleton job missing id and name');

    // Cross-process Redis lock (heartbeated TTL + fenced release) — see createLock.
    const lock = createLock({ service: 'job-singleton', identifier, ttlMs: 300_000, heartbeatMs: 60_000 });
    if (!(await lock.acquire())) return; // another worker already running

    try {
      await handler(ctx, ...args);
    } finally {
      await lock.release();
    }
  };
};
```

**Works for**: Any job with an `id` (cron or ad-hoc)

### Rotation Job Flow

```typescript
// 1. Auto-discovery
for (modelName in ENCRYPTED_MODELS) {
  for ([keyName, keyConfig] of Object.entries(modelConfig.keys)) {
    const { versionField } = getFieldNames(keyName);

    // 2. Read target version from env
    const targetVersion = parseInt(process.env[`${envPrefix}_ENCRYPTION_VERSION`]);
    const fromVersion = targetVersion - 1;

    // 3. Find stale records
    const staleRecords = await delegate.findMany({
      where: { [versionField]: fromVersion }
    });

    // 4. Create rotation functions
    const rotations = staleRecords.map(record => async () => {
      const decrypted = await decryptField(modelName, keyName, record);
      const encryptedData = await encryptField(modelName, keyName, { ...record, [keyName]: decrypted });

      // Idempotent update
      return await delegate.updateManyAndReturn({
        where: { id: record.id, [versionField]: fromVersion },
        data: encryptedData,
      });
    });
  }
}

// 5. Parallel execution with concurrency control
const results = await resolveAll(allRotations, getConcurrency([ConcurrencyType.db]));
```

---

## Deployment Checklist

**Before first key rotation:**

1. ✅ Verify all records on latest version:
   ```sql
   SELECT DISTINCT {versionField} FROM {table};
   -- Should return only current version
   ```

2. ✅ Generate new key: `openssl rand -base64 32`

3. ✅ Update environment:
   - Set `_ENCRYPTION_VERSION` to `currentVersion + 1`
   - Move current key to `_KEY_PREVIOUS`
   - Set new key as `_KEY_CURRENT`

4. ✅ Run `validateEncryptionVersions` against the target database by hand (no pipeline runs it yet)

5. ✅ Deploy and monitor BullBoard for job completion

6. ✅ Verify rotation: All records should be on new version

7. ✅ Optional cleanup (after verification period):
   - Can remove `_KEY_PREVIOUS` once confident

**Rollback**: Revert env vars and redeploy - old key still works for decryption.

---

## FAQ

**Q: Can I skip versions (v1 → v3)?**
A: No. Must go v1 → v2 → v3. `validateEncryptionVersions` reports a jump, but nothing runs it automatically yet.

**Q: What if rotation fails mid-way?**
A: Safe to retry! Idempotent updates skip already-rotated records.

**Q: Can I rotate keys without downtime?**
A: Yes! Old key in `PREVIOUS` still decrypts while rotation runs.

**Q: How do I add encryption to an existing field?**
A: Follow "Adding Encrypted Fields" steps. Existing data stays unencrypted (NULL in encrypted columns). Encrypt on next update, or run migration script.

**Q: Why field-scoped instead of model-level?**
A: Different fields may need different rotation schedules (e.g., PII vs API keys). Also cleaner separation when fields are optional.

**Q: Why `updateManyAndReturn` instead of `update`?**
A: **Idempotent protection**. The where clause includes version field - if another process already rotated this record, the where won't match and update is skipped. Prevents duplicate work in concurrent scenarios.
