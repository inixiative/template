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
import { tenantPermissionRulesAbove } from '@template/permissions/rebac/tenantPermissionRules';
import { pick } from 'lodash-es';
import { contextResource } from '#/lib/context/contextResource';
import { makeController } from '#/lib/utils/makeController';
import { sameArtifactOwner } from '#/modules/artifact/lib/artifactOwner';
import {
  artifactEffectiveRole,
  effectiveArtifactAccess,
  hydrateArtifact,
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
  if (neighbor.deletedAt !== null) return { canRead: false, canManage: false };
  const hydrated = await hydrateArtifact(neighbor);
  return {
    canRead: check(permix, 'artifact', hydrated, 'read'),
    canManage: check(permix, 'artifact', hydrated, 'manage'),
  };
};

const ARTIFACT_READ_IMPLYING_ACTIONS = ['read', 'operate', 'manage', 'own'] as const;

const hasCustomArtifactRules = (permix: Permix, hydrated: HydratedRecord): boolean =>
  tenantPermissionRulesAbove('db:Artifact', hydrated).some(
    (rules) => Boolean(rules) && Object.keys(rules!).length > 0,
  ) ||
  ARTIFACT_READ_IMPLYING_ACTIONS.some(
    (action) => permix.entitlements('db:Artifact', action).length > 0,
  );

export const artifactReadController = makeController(artifactReadRoute, async (c, respond) => {
  const permix = c.get('permix');
  const isAnonymous = !c.get('user') && !c.get('token');
  const {
    placements: rawPlacements,
    contents: rawContents,
    permissions: rawPermissions,
    bindings: rawBindings,
    ...scalarArtifact
  } = contextResource<'artifact'>(c);

  const containerPlacements = rawPlacements.filter(
    (
      placement,
    ): placement is (typeof rawPlacements)[number] & {
      containerArtifact: NonNullable<(typeof rawPlacements)[number]['containerArtifact']>;
    } => placement.containerArtifact !== null,
  );

  const hydrated = await hydrateArtifact(scalarArtifact);
  const canManage = check(permix, 'artifact', hydrated, 'manage');
  const parentRole = artifactEffectiveRole(permix, hydrated);
  const parentEffectiveAccess = effectiveArtifactAccess(hydrated);
  const canShortCircuit = !hasCustomArtifactRules(permix, hydrated);

  // why: same-owner non-private children inherit this container's permissions monotonically,
  // avoiding N individual hydrateArtifact calls when the parent already decides the child.
  const accessForChild = async (child: (typeof rawContents)[number]['artifact']) => {
    if (child.deletedAt !== null) return { canRead: false, canManage: false };
    if (canShortCircuit && sameArtifactOwner(child, scalarArtifact)) {
      if (isAnonymous) {
        if (child.access === 'public') return { canRead: true, canManage: false };
        if (child.access === 'inherit' && parentEffectiveAccess === 'public') {
          return { canRead: true, canManage: false };
        }
        if (child.access !== 'inherit' || child.placements.length === 1) {
          return { canRead: false, canManage: false };
        }
      } else if (child.access !== 'private') {
        if (canManage) return { canRead: true, canManage: true };
        if (
          parentRole !== null &&
          child.permissions.length === 0 &&
          child.placements.length === 1
        ) {
          return { canRead: true, canManage: false };
        }
      }
    }
    return accessForNeighbor(permix, child);
  };

  const [parentAccess, childAccess, bindingFlags] = await Promise.all([
    Promise.all(
      containerPlacements.map(({ containerArtifact }) =>
        accessForNeighbor(permix, containerArtifact),
      ),
    ),
    Promise.all(rawContents.map(({ artifact }) => accessForChild(artifact))),
    Promise.all(rawBindings.map((binding) => visibleBindingToCaller(permix, binding))),
  ]);

  const placements = containerPlacements.flatMap(
    ({ containerArtifact: _container, ...placement }, index) =>
      parentAccess[index]!.canRead ? [placement] : [],
  );

  const parents = containerPlacements
    .flatMap(({ containerArtifact }, index) => {
      const access = parentAccess[index]!;
      if (!access.canRead) return [];
      return [
        {
          ...containerArtifact,
          permissions: access.canManage ? containerArtifact.permissions : [],
        },
      ];
    })
    .sort((a, b) => a.name.localeCompare(b.name));

  const children = rawContents
    .flatMap(({ artifact }, index) => {
      const access = childAccess[index]!;
      if (!access.canRead) return [];
      const {
        placements: childPlacements,
        permissions: childPermissions,
        ...childScalar
      } = artifact;
      return [
        {
          ...childScalar,
          permissions: access.canManage ? childPermissions : [],
          exclusive: childPlacements.length === 1,
        },
      ];
    })
    .sort((a, b) => a.name.localeCompare(b.name));

  const effectivePermissions = canManage
    ? activeEffectivePermissions((hydrated.effectivePermissions ?? []) as EffectivePermItem[])
    : [];

  return respond.ok({
    ...scalarArtifact,
    effectiveAccess: {
      role: parentRole,
      access: parentEffectiveAccess,
    },
    parents,
    children,
    placements,
    permissions: canManage ? rawPermissions : [],
    effectivePermissions,
    bindings: rawBindings.filter((_, index) => bindingFlags[index]),
  });
});
