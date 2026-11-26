/**
 * @atlas
 * @kind query
 * @partOf feature:files
 * @uses infrastructure:prisma
 */
import type { Prisma } from '@template/db';

export const includeArtifactDetail = {
  artifactPlacementsAsArtifact: {
    orderBy: { createdAt: 'asc' as const },
    include: {
      containerArtifact: {
        include: { artifactPermissions: { orderBy: { createdAt: 'asc' as const } } },
      },
    },
  },
  artifactPlacementsAsContainer: {
    orderBy: { createdAt: 'asc' as const },
    include: {
      artifact: {
        include: {
          artifactPermissions: { orderBy: { createdAt: 'asc' as const } },
          artifactPlacementsAsArtifact: {
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
  artifactEffectivePermissions: { include: { artifactPermission: true } },
  resourceBindings: { orderBy: { createdAt: 'asc' as const } },
} satisfies Prisma.ArtifactInclude;
