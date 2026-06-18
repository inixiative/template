/**
 * @atlas
 * @kind helper
 * @partOf infrastructure:prisma
 * @uses none
 */
export const requireWhere = (where: Record<string, unknown>): void => {
  if (!where || Object.keys(where).length === 0) {
    throw new Error('fetchLens: refusing to run with an empty where — narrow the lens');
  }
};
