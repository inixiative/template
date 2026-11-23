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
  rowPolymorphicAxisPointsAt,
} from '@template/db';
import type { Role } from '@template/db/generated/client/enums';
import { rebacCheck, rebacSchema, roleToStandardAction } from '@template/permissions';
import { privilegedRoles } from '@template/permissions/rebac/rebacSchemaRules';
import { roleHierarchy } from '@template/permissions/roles/shared';
import type { ArtifactActor } from '#/modules/artifact/lib/artifactActor';
import type { ArtifactPrincipal } from '#/modules/artifact/lib/artifactPrincipal';
import { cappedRole } from '#/modules/artifact/lib/artifactRoles';

const effectiveRole = (actor: ArtifactActor, model: AccessorName, record: HydratedRecord) => {
  for (const role of [...roleHierarchy].reverse()) {
    if (rebacCheck(actor.permix, rebacSchema, model, record, roleToStandardAction(role)))
      return role;
  }
  return null;
};

const fetchSpace = async (spaceId: string): Promise<HydratedRecord | null> => {
  const space = await db.space.findUnique({ where: { id: spaceId } });
  return space ? hydrate('space', space) : null;
};

const delegateCap = (delegate: { full: boolean; role: Role | null }): Role | null =>
  delegate.full ? 'owner' : delegate.role;

const membershipCap = (actor: ArtifactActor): Role | null => {
  if (!actor.token) return 'owner';
  if (actor.token.ownerModel === 'Integration') {
    return cappedRole(
      delegateCap(actor.token),
      actor.token.integration ? delegateCap(actor.token.integration) : null,
    );
  }
  return delegateCap(actor.token);
};

export const actorPrincipalRole = (actor: ArtifactActor) => {
  const memo = new Map<string, Promise<Role | null>>();

  const roleOn = (kind: 'organization' | 'space', id: string): Promise<Role | null> => {
    const key = `${kind}:${id}`;
    if (!memo.has(key)) {
      memo.set(
        key,
        kind === 'organization'
          ? Promise.resolve(effectiveRole(actor, 'organization', { id }))
          : fetchSpace(id).then((space) => (space ? effectiveRole(actor, 'space', space) : null)),
      );
    }
    return memo.get(key)!;
  };

  const isSelfUser = (userId: string) => !!actor.user && actor.user.id === userId;
  const isSelfMember = (userId: string) => isSelfUser(userId) || actor.token?.userId === userId;

  const resolve = async ({ kind, ids }: ArtifactPrincipal): Promise<Role | null> => {
    if (actor.permix.isSuperadmin()) return 'owner';
    const [first, second, third] = ids as [string, string?, string?];
    switch (kind) {
      case 'User':
        if (!isSelfUser(first) || (actor.token && actor.token.ownerModel !== 'User')) return null;
        return effectiveRole(actor, 'user', { id: first });
      case 'Organization':
        return roleOn('organization', first);
      case 'Space':
        return roleOn('space', first);
      case 'OrganizationManager': {
        const role = await roleOn('organization', first);
        return role && privilegedRoles.includes(role) ? role : null;
      }
      case 'OrganizationOwner':
        if (actor.token && actor.token.ownerModel !== 'User') return null;
        return (await roleOn('organization', first)) === 'owner' ? 'owner' : null;
      case 'SpaceManager': {
        const role = await roleOn('space', first);
        return role && privilegedRoles.includes(role) ? role : null;
      }
      case 'OrganizationUser':
        if (!isSelfMember(second!) || !(await roleOn('organization', first))) return null;
        return membershipCap(actor);
      case 'SpaceUser':
        if (!isSelfMember(third!) || !(await roleOn('space', second!))) return null;
        return membershipCap(actor);
      case 'CustomerRelationship': {
        const customerRelationship = await db.customerRelationship.findUnique({
          where: { id: first },
        });
        const customer =
          customerRelationship &&
          rowPolymorphicAxisPointsAt(customerRelationship, 'CustomerRelationship', 'customerModel');
        if (!customer) return null;
        return resolve({ kind: customer.model as ArtifactPrincipal['kind'], ids: [customer.id] });
      }
      case 'Integration':
        return null;
    }
  };

  return resolve;
};
