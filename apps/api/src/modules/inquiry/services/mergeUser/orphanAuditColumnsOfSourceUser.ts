/**
 * @atlas
 * @kind service
 * @partOf feature:inquiry
 * @uses infrastructure:prisma
 */
import { db } from '@template/db';
import type { UserMerge } from '@template/db/lib/auditActorContext';

const ORPHANED_AUDIT_COLUMNS = ['actorUserId', 'actorSpoofUserId', 'contextUserId'] as const;

/** Clears the source user from the audit logs' actor, spoof and context columns before the user is deleted. These are the writes the columns' SetNull would make. */
export const orphanAuditColumnsOfSourceUser = async (merge: UserMerge): Promise<void> => {
  for (const column of ORPHANED_AUDIT_COLUMNS) {
    merge.plannedWrites.set(`AuditLog.${column}`, new Set([null]));
    await db.auditLog.updateManyAndReturn({
      where: { [column]: merge.sourceUserId },
      data: { [column]: null },
    });
  }
};
