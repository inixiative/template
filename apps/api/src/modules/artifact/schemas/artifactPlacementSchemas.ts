/**
 * @atlas
 * @kind schema
 * @partOf feature:files
 * @uses infrastructure:prisma
 */
import { z } from '@hono/zod-openapi';
import { ArtifactPlacementScalarSchema } from '@template/db';

export const artifactPlacementCreateBodySchema = z.object({
  containerArtifactId: z.string(),
  inherit: z.boolean().optional(),
});

export const artifactPlacementReadResponseSchema = ArtifactPlacementScalarSchema;
