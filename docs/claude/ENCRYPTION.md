# Encryption

## Contents

- [Overview](#overview)
- [Field-Scoped Encryption](#field-scoped-encryption)
- [Adding Encrypted Fields](#adding-encrypted-fields)
- [Key Rotation](#key-rotation)
- [Environment Variables](#environment-variables)
- [CI Validation](#ci-validation)
- [Implementation Details](#implementation-details)

---

## Overview

AES-256-GCM field-level encryption with automatic key rotation. Encryption infrastructure lives in `@template/db/lib/encryption`.

```
encryption/
├── types.ts            # EncryptedFieldData, EncryptionKeyring
├── registry.ts         # ENCRYPTED_MODELS - model → keys[] mapping
├── helpers.ts          # encryptField(), decryptField()
├── encryptionService.ts # Low-level crypto operations
├── validation.ts       # CI version validation
└── envValidation.ts    # Environment schema validation
```

### Key Features

- **Generic**: One rotation job handles all models forever
- **Auto-discovery**: Iterates registry, no manual configuration
- **Type-safe**: `encryptField<M, K>()` with helper types
- **Idempotent**: Version precondition prevents race conditions
- **Observable**: BullBoard job monitoring

---

## Field-Scoped Encryption

Each encrypted field gets its own version tracking and metadata (not model-level).

### Database Schema Pattern

```prisma
model AuthProvider {
  id             String @id @default(uuid())
  organizationId String

  // Field 1: Secrets encryption
  encryptedSecrets                        String?
  encryptedSecretsEncryptionMetadata      Json?    // { iv, authTag }
  encryptedSecretsEncryptionKeyVersion    Int?     // 1, 2, 3, etc.

  // Field 2: API keys (future example)
  encryptedApiKey                         String?
  encryptedApiKeyEncryptionMetadata       Json?
  encryptedApiKeyEncryptionKeyVersion     Int?

  @@index([encryptedSecretsEncryptionKeyVersion])
}
```

**Convention**: `encrypted{Field}`, `encrypted{Field}EncryptionMetadata`, `encrypted{Field}EncryptionKeyVersion`

### Registry Structure

```typescript
// packages/db/src/lib/encryption/registry.ts
export const ENCRYPTED_MODELS = {
  authProvider: {
    model: "authProvider",  // Prisma accessor name
    keys: [
      {
        encryptedField: "encryptedSecrets",
        metadataField: "encryptedSecretsEncryptionMetadata",
        versionField: "encryptedSecretsEncryptionKeyVersion",
        envPrefix: "AUTH_PROVIDER_SECRETS",
        buildAAD: (r) => `authProvider:${(r as any).id}:${(r as any).organizationId}`,
      },
    ],
  },
};
```

**AAD (Additional Authenticated Data)**: Only use **immutable** fields (id, organizationId). Never use mutable fields (name, provider, etc.) - changing them would make old ciphertext undecryptable.

---

## Adding Encrypted Fields

**Zero code changes needed** - just update schema, env, and registry.

### 1. Update Prisma Schema

```prisma
model ExistingModel {
  // ... existing fields ...

  encryptedApiKey                         String?
  encryptedApiKeyEncryptionMetadata       Json?
  encryptedApiKeyEncryptionKeyVersion     Int?

  @@index([encryptedApiKeyEncryptionKeyVersion])
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
  existingModel: {
    model: "existingModel",
    keys: [
      {
        encryptedField: "encryptedApiKey",
        metadataField: "encryptedApiKeyEncryptionMetadata",
        versionField: "encryptedApiKeyEncryptionKeyVersion",
        envPrefix: "API_KEY",
        buildAAD: (r) => `existingModel:${(r as any).id}`,
      },
    ],
  },
};
```

### 4. Use in Controllers

```typescript
import { encryptField, decryptField } from '@template/db/lib/encryption/helpers';
import { ENCRYPTED_MODELS } from '@template/db/lib/encryption/registry';

// Encrypt before create
const body = c.req.valid('json');
const keyConfig = ENCRYPTED_MODELS.existingModel.keys[0];
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
   - Finds records with `encryptedSecretsEncryptionKeyVersion = 1`
   - Re-encrypts with version 2

3. **Job processes in parallel**:
   - Uses `resolveAll()` with db concurrency limits
   - Idempotent updates (version in where clause)
   - Logs progress to BullBoard

4. **Verify completion**:
   ```sql
   SELECT encryptedSecretsEncryptionKeyVersion, COUNT(*)
   FROM auth_provider
   GROUP BY encryptedSecretsEncryptionKeyVersion;
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
- **CI enforcement**: Deploy blocked if >1 version gap detected

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

### Validation

Env schema validates:
- Version is integer ≥ 1
- Keys are valid base64-encoded 32-byte values
- Keys decode to exactly 256 bits

---

## CI Validation

**Prevents deploying bad key versions** - runs before deployment can proceed.

### Validation Rules

```typescript
// packages/db/src/lib/encryption/validation.ts
export const validateEncryptionVersions = async (db: PrismaClient) => {
  // For each model → key in registry:

  // 1. Version cannot go down
  if (currentVersion < maxDbVersion) throw Error('Version downgrade!');

  // 2. Can only increment by 1
  if (currentVersion > maxDbVersion + 1) throw Error('Version jump too large!');

  // 3. Can only bump if all records on latest
  if (currentVersion > maxDbVersion && versions.length > 1) {
    throw Error('Mixed versions detected!');
  }

  // 4. Max 2 versions in system
  if (versions.length > 2) throw Error('Too many versions!');
};
```

### CI Integration

```yaml
# .github/workflows/deploy.yml (when CI exists)
- name: Validate Encryption Versions
  run: |
    cd packages/db
    bun run validate:encryption
```

**Result**: Can't deploy with bad version configurations - CI fails first.

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
  return async (ctx, payload) => {
    if (!jobData.id) throw new Error('Singleton job missing id');

    // Redis lock with 5min TTL
    const acquired = await redis.set(lockKey, '1', 'EX', 300, 'NX');
    if (!acquired) return;  // Another worker already running

    // Heartbeat extends lock every 2min
    const heartbeat = setInterval(() => redis.expire(lockKey, 300), 120000);

    try {
      await handler(ctx, payload);
    } finally {
      clearInterval(heartbeat);
      await redis.del(lockKey);
    }
  };
};
```

**Works for**: Any job with an `id` (cron or ad-hoc)

### Rotation Job Flow

```typescript
// 1. Auto-discovery
for (modelName in ENCRYPTED_MODELS) {
  for (keyConfig of modelConfig.keys) {

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

4. ✅ Run CI validation (automatic in pipeline)

5. ✅ Deploy and monitor BullBoard for job completion

6. ✅ Verify rotation: All records should be on new version

7. ✅ Optional cleanup (after verification period):
   - Can remove `_KEY_PREVIOUS` once confident

**Rollback**: Revert env vars and redeploy - old key still works for decryption.

---

## FAQ

**Q: Can I skip versions (v1 → v3)?**
A: No. CI validation blocks this. Must go v1 → v2 → v3.

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
