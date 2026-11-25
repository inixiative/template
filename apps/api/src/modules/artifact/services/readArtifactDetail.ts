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
  ArtifactEffectivePermission,
  ArtifactPermission,
  ArtifactPlacement,
  ResourceBinding,
} from '@template/db/generated/client/client';
import { prismaMap } from '@template/db/generated/prismaMap';
import {
  artifactEffectiveRole,
  entitlementsCovering,
  STANDARD_ACTIONS_IMPLYING,
} from '@template/permissions';
import type { Permix } from '@template/permissions/client';
import { check } from '@template/permissions/rebac';
import { tenantPermissionRulesAbove } from '@template/permissions/rebac/tenantPermissionRules';
import { isRootKind } from '@template/shared/artifact';
import type { Context } from 'hono';
import { pick } from 'lodash-es';
import { holdsOnRecord } from '#/lib/permissions/holdsOnRecord';
import type { ResourcePayloadMap } from '#/middleware/resources/resourceContextArgs';
import { sameArtifactOwner } from '#/modules/artifact/services/artifactOwner';
import type { AppEnv } from '#/types/appEnv';

type BindingAccessor = Extract<AccessorName, 'user' | 'organization' | 'space'>;

const bindingAccessorByModel: Partial<Record<ResourceBinding['resourceModel'], BindingAccessor>> = {
  User: 'user',
  Organization: 'organization',
  Space: 'space',
};

const PLACEMENT_READ_ACTIONS = ['read', 'manage'] as const;
const artifactPermissionColumns = columnsOf(prismaMap, 'ArtifactPermission');
const artifactEffectivePermissionColumns = columnsOf(prismaMap, 'ArtifactEffectivePermission');

type EffectivePermissionItem = ArtifactEffectivePermission & {
  artifactPermission?: ArtifactPermission | null;
};

type EffectivePermissionWithGrant = ArtifactEffectivePermission & {
  artifactPermission: ArtifactPermission;
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
  return holdsOnRecord(permix, accessor, record as HydratedRecord, 'read');
};

const activeEffectivePermissions = (
  items: EffectivePermissionItem[],
): EffectivePermissionWithGrant[] => {
  const now = new Date();
  const seen = new Set<string>();
  const active: EffectivePermissionWithGrant[] = [];
  for (const item of items) {
    const { artifactPermission } = item;
    if (!artifactPermission || artifactPermission.deletedAt || seen.has(artifactPermission.id)) {
      continue;
    }
    if (artifactPermission.expiresAt && artifactPermission.expiresAt <= now) continue;
    seen.add(artifactPermission.id);
    active.push({
      ...(pick(item, artifactEffectivePermissionColumns) as ArtifactEffectivePermission),
      artifactPermission: pick(artifactPermission, artifactPermissionColumns) as ArtifactPermission,
    });
  }
  return active;
};

const hasCustomArtifactRules = (permix: Permix, hydrated: HydratedRecord): boolean =>
  [
    ...tenantPermissionRulesAbove('db:Artifact', hydrated),
    ...tenantPermissionRulesAbove('db:ArtifactPlacement', hydrated),
  ].some((rules) => Boolean(rules) && Object.keys(rules!).length > 0) ||
  entitlementsCovering(permix, 'db:Artifact', STANDARD_ACTIONS_IMPLYING.read).length > 0 ||
  entitlementsCovering(permix, 'db:ArtifactPlacement', PLACEMENT_READ_ACTIONS).length > 0;

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
    hydrate('artifact', targetArtifact),
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
    artifactPlacementsAsArtifact: rawPlacements,
    artifactPlacementsAsContainer: rawContents,
    artifactPermissions: rawPermissions,
    resourceBindings: rawBindings,
    ...scalarArtifact
  } = loaded;

  const hydrated = await hydrate('artifact', scalarArtifact);
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
          child.artifactPermissions.length === 0 &&
          child.artifactPlacementsAsArtifact.length === 1
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

  const artifactPlacementsAsArtifact = rawPlacements
    .flatMap(({ containerArtifact, ...placement }, index) => {
      const access = parentAccess[index]!;
      if (!access.canRead) return [];
      const { artifactPermissions, ...containerScalar } = containerArtifact;
      return [
        {
          ...placement,
          containerArtifact: {
            ...containerScalar,
            artifactPermissions: access.canManageTarget ? artifactPermissions : [],
          },
        },
      ];
    })
    .sort((a, b) => a.containerArtifact.name.localeCompare(b.containerArtifact.name));

  const artifactPlacementsAsContainer = rawContents
    .flatMap(({ artifact, ...placement }, index) => {
      const access = childAccess[index]!;
      if (!access.canRead) return [];
      const {
        artifactPlacementsAsArtifact: childPlacements,
        artifactPermissions: childPermissions,
        ...childScalar
      } = artifact;
      const sameOwnerPlacementCount = childPlacements.filter((p) =>
        sameArtifactOwner(p.containerArtifact, artifact),
      ).length;
      return [
        {
          ...placement,
          artifact: {
            ...childScalar,
            artifactPermissions: access.canManage ? childPermissions : [],
            exclusive: access.canManage && sameOwnerPlacementCount === 1,
          },
        },
      ];
    })
    .sort((a, b) => a.artifact.name.localeCompare(b.artifact.name));

  const artifactEffectivePermissions = canManage
    ? activeEffectivePermissions(
        (hydrated.artifactEffectivePermissions ?? []) as EffectivePermissionItem[],
      )
    : [];

  return {
    ...scalarArtifact,
    effectiveRole: parentRole,
    artifactPlacementsAsArtifact,
    artifactPlacementsAsContainer,
    artifactPermissions: canManage ? rawPermissions : [],
    artifactEffectivePermissions,
    resourceBindings: rawBindings.filter((_, index) => bindingFlags[index]),
  };
};
