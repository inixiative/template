/**
 * @atlas
 * @kind utils
 * @partOf primitive:ui
 * @uses primitive:authz
 */
import type { HydratedRecord } from '@template/db';
import type { SettingResourceModelName } from '@template/shared/settings';
import type { AuthSlice } from '@template/ui/store/types/auth';
import type { TenantContext } from '@template/ui/store/types/tenant';

type PermissionHydrationAuth = Pick<
  AuthSlice['auth'],
  'user' | 'organizations' | 'organizationUsers' | 'spaces' | 'spaceUsers'
>;

type UnknownRecord = Record<string, unknown>;

const asRecord = (value: unknown): UnknownRecord | null =>
  value && typeof value === 'object' ? (value as UnknownRecord) : null;

const stringField = (record: UnknownRecord, field: string): string | null => {
  const value = record[field];
  return typeof value === 'string' && value.length > 0 ? value : null;
};

const hydrateUserRef = (userId: string, auth: PermissionHydrationAuth): UnknownRecord =>
  auth.user?.id === userId ? (auth.user as unknown as UnknownRecord) : { id: userId };

const hydrateOrganizationRef = (
  organizationId: string,
  auth: PermissionHydrationAuth,
  context?: TenantContext,
): UnknownRecord => {
  if (context?.organization?.id === organizationId) {
    return context.organization as unknown as UnknownRecord;
  }
  const fromStore = auth.organizations?.[organizationId];
  return fromStore ? (fromStore as unknown as UnknownRecord) : { id: organizationId };
};

export const hydrateSpaceForPermissions = (
  space: UnknownRecord,
  auth: PermissionHydrationAuth,
  context?: TenantContext,
): HydratedRecord => {
  const existingOrg = asRecord(space.organization);
  if (existingOrg) return space as HydratedRecord;
  const organizationId = stringField(space, 'organizationId');
  if (!organizationId) return space as HydratedRecord;
  return {
    ...space,
    organization: hydrateOrganizationRef(organizationId, auth, context),
  } as unknown as HydratedRecord;
};

const hydrateOrganizationUserForPermissions = (
  organizationUser: UnknownRecord,
  auth: PermissionHydrationAuth,
  context?: TenantContext,
): HydratedRecord => {
  const userId = stringField(organizationUser, 'userId');
  const organizationId = stringField(organizationUser, 'organizationId');
  return {
    ...organizationUser,
    ...(organizationUser.user ? {} : userId ? { user: hydrateUserRef(userId, auth) } : {}),
    ...(organizationUser.organization
      ? {}
      : organizationId
        ? { organization: hydrateOrganizationRef(organizationId, auth, context) }
        : {}),
  } as HydratedRecord;
};

const hydrateSpaceUserForPermissions = (
  spaceUser: UnknownRecord,
  auth: PermissionHydrationAuth,
  context?: TenantContext,
): HydratedRecord => {
  const userId = stringField(spaceUser, 'userId');
  const organizationId = stringField(spaceUser, 'organizationId');
  const spaceId = stringField(spaceUser, 'spaceId');
  const existingSpace = asRecord(spaceUser.space);
  const rawSpace =
    existingSpace ??
    (spaceId
      ? (((context?.space?.id === spaceId ? context.space : auth.spaces?.[spaceId]) as unknown as
          | UnknownRecord
          | undefined) ?? {
          id: spaceId,
          ...(organizationId ? { organizationId } : {}),
        })
      : null);

  return {
    ...spaceUser,
    ...(spaceUser.user ? {} : userId ? { user: hydrateUserRef(userId, auth) } : {}),
    ...(spaceUser.organization
      ? {}
      : organizationId
        ? { organization: hydrateOrganizationRef(organizationId, auth, context) }
        : {}),
    ...(rawSpace ? { space: hydrateSpaceForPermissions(rawSpace, auth, context) } : {}),
  } as HydratedRecord;
};

const findOrganizationUser = (
  auth: PermissionHydrationAuth,
  organizationId: string,
  userId: string,
): UnknownRecord => {
  const found = Object.values(auth.organizationUsers ?? {}).find(
    (member) => member.organizationId === organizationId && member.userId === userId,
  );
  return found ? (found as unknown as UnknownRecord) : { organizationId, userId };
};

const findSpaceUser = (
  auth: PermissionHydrationAuth,
  spaceId: string,
  userId: string,
  organizationId: string | null,
): UnknownRecord => {
  const found = Object.values(auth.spaceUsers ?? {}).find(
    (member) => member.spaceId === spaceId && member.userId === userId,
  );
  return found
    ? (found as unknown as UnknownRecord)
    : { spaceId, userId, ...(organizationId ? { organizationId } : {}) };
};

const hydrateOwnedRecordForPermissions = (
  record: UnknownRecord,
  auth: PermissionHydrationAuth,
  context?: TenantContext,
): HydratedRecord => {
  const ownerModel = stringField(record, 'ownerModel');
  const userId = stringField(record, 'userId');
  const organizationId = stringField(record, 'organizationId');
  const spaceId = stringField(record, 'spaceId');

  const existingSpace = asRecord(record.space);
  const rawSpace =
    existingSpace ??
    (spaceId
      ? (((context?.space?.id === spaceId ? context.space : auth.spaces?.[spaceId]) as unknown as
          | UnknownRecord
          | undefined) ?? {
          id: spaceId,
          ...(organizationId ? { organizationId } : {}),
        })
      : null);

  const existingOrgUser = asRecord(record.organizationUser);
  const needsOrgUser =
    Boolean(existingOrgUser) ||
    (organizationId !== null &&
      userId !== null &&
      (ownerModel === 'OrganizationUser' || (ownerModel === null && spaceId === null)));

  const existingSpaceUser = asRecord(record.spaceUser);
  const needsSpaceUser =
    Boolean(existingSpaceUser) ||
    (spaceId !== null && userId !== null && (ownerModel === 'SpaceUser' || ownerModel === null));

  return {
    ...record,
    ...(record.user ? {} : userId ? { user: hydrateUserRef(userId, auth) } : {}),
    ...(record.organization
      ? {}
      : organizationId
        ? { organization: hydrateOrganizationRef(organizationId, auth, context) }
        : {}),
    ...(rawSpace ? { space: hydrateSpaceForPermissions(rawSpace, auth, context) } : {}),
    ...(needsOrgUser && organizationId && userId
      ? {
          organizationUser: hydrateOrganizationUserForPermissions(
            existingOrgUser ?? findOrganizationUser(auth, organizationId, userId),
            auth,
            context,
          ),
        }
      : {}),
    ...(needsSpaceUser && spaceId && userId
      ? {
          spaceUser: hydrateSpaceUserForPermissions(
            existingSpaceUser ?? findSpaceUser(auth, spaceId, userId, organizationId),
            auth,
            context,
          ),
        }
      : {}),
  } as HydratedRecord;
};

/**
 * Hydrates a flat frontend scalar record with parent/owner relations from Zustand store state
 * so client-side `permissions.check(..., schemaMap, ...)` walks every relation identically
 * to backend `hydrate()` (e.g. `Space.organization`, `OrganizationUser.user/organization`,
 * `SpaceUser.user/space.organization`, `Integration` & `Project` owners, `ProjectIntegration.project`).
 */
export const hydrateSettingTargetForPermissions = (
  resourceModel: SettingResourceModelName,
  record: UnknownRecord,
  auth: PermissionHydrationAuth,
  context?: TenantContext,
): HydratedRecord => {
  switch (resourceModel) {
    case 'User':
    case 'Organization':
      return record as HydratedRecord;
    case 'Space':
      return hydrateSpaceForPermissions(record, auth, context);
    case 'OrganizationUser':
      return hydrateOrganizationUserForPermissions(record, auth, context);
    case 'SpaceUser':
      return hydrateSpaceUserForPermissions(record, auth, context);
    case 'Integration':
    case 'Project':
      return hydrateOwnedRecordForPermissions(record, auth, context);
    case 'ProjectIntegration': {
      const existingProject = asRecord(record.project);
      const existingIntegration = asRecord(record.integration);
      return {
        ...record,
        ...(existingProject
          ? { project: hydrateOwnedRecordForPermissions(existingProject, auth, context) }
          : {}),
        ...(existingIntegration
          ? {
              integration: hydrateOwnedRecordForPermissions(existingIntegration, auth, context),
            }
          : {}),
      } as HydratedRecord;
    }
  }
};
