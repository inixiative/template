/**
 * @atlas
 * @kind query
 * @partOf feature:files
 * @uses infrastructure:prisma
 */
import type { Prisma } from '@template/db';

export const includeArtifactDetail = {
  placements: {
    where: { containerArtifact: { deletedAt: null } },
    orderBy: { createdAt: 'asc' as const },
    include: {
      containerArtifact: {
        include: { permissions: { orderBy: { createdAt: 'asc' as const } } },
      },
    },
  },
  contents: {
    where: { artifact: { deletedAt: null } },
    orderBy: { createdAt: 'asc' as const },
    include: {
      artifact: {
        include: {
          permissions: { orderBy: { createdAt: 'asc' as const } },
          placements: {
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
  permissions: { orderBy: { createdAt: 'asc' as const } },
  bindings: { orderBy: { createdAt: 'asc' as const } },
} satisfies Prisma.ArtifactInclude;
