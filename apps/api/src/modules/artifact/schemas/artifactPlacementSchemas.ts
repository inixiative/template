/**
 * @atlas
 * @kind schema
 * @partOf feature:files
 * @uses infrastructure:prisma
 */
import { z } from '@hono/zod-openapi';
import type { LensNarrowing } from '@inixiative/json-rules';
import {
  ArtifactPlacementScalarInputSchema,
  ArtifactPlacementScalarSchema,
  ArtifactScalarInputSchema,
  ArtifactScalarSchema,
  polymorphicAxis,
  sideKeyColumns,
} from '@template/db';
import { lensFor } from '@template/db/lens';
import { polymorphicBodyRefinement } from '#/lib/routeTemplates/polymorphicBodyRefinement';

export const ownerTargetFields = ArtifactScalarInputSchema.pick({
  ownerModel: true,
  userId: true,
  organizationId: true,
  spaceId: true,
}).partial().shape;

const ownerPlacementRefinement = polymorphicBodyRefinement('Artifact', 'ownerModel');
const OWNER_FK_KEYS = sideKeyColumns(polymorphicAxis('Artifact', 'ownerModel'));

export const makeContainerOrOwnerRefinement =
  (containerField: 'containerArtifactId' | 'targetContainerArtifactId', allowEmpty = false) =>
  (body: Record<string, unknown>, ctx: z.RefinementCtx) => {
    const hasContainer = body[containerField] !== undefined;
    const hasOwner = body.ownerModel !== undefined;
    if (hasContainer && hasOwner) {
      ctx.addIssue({
        code: 'custom',
        message: `Provide either ${containerField} or ownerModel (not both)`,
      });
      return;
    }
    if (hasOwner) {
      ownerPlacementRefinement(body, ctx);
      return;
    }
    if (!hasContainer && !allowEmpty) {
      ctx.addIssue({
        code: 'custom',
        message: `Provide either ${containerField} or ownerModel (not both)`,
      });
      return;
    }
    const reason = hasContainer
      ? `cannot be combined with ${containerField}`
      : 'requires ownerModel';
    for (const column of OWNER_FK_KEYS) {
      if (body[column] !== undefined && body[column] !== null) {
        ctx.addIssue({ code: 'custom', path: [column], message: `${column} ${reason}` });
      }
    }
  };

export const artifactPlacementCreateBodySchema = ArtifactPlacementScalarInputSchema.pick({
  readAccess: true,
  operateAccess: true,
})
  .partial()
  .extend({
    containerArtifactId: ArtifactPlacementScalarInputSchema.shape.containerArtifactId
      .min(1)
      .optional(),
  })
  .extend(ownerTargetFields);

export const artifactPlacementCreateBodyRefinement = makeContainerOrOwnerRefinement(
  'containerArtifactId',
  false,
);

export const artifactPlacementMoveBodySchema = z.object({
  targetContainerArtifactId: ArtifactPlacementScalarInputSchema.shape.containerArtifactId
    .min(1)
    .optional(),
  readAccess: ArtifactPlacementScalarInputSchema.shape.readAccess.optional(),
  operateAccess: ArtifactPlacementScalarInputSchema.shape.operateAccess.optional(),
});

export const artifactPlacementUpdateBodySchema = ArtifactPlacementScalarInputSchema.pick({
  readAccess: true,
  operateAccess: true,
}).partial();

export const artifactPlacementUpdateBodyRefinement = (
  body: { readAccess?: unknown; operateAccess?: unknown },
  ctx: z.RefinementCtx,
) => {
  if (body.readAccess === undefined && body.operateAccess === undefined) {
    ctx.addIssue({ code: 'custom', message: 'Provide readAccess or operateAccess' });
  }
};

export const artifactPlacementReadResponseSchema = ArtifactPlacementScalarSchema;

export const artifactPlacementWithArtifactsSchema = ArtifactPlacementScalarSchema.extend({
  artifact: ArtifactScalarSchema,
  containerArtifact: ArtifactScalarSchema,
});

export const artifactPlacementListFilterLens: LensNarrowing = {
  parent: lensFor('ArtifactPlacement'),
  root: {
    relations: {
      artifact: { omits: ['deletedAt'] },
      containerArtifact: { omits: ['deletedAt'] },
    },
  },
};
