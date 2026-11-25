/**
 * @atlas
 * @kind schema
 * @partOf feature:files
 * @uses infrastructure:prisma
 */
import type { z } from '@hono/zod-openapi';
import type { LensNarrowing } from '@inixiative/json-rules';
import {
  ArtifactPermissionScalarInputSchema,
  ArtifactPermissionScalarSchema,
  ArtifactScalarSchema,
} from '@template/db';
import { lensFor } from '@template/db/lens';

export const ARTIFACT_PERMISSION_IMMUTABLE_FIELDS = ['artifactId'] as const;

export const artifactPermissionCreateBodySchema = ArtifactPermissionScalarInputSchema.omit({
  artifactId: true,
});

export const artifactPermissionUpdateBodySchema = ArtifactPermissionScalarInputSchema.pick({
  role: true,
  expiresAt: true,
  fromVersion: true,
  preserveOnRevoke: true,
}).partial();

const MAX_INT4 = 2_147_483_647;

export const artifactPermissionFromVersionRefinement = (body: unknown, ctx: z.RefinementCtx) => {
  const fromVersion = (body as { fromVersion?: unknown } | null)?.fromVersion;
  if (
    typeof fromVersion === 'number' &&
    (!Number.isInteger(fromVersion) || fromVersion < 1 || fromVersion > MAX_INT4)
  ) {
    ctx.addIssue({
      code: 'custom',
      path: ['fromVersion'],
      message: `fromVersion must be an integer between 1 and ${MAX_INT4}`,
    });
  }
};

export const artifactPermissionReadResponseSchema = ArtifactPermissionScalarSchema;

export const artifactPermissionSharedResponseSchema = ArtifactPermissionScalarSchema.extend({
  artifact: ArtifactScalarSchema,
});

export const artifactPermissionListFilterLens: LensNarrowing = {
  parent: lensFor('ArtifactPermission'),
  root: {
    omits: ['deletedAt'],
    relations: {
      artifact: {
        omits: ['deletedAt'],
      },
    },
  },
};
