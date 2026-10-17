/**
 * @atlas
 * @kind schema
 * @partOf feature:files
 * @uses infrastructure:prisma
 */
import { z } from '@hono/zod-openapi';
import { ArtifactContainerScalarSchema } from '@template/db';

export const artifactContainerCreateBodySchema = z.object({
  containerArtifactId: z.string(),
  inherit: z.boolean().optional(),
});

export const artifactContainerReadResponseSchema = ArtifactContainerScalarSchema;
