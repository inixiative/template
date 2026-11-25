/**
 * @atlas
 * @kind schema
 * @partOf feature:files
 * @uses infrastructure:prisma
 */
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

export const artifactPermissionReadResponseSchema = ArtifactPermissionScalarSchema;

export const artifactPermissionSharedResponseSchema = ArtifactPermissionScalarSchema.extend({
  artifact: ArtifactScalarSchema,
});

export const artifactPermissionListFilterLens: LensNarrowing = {
  parent: lensFor('ArtifactPermission'),
  root: {
    relations: {
      artifact: {},
    },
  },
};
