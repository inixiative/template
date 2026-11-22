/**
 * @atlas
 * @kind test
 * @partOf feature:billing
 * @uses primitive:authz
 */
import { describe, expect, it } from 'bun:test';
import type { HydratedRecord } from '@template/db';
import {
  BillingAccountOwnerModel,
  BillingResourceTargetModel,
  Role,
} from '@template/db/generated/client/enums';
import {
  ActorModel,
  createPermissions,
  installPermissions,
  type Permix,
} from '@template/permissions/client';
import { check } from '@template/permissions/rebac/check';
import { rebacSchema } from '@template/permissions/rebac/schema';
import { permissionsOfUser } from '@template/permissions/roles/permissionsOfUser';

const makePermix = async (args: {
  userId: string;
  orgRole?: Role;
  spaceRole?: Role;
  orgId?: string;
  spaceId?: string;
}): Promise<Permix> => {
  const permix = createPermissions();
  const orgMembers =
    args.orgRole && args.orgId
      ? [
          {
            id: `ou_${args.userId}`,
            organizationId: args.orgId,
            userId: args.userId,
            role: args.orgRole,
          },
        ]
      : [];
  const spaceMembers =
    args.spaceRole && args.orgId && args.spaceId
      ? [
          {
            id: `su_${args.userId}`,
            organizationId: args.orgId,
            spaceId: args.spaceId,
            userId: args.userId,
            role: args.spaceRole,
          },
        ]
      : [];
  await installPermissions(permix, permissionsOfUser(args.userId, orgMembers, spaceMembers));
  permix.setActor({ model: ActorModel.User, record: { id: args.userId } });
  return permix;
};

describe('db:billingAccount & db:billingResource ReBAC rules', () => {
  const orgId = '01950000-0000-7000-8000-000000000001';
  const spaceId = '01950000-0000-7000-8000-000000000002';
  const adminUserId = '01950000-0000-7000-8000-000000000010';
  const memberUserId = '01950000-0000-7000-8000-000000000011';
  const outsiderUserId = '01950000-0000-7000-8000-000000000012';
  const accountId = '01950000-0000-7000-8000-000000000020';

  const makeOrgAccount = (isShared: boolean) =>
    ({
      id: accountId,
      ownerModel: BillingAccountOwnerModel.Organization,
      organizationId: orgId,
      userId: null,
      spaceId: null,
      isShared,
      organization: { id: orgId },
    }) as unknown as HydratedRecord;

  it('hides private org accounts from members, exposes shared accounts for read/operate, and keeps manage admin-only', async () => {
    const adminPermix = await makePermix({ userId: adminUserId, orgId, orgRole: Role.admin });
    const memberPermix = await makePermix({ userId: memberUserId, orgId, orgRole: Role.member });
    const outsiderPermix = await makePermix({ userId: outsiderUserId });

    const privateAccount = makeOrgAccount(false);
    const sharedAccount = makeOrgAccount(true);

    expect(check(adminPermix, rebacSchema, 'billingAccount', privateAccount, 'manage')).toBe(true);
    expect(check(memberPermix, rebacSchema, 'billingAccount', privateAccount, 'read')).toBe(false);
    expect(check(memberPermix, rebacSchema, 'billingAccount', privateAccount, 'operate')).toBe(
      false,
    );

    expect(check(memberPermix, rebacSchema, 'billingAccount', sharedAccount, 'read')).toBe(true);
    expect(check(memberPermix, rebacSchema, 'billingAccount', sharedAccount, 'operate')).toBe(true);
    expect(check(memberPermix, rebacSchema, 'billingAccount', sharedAccount, 'manage')).toBe(false);

    expect(check(outsiderPermix, rebacSchema, 'billingAccount', sharedAccount, 'read')).toBe(false);
  });

  it('restricts User, OrganizationUser, and SpaceUser billing accounts strictly to the owning user', async () => {
    const adminPermix = await makePermix({
      userId: adminUserId,
      orgId,
      spaceId,
      orgRole: Role.owner,
      spaceRole: Role.owner,
    });
    const memberPermix = await makePermix({
      userId: memberUserId,
      orgId,
      spaceId,
      orgRole: Role.member,
      spaceRole: Role.member,
    });

    const orgUserAccount = {
      id: accountId,
      ownerModel: BillingAccountOwnerModel.OrganizationUser,
      organizationId: orgId,
      userId: memberUserId,
      spaceId: null,
      isShared: false,
      organization: { id: orgId },
      organizationUser: {
        id: `ou_${memberUserId}`,
        organizationId: orgId,
        userId: memberUserId,
        organization: { id: orgId },
        user: { id: memberUserId },
      },
    } as unknown as HydratedRecord;

    const spaceUserAccount = {
      id: accountId,
      ownerModel: BillingAccountOwnerModel.SpaceUser,
      organizationId: orgId,
      spaceId,
      userId: memberUserId,
      isShared: false,
      organization: { id: orgId },
      space: { id: spaceId, organizationId: orgId, organization: { id: orgId } },
      spaceUser: {
        id: `su_${memberUserId}`,
        organizationId: orgId,
        spaceId,
        userId: memberUserId,
        space: { id: spaceId, organizationId: orgId, organization: { id: orgId } },
        user: { id: memberUserId },
      },
    } as unknown as HydratedRecord;

    expect(check(memberPermix, rebacSchema, 'billingAccount', orgUserAccount, 'manage')).toBe(true);
    expect(check(memberPermix, rebacSchema, 'billingAccount', orgUserAccount, 'delete')).toBe(true);
    expect(check(adminPermix, rebacSchema, 'billingAccount', orgUserAccount, 'read')).toBe(false);
    expect(check(adminPermix, rebacSchema, 'billingAccount', orgUserAccount, 'delete')).toBe(false);
    expect(check(memberPermix, rebacSchema, 'billingAccount', spaceUserAccount, 'manage')).toBe(
      true,
    );
    expect(check(adminPermix, rebacSchema, 'billingAccount', spaceUserAccount, 'read')).toBe(false);
    expect(check(adminPermix, rebacSchema, 'billingAccount', spaceUserAccount, 'delete')).toBe(
      false,
    );
  });

  it('requires operate on billingAccount and manage on target resource to bind a BillingResource', async () => {
    const memberPermix = await makePermix({ userId: memberUserId, orgId, orgRole: Role.member });

    const bindingToOwnMember = {
      id: 'br_1',
      billingAccountId: accountId,
      billingAccount: makeOrgAccount(true),
      resourceModel: BillingResourceTargetModel.OrganizationUser,
      resourceOrganizationId: orgId,
      resourceUserId: memberUserId,
      resourceOrganizationUser: {
        id: `ou_${memberUserId}`,
        organizationId: orgId,
        userId: memberUserId,
        user: { id: memberUserId },
      },
    } as unknown as HydratedRecord;

    const bindingPrivate = {
      ...bindingToOwnMember,
      billingAccount: makeOrgAccount(false),
    } as unknown as HydratedRecord;

    expect(check(memberPermix, rebacSchema, 'billingResource', bindingToOwnMember, 'create')).toBe(
      true,
    );
    expect(check(memberPermix, rebacSchema, 'billingResource', bindingPrivate, 'create')).toBe(
      false,
    );
    expect(check(memberPermix, rebacSchema, 'billingResource', bindingPrivate, 'delete')).toBe(
      true,
    );
  });
});
