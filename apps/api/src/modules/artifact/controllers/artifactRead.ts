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
import { check, rebacSchema } from '@template/permissions/rebac';
import { pick } from 'lodash-es';
import { contextResource } from '#/lib/context/contextResource';
import { makeController } from '#/lib/utils/makeController';
import {
  artifactEffectiveRole,
  hydrateArtifact,
  isArtifactPublic,
} from '#/modules/artifact/lib/checkArtifactPermission';
import { artifactReadRoute } from '#/modules/artifact/routes/artifactRead';
import { listableArtifacts } from '#/modules/artifact/services/listableArtifacts';

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
  return check(permix, rebacSchema, accessor, hydrated, 'read');
};

type HydratedAncestorItem = { ancestorArtifact?: Artifact | null };
type EffectivePermItem = { permission?: ArtifactPermission | null };

const artifactColumns = columnsOf(prismaMap, 'Artifact');
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
  const permix = c.get('permix');
  const artifact = contextResource<'artifact'>(c);
  const hydrated = await hydrateArtifact(artifact);
  const canManage = check(permix, rebacSchema, 'artifact', hydrated, 'manage');

  const candidateAncestors = ((hydrated.ancestors ?? []) as HydratedAncestorItem[])
    .map((item) => item.ancestorArtifact)
    .filter((row): row is Artifact => Boolean(row) && row!.deletedAt === null)
    .map((row) => pick(row, artifactColumns) as Artifact);
  const readableAncestors = await listableArtifacts(permix, candidateAncestors);
  const readableById = new Map(readableAncestors.map((row) => [row.id, row]));

  const [allPlacements, permissions, rawBindings] = await Promise.all([
    readableById.size > 0
      ? db.artifactPlacement.findMany({
          where: {
            artifactId: { in: [artifact.id, ...readableById.keys()] },
            containerArtifactId: { in: [...readableById.keys()] },
          },
          orderBy: { createdAt: 'asc' },
        })
      : Promise.resolve([]),
    canManage
      ? db.artifactPermission.findMany({
          where: { artifactId: artifact.id },
          orderBy: { createdAt: 'asc' },
        })
      : Promise.resolve([]),
    db.resourceBinding.findMany({
      where: { sourceArtifactId: artifact.id },
      orderBy: { createdAt: 'asc' },
    }),
  ]);

  const placements = allPlacements.filter((placement) => placement.artifactId === artifact.id);
  const parents = [...new Set(placements.map((placement) => placement.containerArtifactId))]
    .map((id) => readableById.get(id)!)
    .sort((a, b) => a.name.localeCompare(b.name));

  const parentsByNode = new Map<string, string[]>();
  for (const placement of allPlacements) {
    const list = parentsByNode.get(placement.artifactId) ?? [];
    list.push(placement.containerArtifactId);
    parentsByNode.set(placement.artifactId, list);
  }
  const reached = new Set<string>();
  const edges: { artifactId: string; containerArtifactId: string }[] = [];
  const visit = (nodeId: string) => {
    for (const containerArtifactId of parentsByNode.get(nodeId) ?? []) {
      edges.push({ artifactId: nodeId, containerArtifactId });
      if (reached.has(containerArtifactId)) continue;
      reached.add(containerArtifactId);
      visit(containerArtifactId);
    }
  };
  visit(artifact.id);
  const ancestors = { artifacts: [...reached].map((id) => readableById.get(id)!), edges };

  const effectivePermissions = canManage
    ? activeEffectivePermissions((hydrated.effectivePermissions ?? []) as EffectivePermItem[])
    : [];

  const bindingFlags = await Promise.all(
    rawBindings.map((binding) => visibleBindingToCaller(permix, binding)),
  );
  const bindings = rawBindings.filter((_, index) => bindingFlags[index]);

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
