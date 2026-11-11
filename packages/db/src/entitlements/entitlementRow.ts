/**
 * @atlas
 * @kind helper
 * @partOf infrastructure:prisma, primitive:authz
 * @uses none
 */
import type { Entitlement, Prisma } from '@template/db/generated/client/client';
import type {
  EntitlementResourceModel,
  EntitlementTargetModel,
} from '@template/db/generated/client/enums';
import { resolveFalsePolymorphismRef } from '@template/db/registries/falsePolymorphism';

export type EntitlementTarget = { model: EntitlementTargetModel; id: string };

/** What a writer gives for one row: the target and the typed foreign keys are filled in. */
export type EntitlementInput = {
  resource: EntitlementResourceModel;
  actions: string[];
  where?: Prisma.InputJsonValue | null;
  sourceModel: EntitlementResourceModel;
  sourceId: string;
  sourcePath?: string | null;
};

export type StoredEntitlement = Pick<
  Entitlement,
  'resource' | 'actions' | 'where' | 'sourceModel' | 'sourceId' | 'sourcePath'
>;

const foreignKey = (axis: 'sourceModel' | 'targetModel', model: string): string => {
  const column = resolveFalsePolymorphismRef({ model: 'Entitlement', axis, value: model });
  if (!column) throw new Error(`Entitlement has no ${axis} column for ${model}`);
  return column;
};

/** The row that stores an input on a target, with the typed and plain ids on both ends. */
export const toEntitlementCreateData = (
  { where, sourcePath, ...input }: EntitlementInput,
  target: EntitlementTarget,
): Prisma.EntitlementUncheckedCreateInput => ({
  ...input,
  ...(where != null ? { where } : {}),
  sourcePath: sourcePath ?? null,
  [foreignKey('sourceModel', input.sourceModel)]: input.sourceId,
  targetModel: target.model,
  targetId: target.id,
  [foreignKey('targetModel', target.model)]: target.id,
});
