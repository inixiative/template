/**
 * @atlas
 * @kind controller
 * @partOf feature:files
 * @uses primitive:routeTemplates, primitive:authz
 */
import { columnsOf } from '@inixiative/field-map';
import {
  type AccessorName,
  db,
  type HydratedRecord,
  hydrate,
  rowPolymorphicAxisPointsAt,
} from '@template/db';
import type {
  Artifact,
  ArtifactPermission,
  ResourceBinding,
} from '@template/db/generated/client/client';
import { prismaMap } from '@template/db/generated/prismaMap';
import type { Permix } from '@template/permissions/client';
import { check } from '@template/permissions/rebac';
import { pick } from 'lodash-es';
import { contextResource } from '#/lib/context/contextResource';
import { makeController } from '#/lib/utils/makeController';
import {
  artifactEffectiveRole,
  hydrateArtifact,
  isArtifactPublic,
} from '#/modules/artifact/lib/checkArtifactPermission';
import { artifactReadRoute } from '#/modules/artifact/routes/artifactRead';

type BindingAccessor = Extract<AccessorName, 'user' | 'organization' | 'space'>;

const bindingAccessorByModel: Partial<Record<ResourceBinding['resourceModel'], BindingAccessor>> = {
  User: 'user',
  Organization: 'organization',
  Space: 'space',
};

const visibleBindingToCaller = async (
  permix: Permix,
  binding: ResourceBinding,
): Promise<boolean> => {
  const ref = rowPolymorphicAxisPointsAt(
    binding as Record<string, unknown>,
    'ResourceBinding',
    'resourceModel',
  );
  if (!ref) return false;
  const accessor = bindingAccessorByModel[ref.model as ResourceBinding['resourceModel']];
  if (!accessor) return false;
  const record = await db.delegate(accessor).findUnique({ where: { id: ref.id } });
  if (!record) return false;
  const hydrated = await hydrate(accessor, record as HydratedRecord);
  return check(permix, accessor, hydrated, 'read');
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

const accessForNeighbor = async (permix: Permix, neighbor: Artifact) => {
  const hydrated = await hydrateArtifact(neighbor);
  return {
    canRead: check(permix, 'artifact', hydrated, 'read'),
    canManage: check(permix, 'artifact', hydrated, 'manage'),
  };
};

export const artifactReadController = makeController(artifactReadRoute, async (c, respond) => {
  const permix = c.get('permix');
  const {
    placements: rawPlacements,
    contents: rawContents,
    permissions: rawPermissions,
    bindings: rawBindings,
    ...scalarArtifact
  } = contextResource<'artifact'>(c);

  const [hydrated, parentAccess, childAccess, bindingFlags] = await Promise.all([
    hydrateArtifact(scalarArtifact),
    Promise.all(
      rawPlacements.map(({ containerArtifact }) => accessForNeighbor(permix, containerArtifact)),
    ),
    Promise.all(rawContents.map(({ artifact }) => accessForNeighbor(permix, artifact))),
    Promise.all(rawBindings.map((binding) => visibleBindingToCaller(permix, binding))),
  ]);

  const canManage = check(permix, 'artifact', hydrated, 'manage');

  const placements = rawPlacements
    .filter((_, index) => parentAccess[index]!.canRead)
    .map(({ containerArtifact: _container, ...placement }) => placement);

  const parents = rawPlacements
    .filter((_, index) => parentAccess[index]!.canRead)
    .map(({ containerArtifact }, index) => ({
      ...containerArtifact,
      permissions: parentAccess[index]!.canManage ? containerArtifact.permissions : [],
    }))
    .sort((a, b) => a.name.localeCompare(b.name));

  const children = rawContents
    .filter((_, index) => childAccess[index]!.canRead)
    .map(({ artifact }, index) => {
      const {
        placements: childPlacements,
        permissions: childPermissions,
        ...childScalar
      } = artifact;
      return {
        ...childScalar,
        permissions: childAccess[index]!.canManage ? childPermissions : [],
        exclusive: childPlacements.length === 1,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));

  const effectivePermissions = canManage
    ? activeEffectivePermissions((hydrated.effectivePermissions ?? []) as EffectivePermItem[])
    : [];

  return respond.ok({
    ...scalarArtifact,
    effectiveAccess: {
      role: artifactEffectiveRole(permix, hydrated),
      public: isArtifactPublic(hydrated),
    },
    parents,
    children,
    placements,
    permissions: canManage ? rawPermissions : [],
    effectivePermissions,
    bindings: rawBindings.filter((_, index) => bindingFlags[index]),
  });
});
