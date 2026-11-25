/**
 * @atlas
 * @kind schema
 * @partOf feature:files
 * @uses infrastructure:prisma
 */
import { z } from '@hono/zod-openapi';
import type { LensNarrowing } from '@inixiative/json-rules';
import { ArtifactPlacementScalarSchema, ArtifactScalarSchema } from '@template/db';
import { ArtifactAccess, ArtifactOwnerModel } from '@template/db/generated/client/enums';
import { lensFor } from '@template/db/lens';
import { polymorphicBodyRefinement } from '#/lib/routeTemplates/polymorphicBodyRefinement';

export const artifactPlacementCreateBodySchema = z.object({
  containerArtifactId: z.string().optional(),
  ownerModel: z.enum(ArtifactOwnerModel).optional(),
  userId: z.string().optional(),
  organizationId: z.string().optional(),
  spaceId: z.string().optional(),
  access: z.enum(ArtifactAccess).optional(),
});

const ownerPlacementRefinement = polymorphicBodyRefinement('Artifact', 'ownerModel');
const OWNER_FK_KEYS = ['userId', 'organizationId', 'spaceId'] as const;

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
      if (body[column] !== undefined) {
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

export const artifactPlacementUpdateBodySchema = z.object({
  access: z.enum(ArtifactAccess),
});

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
