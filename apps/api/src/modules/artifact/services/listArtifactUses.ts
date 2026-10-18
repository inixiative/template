/**
 * @atlas
 * @kind service
 * @partOf feature:files
 * @uses infrastructure:prisma, primitive:authz, primitive:batch
 */
import { db } from '@template/db';
import type { ArtifactPlacement, ResourceBinding } from '@template/db/generated/client/client';
import type { Context } from 'hono';
import { artifactActorFromContext } from '#/modules/artifact/lib/artifactActor';
import { artifactOwner } from '#/modules/artifact/lib/artifactOwner';
import type { ArtifactPrincipal } from '#/modules/artifact/lib/artifactPrincipal';
import { checkArtifactAccess } from '#/modules/artifact/services/checkArtifactAccess';
import { resolveArtifactAccess } from '#/modules/artifact/services/resolveArtifactAccess';
import { readAsCaller } from '#/modules/batch/services/readAsCaller';
import type { AppEnv } from '#/types/appEnv';

export type ArtifactUses = {
  owner: { ownerModel: string; ownerId: string };
  access: { public: boolean; grants: { principal: ArtifactPrincipal; role: string }[] };
  placements: ArtifactPlacement[];
  bindings: ResourceBinding[];
};

const ownerReadPath: Partial<
  Record<ResourceBinding['resourceModel'], (b: ResourceBinding) => string>
> = {
  Organization: (binding) => `/api/v1/organization/${binding.organizationId}`,
  Space: (binding) => `/api/v1/space/${binding.spaceId}`,
};

const visibleToCaller = async (c: Context<AppEnv>, binding: ResourceBinding): Promise<boolean> => {
  if (binding.resourceModel === 'User') return c.get('user')?.id === binding.userId;
  const path = ownerReadPath[binding.resourceModel]?.(binding);
  if (!path) return false;
  const { status } = await readAsCaller(c, path);
  return status >= 200 && status < 300;
};

export const listArtifactUses = async (
  c: Context<AppEnv>,
  artifactId: string,
): Promise<ArtifactUses> => {
  const actor = artifactActorFromContext(c);
  const [artifact, placements, bindings, resolutions] = await Promise.all([
    db.artifact.findUniqueOrThrow({ where: { id: artifactId } }),
    db.artifactPlacement.findMany({ where: { artifactId } }),
    db.resourceBinding.findMany({ where: { artifactId } }),
    resolveArtifactAccess([artifactId]),
  ]);
  const containers = await checkArtifactAccess(
    actor,
    placements.map((placement) => placement.containerArtifactId),
    'read',
  );
  const shownBindings: ResourceBinding[] = [];
  for (const binding of bindings) {
    if (await visibleToCaller(c, binding)) shownBindings.push(binding);
  }
  const resolution = resolutions.get(artifactId);
  return {
    owner: artifactOwner(artifact),
    access: {
      public: resolution?.public ?? false,
      grants: (resolution?.grants ?? []).map(({ principal, role }) => ({ principal, role })),
    },
    placements: placements.filter(
      (placement) => containers.get(placement.containerArtifactId)?.listed,
    ),
    bindings: shownBindings,
  };
};
