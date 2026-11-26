/**
 * @atlas
 * @kind schema
 * @partOf feature:files
 * @uses infrastructure:prisma
 */
import { z } from '@hono/zod-openapi';
import type { LensNarrowing } from '@inixiative/json-rules';
import {
  ArtifactPermissionScalarInputSchema,
  ArtifactPermissionScalarSchema,
  ArtifactScalarSchema,
} from '@template/db';
import { lensFor } from '@template/db/lens';

const fromVersionField = z.number().int().min(1).max(2_147_483_647).optional();

export const artifactPermissionCreateBodySchema = ArtifactPermissionScalarInputSchema.omit({
  artifactId: true,
}).extend({ fromVersion: fromVersionField });

export const artifactPermissionUpdateBodySchema = ArtifactPermissionScalarInputSchema.pick({
  role: true,
  expiresAt: true,
  preserveOnRevoke: true,
})
  .partial()
  .extend({ fromVersion: fromVersionField });

export const artifactPermissionReadResponseSchema = ArtifactPermissionScalarSchema;

export const artifactPermissionSharedResponseSchema = ArtifactPermissionScalarSchema.extend({
  artifact: ArtifactScalarSchema,
});

export const artifactPermissionListFilterLens: LensNarrowing = {
  parent: lensFor('ArtifactPermission'),
  root: {
    omits: ['deletedAt'],
    relations: { artifact: { omits: ['deletedAt'] } },
  },
};
