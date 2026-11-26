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
} from '@template/db';
import { lensFor } from '@template/db/lens';
import { polymorphicBodyRefinement } from '#/lib/routeTemplates/polymorphicBodyRefinement';

const ownerTargetFields = ArtifactScalarInputSchema.pick({
  ownerModel: true,
  userId: true,
  organizationId: true,
  spaceId: true,
}).partial().shape;

const ownerPlacementRefinement = polymorphicBodyRefinement('Artifact', 'ownerModel');
const OWNER_FK_KEYS = [
  ...new Set(Object.values(polymorphicAxis('Artifact', 'ownerModel').fkMap).flat()),
] as ('userId' | 'organizationId' | 'spaceId')[];

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
    if (!hasContainer && !hasOwner) {
      if (!allowEmpty) {
        ctx.addIssue({
          code: 'custom',
          message: `Provide either ${containerField} or ownerModel (not both)`,
        });
        return;
      }
      for (const column of OWNER_FK_KEYS) {
        if (body[column] !== undefined && body[column] !== null) {
          ctx.addIssue({
            code: 'custom',
            path: [column],
            message: `${column} requires ownerModel`,
          });
        }
      }
      return;
    }
    if (hasContainer) {
      for (const column of OWNER_FK_KEYS) {
        if (body[column] !== undefined && body[column] !== null) {
          ctx.addIssue({
            code: 'custom',
            path: [column],
            message: `${column} cannot be combined with ${containerField}`,
          });
        }
      }
      return;
    }
    ownerPlacementRefinement(body, ctx);
  };

export const artifactPlacementCreateBodySchema = ArtifactPlacementScalarInputSchema.pick({
  access: true,
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
  access: ArtifactPlacementScalarInputSchema.shape.access.optional(),
});

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
    relations: {
      artifact: { omits: ['deletedAt'] },
      containerArtifact: { omits: ['deletedAt'] },
    },
  },
};
