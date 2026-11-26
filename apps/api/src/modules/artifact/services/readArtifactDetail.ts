/**
 * @atlas
 * @kind service
 * @partOf feature:files
 * @uses infrastructure:prisma, primitive:authz
 */
import {
  type AccessorName,
  db,
  type HydratedRecord,
  hydrate,
  hydrateMany,
  isBindableOwnerModel,
  rowPolymorphicAxisPointsAt,
  toAccessor,
} from '@template/db';
import type { Artifact, ResourceBinding } from '@template/db/generated/client/client';
import { artifactEffectiveRole } from '@template/permissions';
import type { Permix } from '@template/permissions/client';
import { check } from '@template/permissions/rebac';
import type { Context } from 'hono';
import { includeArtifactDetail } from '#/modules/artifact/queries/artifactIncludes';
import { sameArtifactOwner } from '#/modules/artifact/services/artifactOwner';
import type { AppEnv } from '#/types/appEnv';

const filterVisibleBindings = async (
  permix: Permix,
  bindings: ResourceBinding[],
): Promise<ResourceBinding[]> => {
  if (bindings.length === 0) return [];
  const refsByAccessor = new Map<AccessorName, Set<string>>();
  const refByIndex: ({ accessor: AccessorName; id: string } | null)[] = bindings.map((binding) => {
    const ref = rowPolymorphicAxisPointsAt(
      binding as Record<string, unknown>,
      'ResourceBinding',
      'resourceModel',
    );
    if (!ref || !isBindableOwnerModel(ref.model)) return null;
    const accessor = toAccessor(ref.model);
    let ids = refsByAccessor.get(accessor);
    if (!ids) {
      ids = new Set();
      refsByAccessor.set(accessor, ids);
    }
    ids.add(ref.id);
    return { accessor, id: ref.id };
  });

  const readableKeys = new Set<string>();
  await Promise.all(
    [...refsByAccessor.entries()].map(async ([accessor, idSet]) => {
      const records = (await db.delegate(accessor).findMany({
        where: { id: { in: [...idSet] } },
      })) as HydratedRecord[];
      if (records.length === 0) return;
      const hydratedRecords = await hydrateMany(accessor, records);
      for (const hydrated of hydratedRecords) {
        if (check(permix, accessor, hydrated, 'read')) {
          readableKeys.add(`${accessor}:${hydrated.id}`);
        }
      }
    }),
  );

  return bindings.filter((_, index) => {
    const ref = refByIndex[index];
    return ref !== null && readableKeys.has(`${ref.accessor}:${ref.id}`);
  });
};

const callerPlacementPermissions = (
  permix: Permix,
  hydratedPlacement: HydratedRecord,
  targetRel: 'artifact' | 'containerArtifact',
): { canRead: boolean; canManage: boolean } => {
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

  const placementRows = [
    ...rawPlacements.map(({ containerArtifact: _container, ...placement }) => placement),
    ...rawContents.map(({ artifact: _child, ...placement }) => placement),
  ];

  const [hydratedPlacements, visibleBindings] = await Promise.all([
    hydrateMany('artifactPlacement', placementRows),
    filterVisibleBindings(permix, rawBindings),
  ]);

  const artifactPlacementsAsArtifact = rawPlacements
    .flatMap(({ containerArtifact, ...placement }, index) => {
      const permissions = callerPlacementPermissions(
        permix,
        hydratedPlacements[index]!,
        'containerArtifact',
      );
      if (!permissions.canRead) return [];
      const { artifactPermissions, ...containerScalar } = containerArtifact;
      return [
        {
          ...placement,
          containerArtifact: {
            ...containerScalar,
            artifactPermissions: permissions.canManage ? artifactPermissions : [],
          },
        },
      ];
    })
    .sort((a, b) => a.containerArtifact.name.localeCompare(b.containerArtifact.name));

  const contentOffset = rawPlacements.length;
  const artifactPlacementsAsContainer = rawContents
    .flatMap(({ artifact: child, ...placement }, index) => {
      const permissions = callerPlacementPermissions(
        permix,
        hydratedPlacements[contentOffset + index]!,
        'artifact',
      );
      if (!permissions.canRead) return [];
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
            artifactPermissions: permissions.canManage ? childPermissions : [],
            exclusive:
              permissions.canManage &&
              sameArtifactOwner(child, artifact) &&
              sameOwnerPlacementCount === 1,
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
    resourceBindings: visibleBindings,
  };
};
