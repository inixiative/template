/**
 * @atlas
 * @kind schema
 * @partOf feature:files
 * @uses infrastructure:prisma
 */
import type { z } from '@hono/zod-openapi';
import type { LensNarrowing } from '@inixiative/json-rules';
import {
  ArtifactPlacementScalarInputSchema,
  ArtifactPlacementScalarSchema,
  ArtifactScalarInputSchema,
  ArtifactScalarSchema,
  polymorphicAxis,
} from '@template/db';
import { lensFor } from '@template/db/lens';
import { polymorphicBodyRefinement } from '#/lib/routeTemplates/polymorphicBodyRefinement';

export const artifactPlacementCreateBodySchema = ArtifactPlacementScalarInputSchema.pick({
  containerArtifactId: true,
  access: true,
})
  .partial()
  .extend(
    ArtifactScalarInputSchema.pick({
      ownerModel: true,
      userId: true,
      organizationId: true,
      spaceId: true,
    }).partial().shape,
  );

const ownerPlacementRefinement = polymorphicBodyRefinement('Artifact', 'ownerModel');
const OWNER_FK_KEYS = [
  ...new Set(Object.values(polymorphicAxis('Artifact', 'ownerModel').fkMap).flat()),
] as ('userId' | 'organizationId' | 'spaceId')[];

export const artifactPlacementCreateBodyRefinement = (
  body: z.infer<typeof artifactPlacementCreateBodySchema>,
  ctx: z.RefinementCtx,
) => {
  const hasContainer = body.containerArtifactId !== undefined;
  const hasOwner = body.ownerModel !== undefined;
  if (hasContainer === hasOwner) {
    ctx.addIssue({
      code: 'custom',
      message: 'Provide either containerArtifactId or ownerModel (not both)',
    });
    return;
  }
  if (hasContainer) {
    for (const column of OWNER_FK_KEYS) {
      if (body[column] !== undefined && body[column] !== null) {
        ctx.addIssue({
          code: 'custom',
          path: [column],
          message: `${column} cannot be combined with containerArtifactId`,
        });
      }
    }
    return;
  }
  ownerPlacementRefinement(body as Record<string, unknown>, ctx);
};

export const artifactPlacementUpdateBodySchema = ArtifactPlacementScalarInputSchema.pick({
  access: true,
}).required();

export const artifactPlacementReadResponseSchema = ArtifactPlacementScalarSchema;

export const artifactPlacementWithArtifactsSchema = ArtifactPlacementScalarSchema.extend({
  artifact: ArtifactScalarSchema,
  containerArtifact: ArtifactScalarSchema,
});

export const artifactPlacementListFilterLens: LensNarrowing = {
  parent: lensFor('ArtifactPlacement'),
  root: {
    omits: ['deletedAt'],
    relations: {
      artifact: { omits: ['deletedAt'] },
      containerArtifact: { omits: ['deletedAt'] },
    },
  },
};
