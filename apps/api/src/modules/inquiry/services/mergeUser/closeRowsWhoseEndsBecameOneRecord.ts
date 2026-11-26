/**
 * @atlas
 * @kind service
 * @partOf feature:inquiry
 * @uses infrastructure:prisma
 */
import { db, type ModelName, SOFT_DELETE_MODEL_SET } from '@template/db';
import {
  CLOSE_ON_PARENT_DELETE,
  closeChildren,
  isClosedOnParentDelete,
} from '#/hooks/softDeleteCascade/closeOnParentDelete';
import { fetchEdgeRowsPointingAtThemselves } from '#/modules/inquiry/services/mergeUser/fetchEdgeRowsPointingAtThemselves';

const closeRows = async (model: ModelName, ids: string[]) => {
  if (isClosedOnParentDelete(model))
    return closeChildren(model, { id: { in: ids } }, CLOSE_ON_PARENT_DELETE[model]!);
  if (SOFT_DELETE_MODEL_SET.has(model))
    return db.delegate(model).updateManyAndReturn({
      where: { id: { in: ids }, deletedAt: null },
      data: { deletedAt: new Date() },
    });
  return db.delegate(model).deleteMany({ where: { id: { in: ids } } });
};

/** After a merge, closes each edge on the user's rows whose two ends became one record, as that record's delete would: an open inquiry is canceled, a soft-delete row tombstoned, any other row deleted. Edges in `alreadyOneRecord` (`Model.id`) pointed at themselves before the merge and are left alone. */
export const closeRowsWhoseEndsBecameOneRecord = async (
  userId: string,
  alreadyOneRecord: ReadonlySet<string>,
) => {
  for (const { model, ids } of await fetchEdgeRowsPointingAtThemselves([userId])) {
    const becameOneRecord = ids.filter((id) => !alreadyOneRecord.has(`${model}.${id}`));
    if (becameOneRecord.length > 0) await closeRows(model, becameOneRecord);
  }
};
