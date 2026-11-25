/**
 * @atlas
 * @kind service
 * @partOf feature:files
 * @uses infrastructure:prisma, primitive:authz
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
  ArtifactPlacement,
  ResourceBinding,
} from '@template/db/generated/client/client';
import { prismaMap } from '@template/db/generated/prismaMap';
import type { Permix } from '@template/permissions/client';
import { check } from '@template/permissions/rebac';
import { tenantPermissionRulesAbove } from '@template/permissions/rebac/tenantPermissionRules';
import { isRootKind } from '@template/shared/artifact';
import type { Context } from 'hono';
import { pick } from 'lodash-es';
import type { ResourcePayloadMap } from '#/middleware/resources/resourceContextArgs';
import { sameArtifactOwner } from '#/modules/artifact/services/artifactOwner';
import {
  artifactEffectiveRole,
  hydrateArtifact,
} from '#/modules/artifact/services/checkArtifactPermission';
import type { AppEnv } from '#/types/appEnv';

type BindingAccessor = Extract<AccessorName, 'user' | 'organization' | 'space'>;

const bindingAccessorByModel: Partial<Record<ResourceBinding['resourceModel'], BindingAccessor>> = {
  User: 'user',
  Organization: 'organization',
  Space: 'space',
};

const ARTIFACT_READ_IMPLYING_ACTIONS = ['read', 'operate', 'manage', 'own'] as const;
const PLACEMENT_READ_IMPLYING_ACTIONS = ['read', 'manage'] as const;
const artifactPermissionColumns = columnsOf(prismaMap, 'ArtifactPermission');

type EffectivePermItem = { permission?: ArtifactPermission | null };

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

const hasCustomArtifactRules = (permix: Permix, hydrated: HydratedRecord): boolean =>
  tenantPermissionRulesAbove('db:Artifact', hydrated).some(
    (rules) => Boolean(rules) && Object.keys(rules!).length > 0,
  ) ||
  ARTIFACT_READ_IMPLYING_ACTIONS.some(
    (action) => permix.entitlements('db:Artifact', action).length > 0,
  ) ||
  PLACEMENT_READ_IMPLYING_ACTIONS.some(
    (action) => permix.entitlements('db:ArtifactPlacement', action).length > 0,
  );

const accessForPlacement = async (
  permix: Permix,
  placement: ArtifactPlacement,
  targetArtifact: Artifact,
): Promise<{ canRead: boolean; canManageTarget: boolean }> => {
  if (placement.deletedAt !== null || targetArtifact.deletedAt !== null) {
    return { canRead: false, canManageTarget: false };
  }
  const [hydratedPlacement, hydratedTarget] = await Promise.all([
    hydrate('artifactPlacement', placement),
    hydrateArtifact(targetArtifact),
  ]);
  const canRead = check(permix, 'artifactPlacement', hydratedPlacement, 'read');
  if (!canRead) return { canRead: false, canManageTarget: false };
  return {
    canRead: true,
    canManageTarget: check(permix, 'artifact', hydratedTarget, 'manage'),
  };
};

export const readArtifactDetail = async (
  c: Context<AppEnv>,
  loaded: ResourcePayloadMap['artifact'],
) => {
  const permix = c.get('permix');
  const isAnonymous = !c.get('user') && !c.get('token');
  const {
    placements: rawPlacements,
    contents: rawContents,
    permissions: rawPermissions,
    bindings: rawBindings,
    ...scalarArtifact
  } = loaded;

  const hydrated = await hydrateArtifact(scalarArtifact);
  const canManage = check(permix, 'artifact', hydrated, 'manage');
  const parentRole = artifactEffectiveRole(permix, hydrated);
  const parentIsRoot = isRootKind(scalarArtifact.kind);
  const canShortCircuit = !hasCustomArtifactRules(permix, hydrated);

  // why: non-private/non-tenant same-owner children inherit container permissions monotonically,
  // avoiding N individual hydrations when the container already decides visibility & access.
  const accessForChildPlacement = async (content: (typeof rawContents)[number]) => {
    const { artifact: child, ...placement } = content;
    if (placement.deletedAt !== null || child.deletedAt !== null) {
      return { canRead: false, canManage: false };
    }
    if (canShortCircuit && sameArtifactOwner(child, scalarArtifact)) {
      if (isAnonymous) {
        const placementVisible = parentIsRoot
          ? placement.access === 'public'
          : placement.access === 'inherit' || placement.access === 'public';
        if (!placementVisible) return { canRead: false, canManage: false };
        return { canRead: child.effectiveAccess === 'public', canManage: false };
      }
      if (!parentIsRoot && (placement.access === 'inherit' || placement.access === 'public')) {
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
    const { canRead, canManageTarget } = await accessForPlacement(permix, placement, child);
    return { canRead, canManage: canManageTarget };
  };

  const [parentAccess, childAccess, bindingFlags] = await Promise.all([
    Promise.all(
      rawPlacements.map(({ containerArtifact, ...placement }) =>
        accessForPlacement(permix, placement, containerArtifact),
      ),
    ),
    Promise.all(rawContents.map((content) => accessForChildPlacement(content))),
    Promise.all(rawBindings.map((binding) => visibleBindingToCaller(permix, binding))),
  ]);

  const placements = rawPlacements.flatMap(
    ({ containerArtifact: _container, ...placement }, index) =>
      parentAccess[index]!.canRead ? [placement] : [],
  );

  const parents = rawPlacements
    .flatMap(({ containerArtifact }, index) => {
      const access = parentAccess[index]!;
      if (!access.canRead || isRootKind(containerArtifact.kind)) return [];
      return [
        {
          ...containerArtifact,
          permissions: access.canManageTarget ? containerArtifact.permissions : [],
        },
      ];
    })
    .sort((a, b) => a.name.localeCompare(b.name));

  const children = rawContents
    .flatMap(({ artifact, ...placement }, index) => {
      const access = childAccess[index]!;
      if (!access.canRead) return [];
      const {
        placements: childPlacements,
        permissions: childPermissions,
        ...childScalar
      } = artifact;
      const sameOwnerPlacementCount = childPlacements.filter((p) =>
        sameArtifactOwner(p.containerArtifact, artifact),
      ).length;
      return [
        {
          ...childScalar,
          permissions: access.canManage ? childPermissions : [],
          exclusive: sameOwnerPlacementCount === 1,
          placementId: placement.id,
          placementAccess: placement.access,
        },
      ];
    })
    .sort((a, b) => a.name.localeCompare(b.name));

  const effectivePermissions = canManage
    ? activeEffectivePermissions((hydrated.effectivePermissions ?? []) as EffectivePermItem[])
    : [];

  return {
    ...scalarArtifact,
    effectiveRole: parentRole,
    parents,
    children,
    placements,
    permissions: canManage ? rawPermissions : [],
    effectivePermissions,
    bindings: rawBindings.filter((_, index) => bindingFlags[index]),
  };
};
