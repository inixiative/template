/**
 * @atlas
 * @kind utils
 * @partOf infrastructure:prisma
 * @uses infrastructure:redis
 */
import { makeHydrator } from '@inixiative/permissions';
import { fetchCachedRecordWithTargetEntitlements } from '@template/db/hydrate/fetchCachedRecordWithTargetEntitlements';
import type { HydratedRecord } from '@template/db/hydrate/types';
import { schemaMapWithoutPermissions } from '@template/db/schemaMap';
import {
  type AccessorName,
  accessorOfResource,
  resourceOfModel,
} from '@template/db/utils/modelNames';

const hydrator = makeHydrator({
  map: schemaMapWithoutPermissions,
  load: (resource, where) =>
    fetchCachedRecordWithTargetEntitlements(
      accessorOfResource(resource),
      where as Record<string, string>,
    ),
});

export const hydrate = <T extends HydratedRecord>(
  accessor: AccessorName,
  record: T,
): Promise<T & HydratedRecord> =>
  hydrator(resourceOfModel(accessor), record) as Promise<T & HydratedRecord>;
