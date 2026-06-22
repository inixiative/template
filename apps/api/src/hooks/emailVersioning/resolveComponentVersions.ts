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
  | 'id'
  | 'slug'
  | 'componentRefs'
  | 'degradedComponentRefs'
  | 'ownerModel'
  | 'organizationId'
  | 'spaceId'
  | 'userId'
  | 'locale'
  | 'deletedAt'
>;

const ownerScopeOf = (record: VersionedRecord): OwnerScope => ({
  ownerModel: record.ownerModel,
  organizationId: record.organizationId,
  spaceId: record.spaceId,
  userId: record.userId,
  locale: record.locale,
});

export const resolveComponentVersions = async (record: VersionedRecord): Promise<Record<string, string | null>> => {
  const refs = [...new Set(record.componentRefs ?? [])];
  if (!refs.length) return {};

  const children = await lookupCascade(refs, ownerScopeOf(record));
  const componentIds = refs.map((slug) => children[slug]?.id).filter((id): id is string => Boolean(id));

  const snapshots = componentIds.length
    ? await db.auditLog.findMany({ where: { subjectEmailComponentId: { in: componentIds } }, orderBy: { id: 'desc' } })
    : [];

  const latestByComponent = new Map<string, string>();
  for (const snapshot of snapshots) {
    if (snapshot.subjectEmailComponentId && !latestByComponent.has(snapshot.subjectEmailComponentId)) {
      latestByComponent.set(snapshot.subjectEmailComponentId, snapshot.id);
    }
  }

  const versions: Record<string, string | null> = {};
  for (const slug of refs) {
    const childId = children[slug]?.id;
    versions[slug] = childId ? (latestByComponent.get(childId) ?? null) : null;
  }
  return versions;
};
