/**
 * @atlas
 * @kind schema
 * @partOf feature:files
 * @uses infrastructure:prisma
 */
import { z } from '@hono/zod-openapi';
import type { LensNarrowing } from '@inixiative/json-rules';
import { ArtifactPlacementScalarSchema, ArtifactScalarSchema } from '@template/db';
import { lensFor } from '@template/db/lens';

export const artifactPlacementCreateBodySchema = z.object({
  containerArtifactId: z.string(),
  inherit: z.boolean().optional(),
});

export const artifactRootPlacementCreateBodySchema = z.object({
  artifactId: z.string(),
});

export const artifactPlacementReadResponseSchema = ArtifactPlacementScalarSchema;

export const artifactPlacementWithArtifactsSchema = ArtifactPlacementScalarSchema.extend({
  artifact: ArtifactScalarSchema,
  containerArtifact: ArtifactScalarSchema.nullable(),
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
