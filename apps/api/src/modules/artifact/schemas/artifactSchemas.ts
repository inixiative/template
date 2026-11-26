/**
 * @atlas
 * @kind schema
 * @partOf feature:files
 * @uses infrastructure:prisma
 */
import { z } from '@hono/zod-openapi';
import type { LensNarrowing } from '@inixiative/json-rules';
import {
  ArtifactEffectivePermissionScalarSchema,
  ArtifactPermissionScalarSchema,
  ArtifactPlacementScalarInputSchema,
  ArtifactPlacementScalarSchema,
  ArtifactScalarInputSchema,
  ArtifactScalarSchema,
  ResourceBindingScalarSchema,
} from '@template/db';
import { Role } from '@template/db/generated/client/enums';
import { lensFor } from '@template/db/lens';
import { plainArtifactKinds } from '@template/shared/artifact';
import {
  makeContainerOrOwnerRefinement,
  ownerTargetFields,
} from '#/modules/artifact/schemas/artifactPlacementSchemas';

export const artifactCreateBodySchema = ArtifactScalarInputSchema.pick({ name: true })
  .extend({ kind: z.enum(plainArtifactKinds) })
  .extend(
    ArtifactPlacementScalarInputSchema.pick({ containerArtifactId: true, access: true }).partial()
      .shape,
  );

export const artifactUpdateBodySchema = ArtifactScalarInputSchema.pick({ name: true }).partial();

export const artifactReadResponseSchema = ArtifactScalarSchema;

export const artifactWithPermissionsSchema = ArtifactScalarSchema.extend({
  artifactPermissions: z.array(ArtifactPermissionScalarSchema),
});

const artifactPlacementAsArtifactSchema = ArtifactPlacementScalarSchema.extend({
  containerArtifact: artifactWithPermissionsSchema,
});

const artifactPlacementAsContainerSchema = ArtifactPlacementScalarSchema.extend({
  artifact: artifactWithPermissionsSchema.extend({ exclusive: z.boolean() }),
});

const artifactEffectivePermissionWithGrantSchema = ArtifactEffectivePermissionScalarSchema.extend({
  artifactPermission: ArtifactPermissionScalarSchema,
});

export const artifactDetailResponseSchema = ArtifactScalarSchema.extend({
  effectiveRole: z.enum(Role).nullable(),
  artifactPlacementsAsArtifact: z.array(artifactPlacementAsArtifactSchema),
  artifactPlacementsAsContainer: z.array(artifactPlacementAsContainerSchema),
  artifactPermissions: z.array(ArtifactPermissionScalarSchema),
  artifactEffectivePermissions: z.array(artifactEffectivePermissionWithGrantSchema),
  resourceBindings: z.array(ResourceBindingScalarSchema),
});

export const artifactListFilterLens: LensNarrowing = {
  parent: lensFor('Artifact'),
  root: { omits: ['deletedAt'] },
};

export const artifactCopyBodySchema = ArtifactScalarInputSchema.pick({ name: true })
  .partial()
  .extend(ownerTargetFields)
  .extend({
    targetContainerArtifactId: ArtifactPlacementScalarInputSchema.shape.containerArtifactId
      .min(1)
      .optional(),
  });

export const artifactCopyBodyRefinement = makeContainerOrOwnerRefinement(
  'targetContainerArtifactId',
  true,
);
