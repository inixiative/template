/**
 * @atlas
 * @kind service
 * @partOf feature:files
 * @uses infrastructure:prisma, mutex
 */
import { db } from '@template/db';
import type { Artifact } from '@template/db/generated/client/client';

const folderKey = (userId: string) => `organizationUser:${userId}`;

export const findOrganizationUserFolder = (
  organizationId: string,
  userId: string,
): Promise<Artifact | null> =>
  db.artifact.findFirst({
    where: { ownerModel: 'Organization', organizationId, systemKey: folderKey(userId) },
  });

export const ensureOrganizationUserFolder = (organizationId: string, userId: string) =>
  db.txn(async () => {
    const [existing] = await db.findForUpdate<Artifact>(
      'Artifact',
      { organizationId, systemKey: folderKey(userId) },
      { upserting: true },
    );
    const folder =
      existing && !existing.deletedAt
        ? existing
        : await db.artifact.create({
            data: {
              ownerModel: 'Organization',
              organizationId,
              kind: 'organizationUserFolder',
              type: 'container',
              name: 'Mine',
              system: true,
              systemKey: folderKey(userId),
              access: 'private',
            },
          });

    const membership = await db.organizationUser.findUnique({
      where: { organizationId_userId: { organizationId, userId } },
    });
    if (!membership) return folder;
    const granted = await db.artifactPermission.count({
      where: {
        artifactId: folder.id,
        granteeModel: 'OrganizationUser',
        granteeOrganizationId: organizationId,
        granteeUserId: userId,
      },
    });
    if (granted === 0) {
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
    return folder;
  });
