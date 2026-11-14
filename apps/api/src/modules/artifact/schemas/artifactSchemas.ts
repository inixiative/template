/**
 * @atlas
 * @kind schema
 * @partOf feature:files
 * @uses infrastructure:prisma
 */
import { z } from '@hono/zod-openapi';
import { ArtifactScalarInputSchema, ArtifactScalarSchema } from '@template/db';
import { ArtifactAccess, Role } from '@template/db/generated/client/enums';
import { type ArtifactKind, plainArtifactKinds } from '@template/shared/artifact';

export const ARTIFACT_CREATE_IMMUTABLE_FIELDS = [
  'ownerModel',
  'userId',
  'organizationId',
  'spaceId',
  'integrationId',
  'system',
] as const;

export const artifactCreateBodySchema = ArtifactScalarInputSchema.pick({ name: true }).extend({
  kind: z.enum(plainArtifactKinds as [ArtifactKind, ...ArtifactKind[]]),
  access: z.enum(ArtifactAccess).optional(),
  containerArtifactId: z.string().optional(),
});

export const artifactUpdateBodySchema = ArtifactScalarInputSchema.pick({
  name: true,
  access: true,
}).partial();

export const artifactReadResponseSchema = ArtifactScalarSchema;

export const artifactAccessResponseSchema = z.object({
  role: z.enum(Role).nullable(),
  public: z.boolean(),
});

export const artifactMoveBodySchema = z.object({
  fromContainerArtifactId: z.string().optional(),
  toContainerArtifactId: z.string().optional(),
});

export const artifactCopyBodySchema = z.object({
  containerArtifactId: z.string(),
  name: z.string().optional(),
});
