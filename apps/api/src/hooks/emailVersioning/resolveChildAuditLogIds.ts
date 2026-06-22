/**
 * @atlas
 * @kind query
 * @partOf feature:email
 * @uses infrastructure:prisma, feature:email
 */
import { db } from '@template/db';
import type { EmailComponent, EmailTemplate } from '@template/db/generated/client/client';
import { lookupCascade, type OwnerScope } from '@template/email/render';

export type VersionedRecord = Pick<
  EmailTemplate | EmailComponent,
  'id' | 'slug' | 'componentRefs' | 'ownerModel' | 'organizationId' | 'spaceId' | 'userId' | 'locale' | 'deletedAt'
>;

const ownerScopeOf = (record: VersionedRecord): OwnerScope => ({
  ownerModel: record.ownerModel,
  organizationId: record.organizationId,
  spaceId: record.spaceId,
  userId: record.userId,
  locale: record.locale,
});

export const resolveChildAuditLogIds = async (record: VersionedRecord): Promise<string[]> => {
  const refs = record.componentRefs ?? [];
  if (!refs.length) return [];

  const children = await lookupCascade(refs, ownerScopeOf(record));
  const childIds = [...new Set(refs)].map((slug) => children[slug]?.id).filter((id): id is string => Boolean(id));
  if (!childIds.length) return [];

  const snapshots = await db.auditLog.findMany({
    where: { subjectEmailComponentId: { in: childIds } },
    orderBy: { id: 'desc' },
  });

  const latestByComponent = new Map<string, string>();
  for (const snapshot of snapshots) {
    if (snapshot.subjectEmailComponentId && !latestByComponent.has(snapshot.subjectEmailComponentId)) {
      latestByComponent.set(snapshot.subjectEmailComponentId, snapshot.id);
    }
  }

  return childIds
    .map((id) => latestByComponent.get(id))
    .filter((id): id is string => Boolean(id))
    .sort();
};
