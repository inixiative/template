/**
 * @atlas
 * @kind service
 * @partOf feature:inquiry, primitive:caching
 * @uses infrastructure:prisma
 */
import { db } from '@template/db';
import { queueCacheClear } from '#/hooks/cache/queueCacheClear';
import { queueCacheClearForMovedRows } from '#/hooks/cache/queueCacheClearForMovedRows';
import { spaceKeyColumns } from '#/modules/inquiry/services/transferSpace/spaceKeyColumns';

// why: the space's organization reaches these rows by ON UPDATE CASCADE, which the cache hook never sees.
export const clearSpaceRowCaches = async (spaceId: string, organizationId: string) => {
  await queueCacheClearForMovedRows((model) =>
    spaceKeyColumns(model).map(({ spaceField, organizationField }) => ({
      where: { [spaceField]: spaceId },
      priorValues: { [organizationField]: organizationId },
    })),
  );
  const sharedArtifacts = await db.artifactEffectivePermission.findMany({
    where: {
      artifactPermission: {
        OR: [
          { granteeSpaceId: spaceId },
          { granteeCustomerRelationship: { customerSpaceId: spaceId } },
        ],
      },
    },
    select: { artifactId: true },
  });
  if (sharedArtifacts.length > 0) {
    await queueCacheClear(
      'Artifact',
      [...new Set(sharedArtifacts.map((row) => row.artifactId))].map((id) => ({ id })),
    );
  }
};
