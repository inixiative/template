/**
 * @atlas
 * @kind utils
 * @partOf infrastructure:prisma
 * @uses infrastructure:redis
 */
import { createHydrator } from '@inixiative/permissions';
import { fetchCachedRecordWithTargetEntitlements } from '@template/db/hydrate/fetchCachedRecordWithTargetEntitlements';
import type { HydratedRecord } from '@template/db/hydrate/types';
import { schemaMap } from '@template/db/schemaMap';
import type { AccessorName } from '@template/db/utils/modelNames';

const hydrator = createHydrator({
  map: schemaMap,
  load: (resource, where) =>
    fetchCachedRecordWithTargetEntitlements(
      resource.slice('db:'.length) as AccessorName,
      where as Record<string, string>,
    ),
});

export const hydrate = <T extends HydratedRecord>(
  accessor: AccessorName,
  record: T,
): Promise<T & HydratedRecord> => hydrator(`db:${accessor}`, record) as Promise<T & HydratedRecord>;
