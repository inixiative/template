/**
 * @atlas
 * @kind controller
 * @partOf feature:files
 * @uses primitive:routeTemplates, primitive:authz, primitive:batch
 */
import { columnsOf } from '@inixiative/field-map';
import type { ArtifactPermission, ResourceBinding } from '@template/db/generated/client/client';
import { prismaMap } from '@template/db/generated/prismaMap';
import { check, rebacSchema } from '@template/permissions/rebac';
import type { Context } from 'hono';
import { pick } from 'lodash-es';
import { actingUser } from '#/lib/context/actingUser';
import { contextResource } from '#/lib/context/contextResource';
import { makeController } from '#/lib/utils/makeController';
import {
  artifactEffectiveRole,
  hydrateArtifact,
  isArtifactPublic,
} from '#/modules/artifact/lib/checkArtifactPermission';
import { artifactReadRoute } from '#/modules/artifact/routes/artifactRead';
import { fetchArtifactAncestors } from '#/modules/artifact/services/fetchArtifactAncestors';
import { listableArtifacts } from '#/modules/artifact/services/listableArtifacts';
import { fetchAsCaller } from '#/modules/batch/services/fetchAsCaller';
import type { AppEnv } from '#/types/appEnv';

const ownerReadPath: Partial<
  Record<ResourceBinding['resourceModel'], (binding: ResourceBinding) => string>
> = {
  Organization: (binding) => `/api/v1/organization/${binding.resourceOrganizationId}`,
  Space: (binding) => `/api/v1/space/${binding.resourceSpaceId}`,
};

const visibleToCaller = async (c: Context<AppEnv>, binding: ResourceBinding): Promise<boolean> => {
  if (binding.resourceModel === 'User') return actingUser(c)?.id === binding.resourceUserId;
  const path = ownerReadPath[binding.resourceModel]?.(binding);
  if (!path) return false;
  const { status } = await fetchAsCaller(c, path);
  return status >= 200 && status < 300;
};

type EffectivePermItem = { permission?: ArtifactPermission | null };

const artifactPermissionColumns = columnsOf(prismaMap, 'ArtifactPermission');

const activeEffectivePermissions = (items: EffectivePermItem[]): ArtifactPermission[] => {
  const now = new Date();
  const seen = new Set<string>();
  const active: ArtifactPermission[] = [];
  for (const { permission } of items) {
    if (!permission || permission.deletedAt || seen.has(permission.id)) continue;
    if (permission.expiresAt && permission.expiresAt <= now) continue;
    seen.add(permission.id);
    active.push(pick(permission, artifactPermissionColumns) as ArtifactPermission);
  }
  return active;
};

export const artifactReadController = makeController(artifactReadRoute, async (c, respond) => {
  const db = c.get('db');
  const permix = c.get('permix');
  const artifact = contextResource<'artifact'>(c);
  const hydrated = await hydrateArtifact(artifact);
  const canManage = check(permix, rebacSchema, 'artifact', hydrated, 'manage');

  const rawParents = await db.artifact.findMany({
    where: { contents: { some: { artifactId: artifact.id } } },
    orderBy: { name: 'asc' },
  });
  const parents = await listableArtifacts(permix, rawParents);
  const visibleParentIds = new Set(parents.map((parent) => parent.id));
  const ancestors = await fetchArtifactAncestors(permix, artifact.id);

  const rawPlacements = await db.artifactPlacement.findMany({
    where: { artifactId: artifact.id },
    orderBy: { createdAt: 'asc' },
  });
  const placements = rawPlacements.filter((placement) =>
    visibleParentIds.has(placement.containerArtifactId),
  );

  const permissions = canManage
    ? await db.artifactPermission.findMany({
        where: { artifactId: artifact.id },
        orderBy: { createdAt: 'asc' },
      })
    : [];
  const effectivePermissions = canManage
    ? activeEffectivePermissions((hydrated.effectivePermissions ?? []) as EffectivePermItem[])
    : [];

  const rawBindings = await db.resourceBinding.findMany({
    where: { sourceArtifactId: artifact.id },
    orderBy: { createdAt: 'asc' },
  });
  const bindings: ResourceBinding[] = [];
  for (const binding of rawBindings) {
    if (await visibleToCaller(c, binding)) bindings.push(binding);
  }

  return respond.ok({
    ...artifact,
    effectiveAccess: {
      role: artifactEffectiveRole(permix, hydrated),
      public: isArtifactPublic(hydrated),
    },
    parents,
    ancestors,
    placements,
    permissions,
    effectivePermissions,
    bindings,
  });
});
