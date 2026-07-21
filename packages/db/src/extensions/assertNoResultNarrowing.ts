/**
 * @atlas
 * @kind helper
 * @partOf infrastructure:prisma
 * @uses none
 */
import type { Prisma } from '@template/db/generated/client/client';

// A narrowed write result breaks the after-write hooks: a hidden changed column reads as a no-op, or the key-deriving field is stripped.
export const assertNoResultNarrowing = (model: Prisma.ModelName, args: unknown): void => {
  const a = args as { select?: unknown; omit?: unknown } | null;
  if (a && (a.select || a.omit)) {
    throw new Error(
      `${model} write must return full rows so lifecycle hooks can derive change-sets and cache keys — drop the select/omit and shape the result after the write.`,
    );
  }
};
