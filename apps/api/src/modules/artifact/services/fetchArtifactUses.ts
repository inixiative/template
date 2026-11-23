/**
 * @atlas
 * @kind service
 * @partOf feature:files
 * @uses infrastructure:prisma, primitive:authz, primitive:batch
 */
import { db } from '@template/db';
import type {
  Artifact,
  ArtifactPermission,
  ArtifactPlacement,
  ResourceBinding,
} from '@template/db/generated/client/client';
import type { Role } from '@template/db/generated/client/enums';
import { check, rebacSchema } from '@template/permissions/rebac';
import { roleHierarchy } from '@template/permissions/roles/shared';
import type { Context } from 'hono';
import { actingUser } from '#/lib/context/actingUser';
import { artifactOwner } from '#/modules/artifact/lib/artifactOwner';
import {
  type ArtifactPrincipal,
  granteePrincipal,
  ownerPrincipal,
  principalKey,
} from '#/modules/artifact/lib/artifactPrincipal';
import { hydrateArtifact, isArtifactPublic } from '#/modules/artifact/lib/checkArtifactPermission';
import { listableArtifacts } from '#/modules/artifact/services/listableArtifacts';
import { fetchAsCaller } from '#/modules/batch/services/fetchAsCaller';
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

const strongerRole = (a: Role | undefined, b: Role): Role => {
  if (!a) return b;
  return roleHierarchy.indexOf(a) >= roleHierarchy.indexOf(b) ? a : b;
};

type EffectivePermItem = { permission?: ArtifactPermission | null };

const activeGrantsOf = (artifact: Artifact, items: EffectivePermItem[]) => {
  const now = new Date();
  const byPrincipal = new Map<string, { principal: ArtifactPrincipal; role: Role }>();
  const record = (principal: ArtifactPrincipal, role: Role) => {
    const key = principalKey(principal);
    const held = byPrincipal.get(key);
    byPrincipal.set(key, { principal, role: strongerRole(held?.role, role) });
  };
  record(ownerPrincipal(artifact), 'owner');
  for (const { permission } of items) {
    if (!permission || permission.deletedAt) continue;
    if (permission.expiresAt && permission.expiresAt <= now) continue;
    record(granteePrincipal(permission), permission.role);
  }
  return [...byPrincipal.values()];
};

export const fetchArtifactUses = async (
  c: Context<AppEnv>,
  artifactId: string,
): Promise<ArtifactUses> => {
  const permix = c.get('permix');
  const [artifact, placements, bindings] = await Promise.all([
    db.artifact.findUniqueOrThrow({ where: { id: artifactId } }),
    db.artifactPlacement.findMany({ where: { artifactId } }),
    db.resourceBinding.findMany({ where: { sourceArtifactId: artifactId } }),
  ]);
  const hydrated = await hydrateArtifact(artifact);
  const canManage = check(permix, rebacSchema, 'artifact', hydrated, 'manage');
  const containerIds = [...new Set(placements.map((placement) => placement.containerArtifactId))];
  const containers =
    containerIds.length > 0
      ? await db.artifact.findMany({ where: { id: { in: containerIds } } })
      : [];
  const visibleContainerIds = new Set(
    (await listableArtifacts(permix, containers)).map((container) => container.id),
  );
  const shownBindings: ResourceBinding[] = [];
  for (const binding of bindings) {
    if (await visibleToCaller(c, binding)) shownBindings.push(binding);
  }
  const effectivePermissions = (hydrated.effectivePermissions ?? []) as EffectivePermItem[];
  return {
    owner: artifactOwner(artifact),
    access: {
      public: isArtifactPublic(hydrated),
      grants: canManage ? activeGrantsOf(artifact, effectivePermissions) : [],
    },
    placements: placements.filter((placement) =>
      visibleContainerIds.has(placement.containerArtifactId),
    ),
    bindings: shownBindings,
  };
};
