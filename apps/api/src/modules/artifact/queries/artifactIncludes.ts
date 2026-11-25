/**
 * @atlas
 * @kind query
 * @partOf feature:files
 * @uses infrastructure:prisma
 */
import type { Prisma } from '@template/db';

export const includeArtifactDetail = {
  artifactPlacementsAsArtifact: {
    where: { containerArtifact: { deletedAt: null } },
    orderBy: { createdAt: 'asc' as const },
    include: {
      containerArtifact: {
        include: { artifactPermissions: { orderBy: { createdAt: 'asc' as const } } },
      },
    },
  },
  artifactPlacementsAsContainer: {
    where: { artifact: { deletedAt: null } },
    orderBy: { createdAt: 'asc' as const },
    include: {
      artifact: {
        include: {
          artifactPermissions: { orderBy: { createdAt: 'asc' as const } },
          artifactPlacementsAsArtifact: {
            where: { containerArtifact: { deletedAt: null } },
            select: {
              id: true,
              containerArtifact: {
                select: {
                  ownerModel: true,
                  userId: true,
                  organizationId: true,
                  spaceId: true,
                },
              },
            },
          },
        },
      },
    },
  },
  artifactPermissions: { orderBy: { createdAt: 'asc' as const } },
  resourceBindings: { orderBy: { createdAt: 'asc' as const } },
} satisfies Prisma.ArtifactInclude;
