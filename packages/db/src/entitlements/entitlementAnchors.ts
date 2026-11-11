/**
 * @atlas
 * @kind helper
 * @partOf infrastructure:prisma, primitive:authz
 * @uses none
 */
import { db } from '@template/db/client';
import type { EntitlementInput } from '@template/db/entitlements/entitlementRow';
import { groupBy, uniq } from 'lodash-es';

type Row = Record<string, unknown>;

/** Anchor rows by `anchorKey`, tombstones included. */
export type EntitlementAnchors = Record<string, Row>;

export const anchorKey = ({
  sourceModel,
  sourceId,
}: Pick<EntitlementInput, 'sourceModel' | 'sourceId'>) => `${sourceModel}:${sourceId}`;

/** Every anchor the inputs name, one read per anchor model; a missing key is an anchor that does not exist. */
export const loadEntitlementAnchors = async (
  inputs: EntitlementInput[],
): Promise<EntitlementAnchors> => {
  const anchors: EntitlementAnchors = {};
  for (const [sourceModel, group] of Object.entries(groupBy(inputs, 'sourceModel'))) {
    const rows = (await db.withDeleted(() =>
      db.delegate(sourceModel).findMany({
        where: { id: { in: uniq(group.map((input) => input.sourceId)) } },
      }),
    )) as Row[];
    for (const row of rows) anchors[`${sourceModel}:${String(row.id)}`] = row;
  }
  return anchors;
};

export const missingAnchors = (
  inputs: EntitlementInput[],
  anchors: EntitlementAnchors,
): EntitlementInput[] => inputs.filter((input) => !anchors[anchorKey(input)]);
