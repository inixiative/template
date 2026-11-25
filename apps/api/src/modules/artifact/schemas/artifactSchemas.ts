/**
 * @atlas
 * @kind schema
 * @partOf feature:files
 * @uses infrastructure:prisma
 */
import { z } from '@hono/zod-openapi';
import type { LensNarrowing } from '@inixiative/json-rules';
import {
  ArtifactPermissionScalarSchema,
  ArtifactPlacementScalarSchema,
  ArtifactScalarInputSchema,
  ArtifactScalarSchema,
  ResourceBindingScalarSchema,
} from '@template/db';
import { ArtifactAccess, Role } from '@template/db/generated/client/enums';
import { lensFor } from '@template/db/lens';
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

export const artifactWithPermissionsSchema = ArtifactScalarSchema.extend({
  permissions: z.array(ArtifactPermissionScalarSchema),
});

export const artifactChildSchema = artifactWithPermissionsSchema.extend({
  exclusive: z.boolean(),
});

export const artifactAccessResponseSchema = z.object({
  role: z.enum(Role).nullable(),
  access: z.enum(['public', 'tenant', 'private']),
});

export const artifactDetailResponseSchema = ArtifactScalarSchema.extend({
  effectiveAccess: artifactAccessResponseSchema,
  parents: z.array(artifactWithPermissionsSchema),
  children: z.array(artifactChildSchema),
  placements: z.array(ArtifactPlacementScalarSchema),
  permissions: z.array(ArtifactPermissionScalarSchema),
  effectivePermissions: z.array(ArtifactPermissionScalarSchema),
  bindings: z.array(ResourceBindingScalarSchema),
});

export const artifactListFilterLens: LensNarrowing = {
  parent: lensFor('Artifact'),
  root: {
    omits: ['deletedAt'],
  },
};

export const artifactMoveBodySchema = z.object({
  fromContainerArtifactId: z.string().optional(),
  toContainerArtifactId: z.string().optional(),
});

export const artifactCopyBodySchema = z.object({
  containerArtifactId: z.string(),
  name: z.string().optional(),
});
