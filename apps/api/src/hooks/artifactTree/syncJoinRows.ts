/**
 * @atlas
 * @kind utils
 * @partOf feature:files
 * @uses infrastructure:prisma
 */

type SyncJoinRowsOptions<Existing extends { id: string }, Desired> = {
  existing: Existing[];
  desired: Desired[];
  keyOfExisting: (row: Existing) => string;
  keyOfDesired: (row: Desired) => string;
  matches?: (existing: Existing, desired: Desired) => boolean;
  deleteIds: (ids: string[]) => Promise<unknown>;
  createRows: (rows: Desired[]) => Promise<unknown>;
};

export const syncJoinRows = async <Existing extends { id: string }, Desired>({
  existing,
  desired,
  keyOfExisting,
  keyOfDesired,
  matches,
  deleteIds,
  createRows,
}: SyncJoinRowsOptions<Existing, Desired>): Promise<void> => {
  const existingByKey = new Map(existing.map((row) => [keyOfExisting(row), row]));
  const toDeleteIds: string[] = [];
  const toCreate: Desired[] = [];

  for (const row of desired) {
    const key = keyOfDesired(row);
    const current = existingByKey.get(key);
    if (!current) {
      toCreate.push(row);
    } else {
      existingByKey.delete(key);
      if (matches && !matches(current, row)) {
        toDeleteIds.push(current.id);
        toCreate.push(row);
      }
    }
  }
  for (const stale of existingByKey.values()) toDeleteIds.push(stale.id);

  if (toDeleteIds.length > 0) await deleteIds(toDeleteIds);
  if (toCreate.length > 0) await createRows(toCreate);
};
