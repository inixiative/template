/**
 * @atlas
 * @kind schema
 * @partOf feature:files
 * @uses infrastructure:prisma
 */
import { ArtifactPermissionScalarInputSchema, ArtifactPermissionScalarSchema } from '@template/db';

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
