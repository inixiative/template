import { ENCRYPTED_MODELS } from '@template/db/lib/encryption/registry';
import { z } from 'zod';

export const encryptionKeySchema = z.string().refine(
  (key) => {
    try {
      const decoded = Buffer.from(key, 'base64');
      return decoded.length === 32;
    } catch {
      return false;
    }
  },
  { message: 'Encryption key must be valid base64-encoded 32-byte key' },
);

export const createEncryptionEnvRefinement = (versionField: string, previousKeyField: string) => {
  return (data: unknown, ctx: z.RefinementCtx) => {
    const obj = data as Record<string, unknown>;
    const version = obj[versionField];
    const previousKey = obj[previousKeyField];

    if ((version as number) > 1 && !previousKey) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: [previousKeyField],
        message: `Previous encryption key is required when ${versionField} > 1 (current: ${version})`,
      });
    }
  };
};

const collectRegisteredEnvPrefixes = (): string[] => {
  const prefixes = new Set<string>();
  for (const model of Object.values(ENCRYPTED_MODELS)) {
    for (const key of Object.values(model.keys)) {
      prefixes.add(key.envPrefix);
    }
  }
  return [...prefixes];
};

// Derives the `<PREFIX>_ENCRYPTION_VERSION/KEY_CURRENT/KEY_PREVIOUS` schema
// fields and the matching superRefine guards from ENCRYPTED_MODELS — so adding
// a new encrypted key only requires updating the registry. Pass `envPrefixes`
// to opt into a subset (e.g. a worker process that only needs one model);
// default is every prefix the registry knows about.
export const encryptionEnv = (opts: { envPrefixes?: string[] } = {}) => {
  const registered = collectRegisteredEnvPrefixes();
  const prefixes = opts.envPrefixes ?? registered;

  const unknown = prefixes.filter((p) => !registered.includes(p));
  if (unknown.length > 0) {
    throw new Error(`Unknown encryption envPrefix(es): ${unknown.join(', ')}. Registered: ${registered.join(', ')}`);
  }

  const fields: Record<string, z.ZodTypeAny> = {};
  for (const prefix of prefixes) {
    fields[`${prefix}_ENCRYPTION_VERSION`] = z.coerce.number().int().min(1);
    fields[`${prefix}_ENCRYPTION_KEY_CURRENT`] = encryptionKeySchema;
    fields[`${prefix}_ENCRYPTION_KEY_PREVIOUS`] = encryptionKeySchema.optional();
  }

  const applyRefinements = <T extends z.ZodTypeAny>(schema: T): T => {
    return prefixes.reduce<z.ZodTypeAny>(
      (acc, prefix) =>
        acc.superRefine(
          createEncryptionEnvRefinement(`${prefix}_ENCRYPTION_VERSION`, `${prefix}_ENCRYPTION_KEY_PREVIOUS`),
        ),
      schema,
    ) as T;
  };

  return { fields, applyRefinements };
};
