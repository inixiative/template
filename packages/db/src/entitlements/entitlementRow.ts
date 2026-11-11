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
import { loadPolymorphicArmKeys } from '@template/db/utils/polymorphicArmKeys';
import { uniqBy } from 'lodash-es';

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

const sourceKeys = (inputs: EntitlementInput[]): Promise<Record<string, Record<string, string>>> =>
  Promise.all(
    uniqBy(inputs, ({ sourceModel, sourceId }) => `${sourceModel}:${sourceId}`).map(
      async ({ sourceModel, sourceId }) =>
        [
          `${sourceModel}:${sourceId}`,
          await loadPolymorphicArmKeys('Entitlement', 'sourceModel', sourceModel, sourceId),
        ] as const,
    ),
  ).then(Object.fromEntries);

/** The rows that store inputs on a target, with the arm keys and plain ids on both ends. */
export const toEntitlementCreateData = async (
  inputs: EntitlementInput[],
  target: EntitlementTarget,
): Promise<Prisma.EntitlementUncheckedCreateInput[]> => {
  if (!inputs.length) return [];
  const targetKeys = await loadPolymorphicArmKeys(
    'Entitlement',
    'targetModel',
    target.model,
    target.id,
  );
  const keysBySource = await sourceKeys(inputs);
  return inputs.map(({ where, sourcePath, ...input }) => ({
    ...input,
    ...(where != null ? { where } : {}),
    sourcePath: sourcePath ?? null,
    ...keysBySource[`${input.sourceModel}:${input.sourceId}`],
    targetModel: target.model,
    targetId: target.id,
    ...targetKeys,
  }));
};
