/**
 * @atlas
 * @kind schema
 * @partOf feature:files
 * @uses infrastructure:prisma
 */
import { z } from '@hono/zod-openapi';
import {
  ArtifactPermissionScalarSchema,
  ArtifactPlacementScalarSchema,
  ArtifactScalarInputSchema,
  ArtifactScalarSchema,
  ResourceBindingScalarSchema,
} from '@template/db';
import { ArtifactAccess, Role } from '@template/db/generated/client/enums';
import { type ArtifactKind, plainArtifactKinds } from '@template/shared/artifact';

export const ARTIFACT_CREATE_IMMUTABLE_FIELDS = [
  'ownerModel',
  'userId',
  'organizationId',
  'spaceId',
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

export const artifactDetailResponseSchema = ArtifactScalarSchema.extend({
  effectiveAccess: artifactAccessResponseSchema,
  parents: z.array(ArtifactScalarSchema),
  ancestors: z.object({
    artifacts: z.array(ArtifactScalarSchema),
    edges: z.array(z.object({ artifactId: z.string(), containerArtifactId: z.string() })),
  }),
  placements: z.array(ArtifactPlacementScalarSchema),
  permissions: z.array(ArtifactPermissionScalarSchema),
  effectivePermissions: z.array(ArtifactPermissionScalarSchema),
  bindings: z.array(ResourceBindingScalarSchema),
});

export const artifactMoveBodySchema = z.object({
  fromContainerArtifactId: z.string().optional(),
  toContainerArtifactId: z.string().optional(),
});

export const artifactCopyBodySchema = z.object({
  containerArtifactId: z.string(),
  name: z.string().optional(),
});
