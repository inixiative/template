/**
 * @atlas
 * @kind utils
 * @partOf infrastructure:prisma
 * @uses infrastructure:redis
 */
import { makeHydrator } from '@inixiative/permissions';
import { prismaMap } from '@template/db/generated/prismaMap';
import { fetchCachedRecordsWithTargetEntitlements } from '@template/db/hydrate/fetchCachedRecordWithTargetEntitlements';
import type { HydratedRecord } from '@template/db/hydrate/types';
import {
  type AccessorName,
  accessorOfResource,
  resourceOfModel,
} from '@template/db/utils/modelNames';

const hydrator = makeHydrator({
  mapName: 'db',
  fieldMap: prismaMap,
  loadMany: (resource, wheres) =>
    fetchCachedRecordsWithTargetEntitlements(
      accessorOfResource(resource),
      wheres as Record<string, string>[],
    ),
});

export const hydrate = <T extends HydratedRecord>(
  accessor: AccessorName,
  record: T,
): Promise<T & HydratedRecord> =>
  hydrator.hydrate(resourceOfModel(accessor), record) as Promise<T & HydratedRecord>;

export const hydrateMany = <T extends HydratedRecord>(
  accessor: AccessorName,
  records: readonly T[],
): Promise<(T & HydratedRecord)[]> =>
  hydrator.hydrateMany(resourceOfModel(accessor), records) as Promise<(T & HydratedRecord)[]>;
