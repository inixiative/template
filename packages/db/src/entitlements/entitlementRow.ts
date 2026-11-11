/**
 * @atlas
 * @kind helper
 * @partOf infrastructure:prisma, primitive:authz
 * @uses none
 */

import { anchorKey, type EntitlementAnchors } from '@template/db/entitlements/entitlementAnchors';
import type { Entitlement, Prisma } from '@template/db/generated/client/client';
import type {
  EntitlementResourceModel,
  EntitlementTargetModel,
} from '@template/db/generated/client/enums';
import { polymorphicArmKeys } from '@template/db/utils/polymorphicArmKeys';

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

/** The holder a row is stored on, as read: a member arm takes its owner chain off it. */
export type EntitlementHolder = {
  model: EntitlementTargetModel;
  row: Record<string, unknown> & { id: string };
};

/**
 * The rows that store inputs on a holder, with each arm's keys and plain ids, and the anchor's
 * tombstone copied. The writer has checked that every anchor exists (`missingAnchors`).
 */
export const toEntitlementCreateData = (
  inputs: EntitlementInput[],
  holder: EntitlementHolder,
  anchors: EntitlementAnchors,
): Prisma.EntitlementUncheckedCreateInput[] => {
  const targetKeys = polymorphicArmKeys('Entitlement', 'targetModel', holder.model, holder.row);
  return inputs.map(({ where, sourcePath, ...input }) => {
    const anchor = anchors[anchorKey(input)];
    if (!anchor) throw new Error(`${input.sourceModel} ${input.sourceId} not found`);
    return {
      ...input,
      ...(where != null ? { where } : {}),
      sourcePath: sourcePath ?? null,
      ...polymorphicArmKeys('Entitlement', 'sourceModel', input.sourceModel, anchor),
      sourceDeletedAt: (anchor.deletedAt as Date | null | undefined) ?? null,
      targetModel: holder.model,
      targetId: holder.row.id,
      ...targetKeys,
    };
  });
};
