/**
 * @atlas
 * @kind service
 * @partOf primitive:authz
 * @uses infrastructure:prisma, feature:integrations
 */
import { fetchOne, type OrganizationId, type SpaceId, type UserId } from '@template/db';
import type {
  Integration,
  OrganizationUser,
  SpaceUser,
} from '@template/db/generated/client/client';
import {
  createPermissions,
  type Entitlements,
  getOrgPermissions,
  getSpacePermissions,
  getUserPermissions,
  narrowing,
  type PermissionEntry,
} from '@template/permissions';
import { entitlementEntriesSchema } from '@template/permissions/rebac';
import type { Context } from 'hono';
import { validateRole } from '#/lib/permissions/validateRole';
import { findUserWithRelations } from '#/modules/user/services/find';
import type { AppEnv } from '#/types/appEnv';

type Anchor = { resource: 'db:user' | 'db:organization' | 'db:space'; id: string };

/** The record an integration acts from: its direct owner's own resource. */
export const integrationAnchor = (integration: Integration): Anchor | null => {
  switch (integration.ownerModel) {
    case 'User':
      return integration.userId ? { resource: 'db:user', id: integration.userId } : null;
    case 'Organization':
    case 'OrganizationUser':
      return integration.organizationId
        ? { resource: 'db:organization', id: integration.organizationId }
        : null;
    case 'Space':
    case 'SpaceUser':
      return integration.spaceId ? { resource: 'db:space', id: integration.spaceId } : null;
  }
};

const ownerTable = async (integration: Integration): Promise<PermissionEntry[]> => {
  const { organizationId, spaceId, userId } = integration;
  switch (integration.ownerModel) {
    case 'Organization':
      return organizationId ? [getOrgPermissions('owner', organizationId as OrganizationId)] : [];
    case 'Space':
      return spaceId ? [getSpacePermissions('owner', spaceId as SpaceId)] : [];
    case 'OrganizationUser': {
      const seat =
        organizationId && userId
          ? await fetchOne<OrganizationUser>('organizationUser', { organizationId, userId })
          : null;
      return seat
        ? [
            getOrgPermissions(
              validateRole(seat.role),
              seat.organizationId as OrganizationId,
              seat.entitlements as Entitlements,
            ),
          ]
        : [];
    }
    case 'SpaceUser': {
      const seat =
        organizationId && spaceId && userId
          ? await fetchOne<SpaceUser>('spaceUser', { organizationId, spaceId, userId })
          : null;
      return seat
        ? [
            getSpacePermissions(
              validateRole(seat.role),
              seat.spaceId as SpaceId,
              seat.entitlements as Entitlements,
            ),
          ]
        : [];
    }
    case 'User': {
      const person = userId ? await findUserWithRelations(userId) : null;
      if (!person) return [];
      return [
        getUserPermissions(person.id as UserId),
        ...person.organizationUsers.map((seat) =>
          getOrgPermissions(
            validateRole(seat.role),
            seat.organizationId as OrganizationId,
            seat.entitlements as Entitlements,
          ),
        ),
        ...person.spaceUsers.map((seat) =>
          getSpacePermissions(
            validateRole(seat.role),
            seat.spaceId as SpaceId,
            seat.entitlements as Entitlements,
          ),
        ),
      ];
    }
  }
};

const storedEntitlements = (integration: Integration): PermissionEntry[] =>
  integration.entitlements === null
    ? []
    : (entitlementEntriesSchema.parse(integration.entitlements) as PermissionEntry[]);

export const setupIntegrationPermissions = async (c: Context<AppEnv>) => {
  const token = c.get('token');
  if (token?.ownerModel !== 'Integration' || !token.integration) return;
  const integration = token.integration;
  const anchor = integrationAnchor(integration);
  if (!anchor) return;

  const owner = createPermissions();
  await owner.setup(await ownerTable(integration));

  const entitled = storedEntitlements(integration);
  const held = createPermissions();
  await held.setup(
    [
      ...(integration.role
        ? [narrowing(anchor.resource, anchor.id, validateRole(integration.role), null, null)]
        : []),
      ...entitled,
    ],
    { owner },
  );

  await c
    .get('permix')
    .setup(
      [
        narrowing(
          anchor.resource,
          anchor.id,
          validateRole(token.role),
          token.entitlements as Entitlements,
          null,
        ),
        ...entitled,
      ],
      { owner: held },
    );
};
