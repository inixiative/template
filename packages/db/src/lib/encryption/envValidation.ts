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
  return (data: Record<string, any>, ctx: z.RefinementCtx) => {
    const version = data[versionField];
    const previousKey = data[previousKeyField];

    if (version > 1 && !previousKey) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: [previousKeyField],
        message: `Previous encryption key is required when ${versionField} > 1 (current: ${version})`,
      });
    }
  };
};
