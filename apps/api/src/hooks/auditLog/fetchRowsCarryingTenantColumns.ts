/**
 * @atlas
 * @kind utils
 * @partOf feature:auditLogs
 * @uses infrastructure:prisma
 */
import { fieldAtPath } from '@inixiative/field-map';
import { fetchParentRows, type ModelName, parentEdgeOf, TENANT_COLUMNS } from '@template/db';
import { prismaMap } from '@template/db/generated/prismaMap';

type Row = Record<string, unknown>;

export type ContextRow = { model: ModelName; row: Row };

const carriesTenant = (model: ModelName): boolean =>
  model === 'Organization' ||
  TENANT_COLUMNS.some((column) => fieldAtPath(prismaMap, model, column));

/** The row whose tenant columns an audit entry takes: the record's own, or else up its parent edges. */
export const fetchRowsCarryingTenantColumns = async (
  model: ModelName,
  records: Row[],
): Promise<ContextRow[]> => {
  if (carriesTenant(model) || !parentEdgeOf(model)) return records.map((row) => ({ model, row }));
  const parents = await fetchParentRows(model, records);
  return Promise.all(
    parents.map(async (parent, index) =>
      parent
        ? ((await fetchRowsCarryingTenantColumns(parent.model, [parent.row]))[0] ?? parent)
        : { model, row: records[index] ?? {} },
    ),
  );
};
