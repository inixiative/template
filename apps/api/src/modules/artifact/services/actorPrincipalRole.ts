/**
 * @atlas
 * @kind service
 * @partOf feature:files
 * @uses primitive:authz, infrastructure:prisma
 */
import {
  type AccessorName,
  db,
  type HydratedRecord,
  hydrate,
  polymorphicTarget,
} from '@template/db';
import type { Role } from '@template/db/generated/client/enums';
import {
  rebacCheck,
  rebacSchema,
  roleHierarchy,
  roleToStandardAction,
} from '@template/permissions';
import type { ArtifactActor } from '#/modules/artifact/lib/artifactActor';
import type { ArtifactPrincipal } from '#/modules/artifact/lib/artifactPrincipal';

const MANAGER_ROLES: readonly Role[] = ['owner', 'admin'];

const effectiveRole = (actor: ArtifactActor, model: AccessorName, record: HydratedRecord) => {
  for (const role of [...roleHierarchy].reverse()) {
    if (rebacCheck(actor.permix, rebacSchema, model, record, roleToStandardAction(role)))
      return role;
  }
  return null;
};

const loadSpace = async (spaceId: string): Promise<HydratedRecord | null> => {
  const space = await db.space.findUnique({ where: { id: spaceId } });
  return space ? hydrate('space', space) : null;
};

const membershipCap = (actor: ArtifactActor): Role => actor.token?.role ?? 'owner';

export const actorPrincipalRole = (actor: ArtifactActor) => {
  const memo = new Map<string, Promise<Role | null>>();

  const roleOn = (kind: 'organization' | 'space', id: string): Promise<Role | null> => {
    const key = `${kind}:${id}`;
    if (!memo.has(key)) {
      memo.set(
        key,
        kind === 'organization'
          ? Promise.resolve(effectiveRole(actor, 'organization', { id }))
          : loadSpace(id).then((space) => (space ? effectiveRole(actor, 'space', space) : null)),
      );
    }
    return memo.get(key)!;
  };

  const isSelf = (userId: string) => !!actor.user && actor.user.id === userId;

  const resolve = async ({ kind, ids }: ArtifactPrincipal): Promise<Role | null> => {
    if (actor.permix.isSuperadmin()) return 'owner';
    const [first, second, third] = ids as [string, string?, string?];
    switch (kind) {
      case 'User':
        if (!isSelf(first) || (actor.token && actor.token.ownerModel !== 'User')) return null;
        return effectiveRole(actor, 'user', { id: first });
      case 'Organization':
        return roleOn('organization', first);
      case 'Space':
        return roleOn('space', first);
      case 'OrganizationManager': {
        const role = await roleOn('organization', first);
        return role && MANAGER_ROLES.includes(role) ? role : null;
      }
      case 'OrganizationOwner':
        return (await roleOn('organization', first)) === 'owner' ? 'owner' : null;
      case 'SpaceManager': {
        const role = await roleOn('space', first);
        return role && MANAGER_ROLES.includes(role) ? role : null;
      }
      case 'OrganizationUser':
        return isSelf(second!) && (await roleOn('organization', first))
          ? membershipCap(actor)
          : null;
      case 'SpaceUser':
        return isSelf(third!) && (await roleOn('space', second!)) ? membershipCap(actor) : null;
      case 'CustomerRef': {
        const customerRef = await db.customerRef.findUnique({ where: { id: first } });
        const customer =
          customerRef && polymorphicTarget(customerRef, 'CustomerRef', 'customerModel');
        if (!customer) return null;
        return resolve({ kind: customer.kind as ArtifactPrincipal['kind'], ids: [customer.id] });
      }
      case 'Integration':
        return null;
    }
  };

  return resolve;
};
