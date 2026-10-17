/**
 * @atlas
 * @kind helper
 * @partOf infrastructure:prisma
 * @uses none
 */

// Prisma compiles contains / startsWith / endsWith / insensitive equality to LIKE and passes
// %, _ and \ through as pattern syntax.
export const escapeLikePattern = (value: string): string =>
  value.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_');
