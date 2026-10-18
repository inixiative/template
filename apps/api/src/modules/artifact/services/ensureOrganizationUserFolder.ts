/**
 * @atlas
 * @kind service
 * @partOf feature:files
 * @uses infrastructure:prisma
 */
import { db } from '@template/db';
import type { Artifact } from '@template/db/generated/client/client';

export const findOrganizationUserFolder = (
  organizationId: string,
  userId: string,
): Promise<Artifact | null> =>
  db.artifact.findFirst({
    where: {
      ownerModel: 'Organization',
      organizationId,
      kind: 'organizationUserFolder',
      permissions: { some: { granteeUserId: userId, role: 'owner' } },
    },
  });

export const ensureOrganizationUserFolder = async (
  organizationId: string,
  userId: string,
): Promise<Artifact> => {
  const membership = await db.organizationUser.findUnique({
    where: { organizationId_userId: { organizationId, userId } },
  });
  const folder =
    (await findOrganizationUserFolder(organizationId, userId)) ??
    (await db.artifact.create({
      data: {
        ownerModel: 'Organization',
        organizationId,
        kind: 'organizationUserFolder',
        type: 'container',
        name: 'Mine',
        system: true,
        access: 'private',
      },
    }));

  const grants = await db.artifactPermission.findMany({
    where: { artifactId: folder.id, granteeUserId: userId, role: 'owner' },
  });
  const memberGrant = grants.find((grant) => grant.granteeModel === 'OrganizationUser');
  const pendingGrant = grants.find((grant) => grant.granteeModel === 'User');

  if (membership && !memberGrant) {
    await db.artifactPermission.create({
      data: {
        artifactId: folder.id,
        granteeModel: 'OrganizationUser',
        granteeOrganizationId: organizationId,
        granteeUserId: userId,
        role: 'owner',
      },
    });
  }
  if (membership && pendingGrant) {
    await db.artifactPermission.update({
      where: { id: pendingGrant.id },
      data: { deletedAt: new Date() },
    });
  }
  if (!membership && !pendingGrant) {
    await db.artifactPermission.create({
      data: { artifactId: folder.id, granteeModel: 'User', granteeUserId: userId, role: 'owner' },
    });
  }
  return folder;
};
