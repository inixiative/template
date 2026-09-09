/**
 * @atlas
 * @kind registry
 * @partOf infrastructure:prisma
 * @uses none
 */

export type SoftDeleteScoper = {
  liveWhere: (model: string, where: Record<string, unknown>) => Record<string, unknown>;
  liveIncludes: (model: string, tree: Record<string, unknown>) => Record<string, unknown>;
};

let scoper: SoftDeleteScoper | null = null;

export const registerSoftDeleteScoper = (next: SoftDeleteScoper | null): void => {
  scoper = next;
};

export const getSoftDeleteScoper = (): SoftDeleteScoper | null => scoper;
