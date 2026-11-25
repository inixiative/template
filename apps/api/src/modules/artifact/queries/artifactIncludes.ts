/**
 * @atlas
 * @kind query
 * @partOf feature:files
 * @uses infrastructure:prisma
 */
import type { Prisma } from '@template/db';

export const includeArtifactDetail = {
  placements: {
    orderBy: { createdAt: 'asc' as const },
    include: {
      containerArtifact: {
        include: { permissions: { orderBy: { createdAt: 'asc' as const } } },
      },
    },
  },
  contents: {
    orderBy: { createdAt: 'asc' as const },
    include: {
      artifact: {
        include: {
          permissions: { orderBy: { createdAt: 'asc' as const } },
          placements: { select: { id: true } },
        },
      },
    },
  },
  permissions: { orderBy: { createdAt: 'asc' as const } },
  bindings: { orderBy: { createdAt: 'asc' as const } },
} satisfies Prisma.ArtifactInclude;
