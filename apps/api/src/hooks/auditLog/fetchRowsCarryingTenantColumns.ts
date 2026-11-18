/**
 * @atlas
 * @kind utils
 * @partOf feature:auditLogs
 * @uses infrastructure:prisma
 */
import { fetchParentRows, type ModelName, modelFieldAtPath, parentEdgeOf } from '@template/db';

type Row = Record<string, unknown>;

export type ContextRow = { model: ModelName; row: Row };

const TENANT_COLUMNS = ['organizationId', 'spaceId', 'userId'] as const;

const carriesTenant = (model: ModelName): boolean =>
  model === 'Organization' || TENANT_COLUMNS.some((column) => modelFieldAtPath(model, column));

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
