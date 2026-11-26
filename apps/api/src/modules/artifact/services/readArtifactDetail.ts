/**
 * @atlas
 * @kind service
 * @partOf feature:files
 * @uses infrastructure:prisma, primitive:authz
 */
import {
  db,
  type HydratedRecord,
  hydrate,
  isBindableOwnerModel,
  rowPolymorphicAxisPointsAt,
  toAccessor,
} from '@template/db';
import type {
  Artifact,
  ArtifactPlacement,
  ResourceBinding,
} from '@template/db/generated/client/client';
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
import { holdsOnRecord } from '#/lib/permissions/holdsOnRecord';
import { includeArtifactDetail } from '#/modules/artifact/queries/artifactIncludes';
import { sameArtifactOwner } from '#/modules/artifact/services/artifactOwner';
import type { AppEnv } from '#/types/appEnv';

const PLACEMENT_READ_ACTIONS = ['read', 'manage'] as const;

const visibleBindingToCaller = async (
  permix: Permix,
  binding: ResourceBinding,
): Promise<boolean> => {
  const ref = rowPolymorphicAxisPointsAt(
    binding as Record<string, unknown>,
    'ResourceBinding',
    'resourceModel',
  );
  if (!ref || !isBindableOwnerModel(ref.model)) return false;
  const accessor = toAccessor(ref.model);
  const record = await db.delegate(accessor).findUnique({ where: { id: ref.id } });
  return record ? holdsOnRecord(permix, accessor, record as HydratedRecord, 'read') : false;
};

const hasCustomArtifactRules = (permix: Permix, hydrated: HydratedRecord): boolean =>
  tenantPermissionRulesAbove('db:Artifact', hydrated).some(
    (rules) => Boolean(rules) && Object.keys(rules!).length > 0,
  ) ||
  entitlementsCovering(permix, 'db:Artifact', STANDARD_ACTIONS_IMPLYING.read).length > 0 ||
  entitlementsCovering(permix, 'db:ArtifactPlacement', PLACEMENT_READ_ACTIONS).length > 0;

const accessForPlacement = async (
  permix: Permix,
  placement: ArtifactPlacement,
  targetRel: 'artifact' | 'containerArtifact',
): Promise<{ canRead: boolean; canManage: boolean }> => {
  const hydratedPlacement = await hydrate('artifactPlacement', placement);
  if (!check(permix, 'artifactPlacement', hydratedPlacement, 'read')) {
    return { canRead: false, canManage: false };
  }
  const hydratedTarget = hydratedPlacement[targetRel] as HydratedRecord | undefined;
  return {
    canRead: true,
    canManage: hydratedTarget ? check(permix, 'artifact', hydratedTarget, 'manage') : false,
  };
};

export const readArtifactDetail = async (c: Context<AppEnv>, artifact: Artifact) => {
  const permix = c.get('permix');
  const isAnonymous = !c.get('user') && !c.get('token');
  const [loaded, hydrated] = await Promise.all([
    db.artifact.findUniqueOrThrow({ where: { id: artifact.id }, include: includeArtifactDetail }),
    hydrate('artifact', artifact),
  ]);
  const {
    artifactPlacementsAsArtifact: rawPlacements,
    artifactPlacementsAsContainer: rawContents,
    artifactPermissions: rawPermissions,
    artifactEffectivePermissions: rawEffectivePermissions,
    resourceBindings: rawBindings,
    ...scalarArtifact
  } = loaded;

  const canManage = check(permix, 'artifact', hydrated, 'manage');
  const parentRole = artifactEffectiveRole(permix, hydrated);
  const parentIsRoot = isRootKind(scalarArtifact.kind);
  const canShortCircuit = !hasCustomArtifactRules(permix, hydrated);

  // why: non-private/non-tenant same-owner children inherit container permissions monotonically,
  // avoiding N individual hydrations when the container already decides visibility & access.
  const accessForChildPlacement = async (content: (typeof rawContents)[number]) => {
    const { artifact: child, ...placement } = content;
    if (canShortCircuit && sameArtifactOwner(child, scalarArtifact)) {
      if (isAnonymous) {
        const visible = parentIsRoot
          ? placement.access === 'public'
          : placement.access === 'inherit' || placement.access === 'public';
        return { canRead: visible && child.effectiveAccess === 'public', canManage: false };
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
    return accessForPlacement(permix, placement, 'artifact');
  };

  const [parentAccess, childAccess, bindingFlags] = await Promise.all([
    Promise.all(
      rawPlacements.map(({ containerArtifact: _container, ...placement }) =>
        accessForPlacement(permix, placement, 'containerArtifact'),
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
            artifactPermissions: access.canManage ? artifactPermissions : [],
          },
        },
      ];
    })
    .sort((a, b) => a.containerArtifact.name.localeCompare(b.containerArtifact.name));

  const artifactPlacementsAsContainer = rawContents
    .flatMap(({ artifact: child, ...placement }, index) => {
      const access = childAccess[index]!;
      if (!access.canRead) return [];
      const {
        artifactPlacementsAsArtifact: childPlacements,
        artifactPermissions: childPermissions,
        ...childScalar
      } = child;
      const sameOwnerPlacementCount = childPlacements.filter((p) =>
        sameArtifactOwner(p.containerArtifact, child),
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

  const now = new Date();
  return {
    ...scalarArtifact,
    effectiveRole: parentRole,
    artifactPlacementsAsArtifact,
    artifactPlacementsAsContainer,
    artifactPermissions: canManage ? rawPermissions : [],
    artifactEffectivePermissions: canManage
      ? rawEffectivePermissions.filter(
          ({ artifactPermission }) =>
            !artifactPermission.expiresAt || artifactPermission.expiresAt > now,
        )
      : [],
    resourceBindings: rawBindings.filter((_, index) => bindingFlags[index]),
  };
};
