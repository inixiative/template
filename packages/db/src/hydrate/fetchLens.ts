/**
 * @atlas
 * @kind helper
 * @partOf infrastructure:prisma
 * @uses none
 */
import {
  executePrismaPlan,
  getLensRoot,
  type Lens,
  type LensNarrowing,
  projectRows,
  toLensSelect,
  toPrisma,
} from '@inixiative/json-rules';
import { db } from '@template/db/client';
import { requireWhere } from '@template/db/hydrate/requireWhere';
import { toModelName } from '@template/db/utils/modelNames';

export const fetchLens = async <T extends Record<string, unknown> = Record<string, unknown>>(
  lens: Lens | LensNarrowing,
): Promise<T[]> => {
  const where = await executePrismaPlan(toPrisma(true, { lens }), db as never);
  requireWhere(where);
  const delegate = db.delegate(toModelName(getLensRoot(lens).model));
  const { select } = toLensSelect(lens);
  const rows = (await delegate.findMany({ where, select })) as T[];
  return projectRows(lens, rows, { keepGrantColumns: true }) as T[];
};
