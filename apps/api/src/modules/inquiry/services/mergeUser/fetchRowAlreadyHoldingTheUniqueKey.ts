/**
 * @atlas
 * @kind service
 * @partOf feature:inquiry
 * @uses infrastructure:prisma
 */
import { db, type ModelName, SOFT_DELETE_MODEL_SET, uniqueKeysOnColumn } from '@template/db';
import { uniqBy } from 'lodash-es';
import type { Row } from '#/modules/inquiry/services/mergeUser/repoint';

/** The other row already holding a unique key that `row` would take once `data` is written, or null when the write collides with nothing. */
export const fetchRowAlreadyHoldingTheUniqueKey = async (
  model: ModelName,
  row: Row,
  data: Record<string, unknown>,
): Promise<Row | null> => {
  const written = { ...row, ...data };
  const uniqueKeys = uniqBy(
    Object.keys(data).flatMap((column) => uniqueKeysOnColumn(model, column)),
    'indexName',
  );
  for (const { fields, predicate } of uniqueKeys) {
    if (fields.some((field) => written[field] == null)) continue;
    const keyAppliesToRow = await db.withDeleted(() =>
      db.delegate(model).count({ where: { id: row.id, ...predicate } }),
    );
    if (keyAppliesToRow === 0) continue;
    const held = (await db.withDeleted(() =>
      db.delegate(model).findFirst({
        where: {
          ...predicate,
          ...Object.fromEntries(fields.map((field) => [field, written[field]])),
          id: { not: row.id },
        },
        select: { id: true, ...(SOFT_DELETE_MODEL_SET.has(model) && { deletedAt: true }) },
      }),
    )) as Row | null;
    if (held) return held;
  }
  return null;
};
