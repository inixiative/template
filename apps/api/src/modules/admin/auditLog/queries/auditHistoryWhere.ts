/**
 * @atlas
 * @kind query
 * @partOf feature:auditLogs
 * @uses infrastructure:prisma
 */
import {
  childrenOf,
  hasDeletedAt,
  isAuditEnabled,
  type ParentRow,
  type Prisma,
  polymorphicArmRelation,
} from '@template/db';
import type { AuditSubjectModel } from '@template/db/generated/client/enums';

// why: `deletedAt: undefined` opts the subject out of the live scope, so a tombstoned child still joins.
const subjectIs = (
  model: AuditSubjectModel,
  where: Record<string, string>,
): Prisma.AuditLogWhereInput => ({
  subjectModel: model,
  [polymorphicArmRelation('AuditLog', 'subjectModel', model).field]: {
    ...where,
    ...(hasDeletedAt(model) ? { deletedAt: undefined } : {}),
  },
});

/** A record's audit entries (by its dual id, so entries written after a hard delete count) and those of every registered child whose parent it is, as one where. */
export const auditHistoryWhere = (subject: ParentRow & { model: AuditSubjectModel }) => ({
  OR: [
    { subjectModel: subject.model, subjectId: subject.id },
    ...childrenOf(subject).flatMap(({ child, where }) =>
      isAuditEnabled(child) ? [subjectIs(child, where)] : [],
    ),
  ],
});
